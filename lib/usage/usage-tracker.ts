/**
 * SaaS 사용량 실시간 추적 시스템
 * - Redis 기반 실시간 카운터
 * - 테넌트별 사용량 추적
 * - 월별 집계 및 제한 체크
 */

import { redis, cache } from '@/lib/redis'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { PLAN_LIMITS, SubscriptionPlan } from '@/lib/subscription/plans'

// 사용량 추적 타입
export enum UsageType {
  EMAIL = 'email',
  SMS = 'sms',
  KAKAO = 'kakao',
  API_CALL = 'api_call',
  STORAGE = 'storage',
}

// 사용량 통계 인터페이스
export interface UsageStats {
  tenantId: string
  period: string // YYYY-MM 형식
  email: number
  sms: number
  kakao: number
  apiCall: number
  storage: number
  lastUpdated: Date
}

// 사용량 제한 체크 결과
export interface UsageLimitCheck {
  allowed: boolean
  currentUsage: number
  limit: number
  usagePercentage: number
  warningLevel: 'none' | 'warning' | 'critical' | 'exceeded'
  message?: string
}

// 사용량 알림 설정
export interface UsageAlert {
  tenantId: string
  usageType: UsageType
  threshold: number // 임계값 (퍼센트)
  currentUsage: number
  limit: number
  triggered: boolean
}

/**
 * 사용량 추적 서비스
 */
export class UsageTracker {
  /**
   * 사용량 증가 (실시간)
   */
  static async incrementUsage(
    tenantId: string,
    usageType: UsageType,
    amount: number = 1,
    metadata?: any
  ): Promise<void> {
    try {
      const currentMonth = this.getCurrentMonth()

      // Redis가 설정되어 있을 때만 실시간 카운터 업데이트
      if (redis) {
        // Redis에 실시간 카운터 업데이트
        const dailyKey = `usage:${tenantId}:${usageType}:${this.getCurrentDay()}`
        const monthlyKey = `usage:${tenantId}:${usageType}:${currentMonth}`
        const totalKey = `usage:${tenantId}:${usageType}:total`

        // 파이프라인으로 한 번에 처리
        const pipeline = redis.pipeline()

        // 일별 카운터 (7일 보관)
        pipeline.incrby(dailyKey, amount)
        pipeline.expire(dailyKey, 7 * 24 * 60 * 60) // 7일

        // 월별 카운터 (13개월 보관)
        pipeline.incrby(monthlyKey, amount)
        pipeline.expire(monthlyKey, 13 * 30 * 24 * 60 * 60) // 13개월

        // 전체 카운터
        pipeline.incrby(totalKey, amount)

        // 최근 사용 시간 업데이트
        pipeline.set(`usage:${tenantId}:last_activity`, Date.now())
        pipeline.expire(`usage:${tenantId}:last_activity`, 30 * 24 * 60 * 60) // 30일

        await pipeline.exec()
      } else {
        logger.warn('Redis가 설정되지 않아 실시간 사용량 추적을 건너뜁니다', {
          tenantId,
          usageType,
          amount,
        })
      }

      // 메타데이터가 있는 경우 저장 (최근 100개) - Redis가 있을 때만
      if (metadata && redis) {
        const metadataKey = `usage:${tenantId}:${usageType}:metadata`
        const entry = {
          timestamp: Date.now(),
          amount,
          metadata,
        }

        await redis.lpush(metadataKey, JSON.stringify(entry))
        await redis.ltrim(metadataKey, 0, 99) // 최근 100개만 유지
        await redis.expire(metadataKey, 30 * 24 * 60 * 60) // 30일
      }

      // 사용량 제한 체크 (비동기)
      this.checkUsageLimits(tenantId, usageType).catch((error) => {
        logger.error('사용량 제한 체크 실패', { tenantId, usageType, error })
      })

      logger.debug('사용량 증가 완료', {
        tenantId,
        usageType,
        amount,
        dailyKey,
        monthlyKey,
      })
    } catch (error) {
      logger.error('사용량 증가 실패', {
        tenantId,
        usageType,
        amount,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 현재 사용량 조회 (실시간)
   */
  static async getCurrentUsage(
    tenantId: string,
    usageType?: UsageType,
    period: 'day' | 'month' | 'total' = 'month'
  ): Promise<Record<string, number>> {
    try {
      const types = usageType ? [usageType] : Object.values(UsageType)
      const result: Record<string, number> = {}

      // Redis가 없으면 모두 0 반환
      if (!redis) {
        types.forEach((type) => {
          result[type] = 0
        })
        return result
      }

      const periodKey =
        period === 'day'
          ? this.getCurrentDay()
          : period === 'month'
            ? this.getCurrentMonth()
            : 'total'

      // 병렬로 모든 사용량 조회
      const promises = types.map(async (type) => {
        const key = `usage:${tenantId}:${type}:${periodKey}`
        const usage = await redis.get(key)
        result[type] = parseInt(usage || '0', 10)
      })

      await Promise.all(promises)

      return result
    } catch (error) {
      logger.error('사용량 조회 실패', {
        tenantId,
        usageType,
        period,
        error: error instanceof Error ? error.message : String(error),
      })
      return {}
    }
  }

  /**
   * 사용량 제한 체크
   */
  static async checkUsageLimits(tenantId: string, usageType: UsageType): Promise<UsageLimitCheck> {
    try {
      // 테넌트 정보 조회
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          subscriptionPlan: true,
          maxEmails: true,
          maxNotifications: true,
        },
      })

      if (!tenant) {
        return {
          allowed: false,
          currentUsage: 0,
          limit: 0,
          usagePercentage: 100,
          warningLevel: 'exceeded',
          message: '테넌트를 찾을 수 없습니다.',
        }
      }

      // 플랜별 제한 조회
      const planLimits = PLAN_LIMITS[tenant.subscriptionPlan as SubscriptionPlan]

      let limit = 0
      switch (usageType) {
        case UsageType.EMAIL:
          limit =
            planLimits.maxEmailsPerMonth === -1
              ? Number.MAX_SAFE_INTEGER
              : planLimits.maxEmailsPerMonth
          break
        case UsageType.SMS:
        case UsageType.KAKAO:
          limit =
            planLimits.maxNotificationsPerMonth === -1
              ? Number.MAX_SAFE_INTEGER
              : planLimits.maxNotificationsPerMonth
          break
        case UsageType.API_CALL:
          limit = planLimits.features.apiAccess ? 10000 : 0 // API 액세스 가능하면 월 10,000회
          break
        case UsageType.STORAGE:
          limit = 1000 * 1024 * 1024 // 1GB 기본
          break
      }

      // 현재 사용량 조회
      const usage = await this.getCurrentUsage(tenantId, usageType, 'month')
      const currentUsage = usage[usageType] || 0

      // 사용률 계산
      const usagePercentage = limit === 0 ? 100 : Math.min((currentUsage / limit) * 100, 100)

      // 경고 레벨 결정
      let warningLevel: UsageLimitCheck['warningLevel'] = 'none'
      let message = undefined

      if (currentUsage >= limit) {
        warningLevel = 'exceeded'
        message = `${usageType} 사용량이 한도(${limit.toLocaleString()})를 초과했습니다.`
      } else if (usagePercentage >= 95) {
        warningLevel = 'critical'
        message = `${usageType} 사용량이 95%에 도달했습니다. 업그레이드를 고려해주세요.`
      } else if (usagePercentage >= 80) {
        warningLevel = 'warning'
        message = `${usageType} 사용량이 80%에 도달했습니다.`
      }

      // 알림 전송 (임계값 도달시)
      if (warningLevel !== 'none') {
        await this.sendUsageAlert(tenantId, usageType, usagePercentage, currentUsage, limit)
      }

      return {
        allowed: currentUsage < limit,
        currentUsage,
        limit,
        usagePercentage,
        warningLevel,
        message,
      }
    } catch (error) {
      logger.error('사용량 제한 체크 실패', {
        tenantId,
        usageType,
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        allowed: false,
        currentUsage: 0,
        limit: 0,
        usagePercentage: 100,
        warningLevel: 'exceeded',
        message: '사용량 체크 중 오류가 발생했습니다.',
      }
    }
  }

  /**
   * 일괄 사용량 제한 체크 (모든 타입)
   */
  static async checkAllUsageLimits(tenantId: string): Promise<Record<string, UsageLimitCheck>> {
    const results: Record<string, UsageLimitCheck> = {}

    const promises = Object.values(UsageType).map(async (type) => {
      results[type] = await this.checkUsageLimits(tenantId, type)
    })

    await Promise.all(promises)
    return results
  }

  /**
   * 사용량 통계 조회 (기간별)
   */
  static async getUsageStats(
    tenantId: string,
    startMonth?: string,
    endMonth?: string
  ): Promise<UsageStats[]> {
    try {
      const start = startMonth || this.getPreviousMonth(5) // 기본 6개월
      const end = endMonth || this.getCurrentMonth()

      const months = this.getMonthRange(start, end)
      const stats: UsageStats[] = []

      for (const month of months) {
        const monthlyUsage: Record<string, number> = {}

        // 모든 사용량 타입 조회
        const promises = Object.values(UsageType).map(async (type) => {
          const key = `usage:${tenantId}:${type}:${month}`
          const usage = await redis.get(key)
          monthlyUsage[type] = parseInt(usage || '0', 10)
        })

        await Promise.all(promises)

        stats.push({
          tenantId,
          period: month,
          email: monthlyUsage[UsageType.EMAIL] || 0,
          sms: monthlyUsage[UsageType.SMS] || 0,
          kakao: monthlyUsage[UsageType.KAKAO] || 0,
          apiCall: monthlyUsage[UsageType.API_CALL] || 0,
          storage: monthlyUsage[UsageType.STORAGE] || 0,
          lastUpdated: new Date(),
        })
      }

      return stats.sort((a, b) => b.period.localeCompare(a.period))
    } catch (error) {
      logger.error('사용량 통계 조회 실패', {
        tenantId,
        startMonth,
        endMonth,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * 사용량 알림 발송
   */
  private static async sendUsageAlert(
    tenantId: string,
    usageType: UsageType,
    usagePercentage: number,
    currentUsage: number,
    limit: number
  ): Promise<void> {
    try {
      // 알림 중복 방지 체크 (1시간 쿨다운)
      const alertKey = `usage_alert:${tenantId}:${usageType}:${Math.floor(usagePercentage / 10) * 10}`
      const alertSent = await redis.get(alertKey)

      if (alertSent) {
        return // 이미 알림 발송됨
      }

      // 알림 발송 플래그 설정
      await redis.setex(alertKey, 3600, '1') // 1시간

      // 테넌트 관리자 정보 조회
      const tenantMembers = await prisma.tenantMember.findMany({
        where: {
          tenantId,
          role: { in: ['OWNER', 'ADMIN'] },
          status: 'ACTIVE',
        },
        select: {
          userEmail: true,
          userName: true,
        },
      })

      if (tenantMembers.length === 0) {
        return
      }

      // 알림 메시지 생성
      const usageTypeText = {
        [UsageType.EMAIL]: '이메일 처리',
        [UsageType.SMS]: 'SMS 발송',
        [UsageType.KAKAO]: '카카오톡 발송',
        [UsageType.API_CALL]: 'API 호출',
        [UsageType.STORAGE]: '스토리지 사용',
      }

      const message =
        `Echo Mail 사용량 알림\n\n` +
        `${usageTypeText[usageType]} 사용량이 ${usagePercentage.toFixed(1)}%에 도달했습니다.\n` +
        `현재 사용량: ${currentUsage.toLocaleString()}건\n` +
        `월 한도: ${limit.toLocaleString()}건\n\n` +
        `플랜 업그레이드를 통해 더 많은 사용량을 확보할 수 있습니다.`

      // TODO: 실제 알림 발송 구현
      // await notificationService.sendAdminNotification(tenantMembers, message)

      logger.info('사용량 알림 발송', {
        tenantId,
        usageType,
        usagePercentage,
        currentUsage,
        limit,
        recipientCount: tenantMembers.length,
      })
    } catch (error) {
      logger.error('사용량 알림 발송 실패', {
        tenantId,
        usageType,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * 사용량 초기화 (월 단위)
   */
  static async resetMonthlyUsage(tenantId: string): Promise<void> {
    try {
      const currentMonth = this.getCurrentMonth()
      const keys: string[] = []

      // 모든 사용량 타입의 월별 키 수집
      Object.values(UsageType).forEach((type) => {
        keys.push(`usage:${tenantId}:${type}:${currentMonth}`)
      })

      if (keys.length > 0) {
        await redis.del(...keys)
        logger.info('월별 사용량 초기화 완료', { tenantId, keys: keys.length })
      }
    } catch (error) {
      logger.error('월별 사용량 초기화 실패', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * 전체 사용량 삭제 (테넌트 삭제시)
   */
  static async deleteAllUsage(tenantId: string): Promise<void> {
    try {
      const pattern = `usage:${tenantId}:*`
      const keys = await redis.keys(pattern)

      if (keys.length > 0) {
        await redis.del(...keys)
        logger.info('전체 사용량 삭제 완료', { tenantId, keys: keys.length })
      }
    } catch (error) {
      logger.error('전체 사용량 삭제 실패', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // 헬퍼 메서드들
  private static getCurrentDay(): string {
    return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  }

  private static getCurrentMonth(): string {
    return new Date().toISOString().slice(0, 7) // YYYY-MM
  }

  private static getPreviousMonth(months: number): string {
    const date = new Date()
    date.setMonth(date.getMonth() - months)
    return date.toISOString().slice(0, 7)
  }

  private static getMonthRange(start: string, end: string): string[] {
    const months: string[] = []
    const startDate = new Date(start + '-01')
    const endDate = new Date(end + '-01')

    while (startDate <= endDate) {
      months.push(startDate.toISOString().slice(0, 7))
      startDate.setMonth(startDate.getMonth() + 1)
    }

    return months
  }
}

// 편의 함수들
export const trackEmailUsage = (tenantId: string, count = 1) =>
  UsageTracker.incrementUsage(tenantId, UsageType.EMAIL, count)

export const trackSMSUsage = (tenantId: string, count = 1, metadata?: any) =>
  UsageTracker.incrementUsage(tenantId, UsageType.SMS, count, metadata)

export const trackKakaoUsage = (tenantId: string, count = 1, metadata?: any) =>
  UsageTracker.incrementUsage(tenantId, UsageType.KAKAO, count, metadata)

export const trackAPIUsage = (tenantId: string, endpoint?: string) =>
  UsageTracker.incrementUsage(tenantId, UsageType.API_CALL, 1, { endpoint })

export const checkEmailLimit = (tenantId: string) =>
  UsageTracker.checkUsageLimits(tenantId, UsageType.EMAIL)

export const checkNotificationLimit = (tenantId: string) =>
  UsageTracker.checkUsageLimits(tenantId, UsageType.SMS) // SMS와 카카오톡은 같은 알림 한도 공유

export default UsageTracker
