/**
 * 무료 체험 만료 관리
 * - 체험 종료 테넌트 탐지
 * - 자동 정지 처리
 * - 관리자 알림 발송
 */

import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { SubscriptionStatus } from '@prisma/client'
import { getKSTStartOfDay, getKSTNow } from '@/lib/utils/date'

export interface TrialExpiryResult {
  tenantId: string
  tenantName: string
  trialEndsAt: Date
  action: 'suspended' | 'notified' | 'skipped'
  reason?: string
}

export class TrialManager {
  /**
   * 만료된 무료 체험 테넌트 확인 및 처리
   */
  static async processExpiredTrials(): Promise<TrialExpiryResult[]> {
    logger.info('무료 체험 만료 확인 시작')

    try {
      const now = new Date()

      // 체험 기간이 만료된 테넌트 조회
      const expiredTenants = await prisma.tenant.findMany({
        where: {
          subscriptionStatus: SubscriptionStatus.TRIAL,
          trialEndsAt: {
            lte: now,
          },
        },
        include: {
          users: {
            where: { isActive: true },
            take: 1, // 소유자 정보
          },
          subscriptions: {
            where: { status: SubscriptionStatus.TRIAL },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })

      logger.info(`만료된 무료 체험 테넌트 ${expiredTenants.length}개 발견`)

      const results: TrialExpiryResult[] = []

      // 각 테넌트 처리
      for (const tenant of expiredTenants) {
        try {
          const result = await this.processSingleExpiredTrial(tenant)
          results.push(result)
        } catch (error) {
          logger.error('체험 만료 처리 실패', {
            tenantId: tenant.id,
            tenantName: tenant.name,
            error: error instanceof Error ? error.message : String(error),
          })

          results.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            trialEndsAt: tenant.trialEndsAt,
            action: 'skipped',
            reason: error instanceof Error ? error.message : '처리 실패',
          })
        }
      }

      logger.info('무료 체험 만료 처리 완료', {
        totalProcessed: results.length,
        suspended: results.filter((r) => r.action === 'suspended').length,
        notified: results.filter((r) => r.action === 'notified').length,
        skipped: results.filter((r) => r.action === 'skipped').length,
      })

      return results
    } catch (error) {
      logger.error('무료 체험 만료 처리 중 오류 발생', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 단일 테넌트의 체험 만료 처리
   */
  private static async processSingleExpiredTrial(tenant: any): Promise<TrialExpiryResult> {
    logger.info('체험 만료 테넌트 처리', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      trialEndsAt: tenant.trialEndsAt,
    })

    // 1. 테넌트 상태를 정지로 변경
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: SubscriptionStatus.CANCELLED,
      },
    })

    // 2. 구독 상태 업데이트
    if (tenant.subscriptions && tenant.subscriptions.length > 0) {
      await prisma.subscription.update({
        where: { id: tenant.subscriptions[0].id },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelAtPeriodEnd: false,
        },
      })
    }

    // 3. 관리자에게 알림 발송
    await this.sendExpiryNotification(tenant)

    logger.info('체험 만료 테넌트 정지 완료', {
      tenantId: tenant.id,
      tenantName: tenant.name,
    })

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      trialEndsAt: tenant.trialEndsAt,
      action: 'suspended',
    }
  }

  /**
   * 만료 예정 체험 알림 발송
   */
  static async sendUpcomingExpiryNotifications(daysAhead: number = 3): Promise<number> {
    logger.info(`${daysAhead}일 후 만료 예정 체험 알림 발송 시작`)

    try {
      // KST 기준으로 날짜 계산
      const kstNow = getKSTNow()
      const targetDate = new Date(Date.UTC(
        kstNow.getUTCFullYear(),
        kstNow.getUTCMonth(),
        kstNow.getUTCDate() + daysAhead,
        23, 59, 59, 999
      ))
      targetDate.setTime(targetDate.getTime() - 9 * 60 * 60 * 1000) // UTC로 변환

      const startOfDay = new Date(Date.UTC(
        kstNow.getUTCFullYear(),
        kstNow.getUTCMonth(),
        kstNow.getUTCDate() + daysAhead,
        0, 0, 0, 0
      ))
      startOfDay.setTime(startOfDay.getTime() - 9 * 60 * 60 * 1000) // UTC로 변환

      // 만료 예정 테넌트 조회
      const upcomingExpiryTenants = await prisma.tenant.findMany({
        where: {
          subscriptionStatus: SubscriptionStatus.TRIAL,
          trialEndsAt: {
            gte: startOfDay,
            lte: targetDate,
          },
        },
        include: {
          users: {
            where: { isActive: true },
            take: 1,
          },
        },
      })

      logger.info(`${daysAhead}일 후 만료 예정 테넌트 ${upcomingExpiryTenants.length}개 발견`)

      // 각 테넌트에 알림 발송
      for (const tenant of upcomingExpiryTenants) {
        try {
          await this.sendUpcomingExpiryNotification(tenant, daysAhead)
        } catch (error) {
          logger.error('만료 예정 알림 발송 실패', {
            tenantId: tenant.id,
            tenantName: tenant.name,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      return upcomingExpiryTenants.length
    } catch (error) {
      logger.error('만료 예정 알림 발송 중 오류 발생', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 체험 만료 알림 이메일 발송
   */
  private static async sendExpiryNotification(tenant: any): Promise<void> {
    if (!tenant.users || tenant.users.length === 0) {
      logger.warn('알림 발송 대상 사용자 없음', {
        tenantId: tenant.id,
        tenantName: tenant.name,
      })
      return
    }

    const user = tenant.users[0]

    logger.info('체험 만료 알림 발송', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userEmail: user.email,
    })

    // TODO: 이메일/SMS 발송 로직 구현
    // NotificationService를 활용하여 이메일 발송
    // 내용: 무료 체험 종료, 유료 플랜 안내, 결제 링크

    // 임시 로그
    logger.info('[알림] 무료 체험 만료', {
      tenantName: tenant.name,
      userEmail: user.email,
      trialEndsAt: tenant.trialEndsAt,
      message: `
안녕하세요 ${tenant.name} 관리자님,

Echo Mail 무료 체험 기간이 종료되었습니다.

체험 종료일: ${tenant.trialEndsAt.toLocaleDateString('ko-KR')}

서비스를 계속 이용하시려면 유료 플랜으로 업그레이드해주세요.

- Starter 플랜: 월 29,000원
- Professional 플랜: 월 79,000원
- Business 플랜: 월 149,000원

업그레이드: https://echomail.example.com/settings/billing

감사합니다.
Echo Mail 팀
      `.trim(),
    })
  }

  /**
   * 만료 예정 알림 이메일 발송
   */
  private static async sendUpcomingExpiryNotification(
    tenant: any,
    daysRemaining: number
  ): Promise<void> {
    if (!tenant.users || tenant.users.length === 0) {
      return
    }

    const user = tenant.users[0]

    logger.info('만료 예정 알림 발송', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userEmail: user.email,
      daysRemaining,
    })

    // TODO: 이메일/SMS 발송 로직 구현

    logger.info('[알림] 무료 체험 만료 예정', {
      tenantName: tenant.name,
      userEmail: user.email,
      daysRemaining,
      trialEndsAt: tenant.trialEndsAt,
      message: `
안녕하세요 ${tenant.name} 관리자님,

Echo Mail 무료 체험 기간이 ${daysRemaining}일 후 종료됩니다.

체험 종료일: ${tenant.trialEndsAt.toLocaleDateString('ko-KR')}

서비스를 계속 이용하시려면 유료 플랜으로 업그레이드해주세요.

업그레이드: https://echomail.example.com/settings/billing

감사합니다.
Echo Mail 팀
      `.trim(),
    })
  }

  /**
   * 체험 만료 통계 조회
   */
  static async getExpiryStats(): Promise<{
    expiredToday: number
    expiring3Days: number
    expiring7Days: number
    totalTrialTenants: number
  }> {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const in3Days = new Date(today)
    in3Days.setDate(in3Days.getDate() + 3)

    const in7Days = new Date(today)
    in7Days.setDate(in7Days.getDate() + 7)

    const [expiredToday, expiring3Days, expiring7Days, totalTrialTenants] = await Promise.all([
      // 오늘 만료
      prisma.tenant.count({
        where: {
          subscriptionStatus: SubscriptionStatus.TRIAL,
          trialEndsAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      // 3일 이내 만료
      prisma.tenant.count({
        where: {
          subscriptionStatus: SubscriptionStatus.TRIAL,
          trialEndsAt: {
            gte: now,
            lte: in3Days,
          },
        },
      }),
      // 7일 이내 만료
      prisma.tenant.count({
        where: {
          subscriptionStatus: SubscriptionStatus.TRIAL,
          trialEndsAt: {
            gte: now,
            lte: in7Days,
          },
        },
      }),
      // 전체 체험 테넌트
      prisma.tenant.count({
        where: {
          subscriptionStatus: SubscriptionStatus.TRIAL,
        },
      }),
    ])

    return {
      expiredToday,
      expiring3Days,
      expiring7Days,
      totalTrialTenants,
    }
  }
}

export default TrialManager
