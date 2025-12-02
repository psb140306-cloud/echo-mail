import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/utils/logger'
import { mailMonitorService } from '@/lib/mail/mail-monitor-service'

const prisma = new PrismaClient()

/**
 * 메일 자동 확인 스케줄러
 * 각 테넌트의 checkInterval 설정에 따라 동적으로 메일 확인
 */
export class MailScheduler {
  private tasks = new Map<string, cron.ScheduledTask>()
  private isInitialized = false

  /**
   * 스케줄러 초기화 및 시작
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('[MailScheduler] 이미 초기화됨')
      return
    }

    logger.info('[MailScheduler] 초기화 시작')

    // 모든 활성 테넌트의 메일 설정 로드 및 스케줄 등록
    await this.reloadAllSchedules()

    this.isInitialized = true
    logger.info('[MailScheduler] 초기화 완료')
  }

  /**
   * 모든 테넌트의 스케줄 재로드
   */
  async reloadAllSchedules() {
    logger.info('[MailScheduler] 전체 스케줄 재로드 시작')

    // 기존 스케줄 모두 중지
    this.stopAll()

    // 활성화된 메일 서버 설정이 있는 테넌트 조회
    const configs = await this.getActiveTenantConfigs()

    logger.info(`[MailScheduler] 활성 테넌트 ${configs.length}개 발견`)

    // 각 테넌트의 스케줄 등록
    for (const config of configs) {
      this.scheduleForTenant(config.tenantId, config.checkInterval)
    }

    logger.info('[MailScheduler] 전체 스케줄 재로드 완료', {
      activeSchedules: this.tasks.size,
    })
  }

  /**
   * 특정 테넌트의 스케줄 등록/업데이트
   */
  scheduleForTenant(tenantId: string, intervalMinutes: number) {
    // 기존 스케줄 제거
    this.stopForTenant(tenantId)

    // 1~5분 범위 검증
    const validInterval = Math.max(1, Math.min(5, intervalMinutes))
    if (validInterval !== intervalMinutes) {
      logger.warn('[MailScheduler] 잘못된 간격 값 조정', {
        tenantId,
        requested: intervalMinutes,
        adjusted: validInterval,
      })
    }

    // 크론 표현식 생성: */N * * * * (N분마다)
    const cronExpression = `*/${validInterval} * * * *`

    logger.info('[MailScheduler] 스케줄 등록', {
      tenantId,
      intervalMinutes: validInterval,
      cronExpression,
    })

    // 스케줄 작업 생성
    const task = cron.schedule(
      cronExpression,
      async () => {
        logger.info('[MailScheduler] 스케줄 작업 실행', {
          tenantId,
          intervalMinutes: validInterval,
        })

        try {
          // 해당 테넌트의 메일만 확인
          const results = await mailMonitorService.checkAllTenants()
          const result = results.get(tenantId)

          if (result) {
            logger.info('[MailScheduler] 스케줄 작업 완료', {
              tenantId,
              newMails: result.newMailsCount,
              processed: result.processedCount,
              failed: result.failedCount,
            })
          } else {
            logger.warn('[MailScheduler] 테넌트 결과 없음', { tenantId })
          }
        } catch (error) {
          logger.error('[MailScheduler] 스케줄 작업 실패:', {
            tenantId,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          })
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Seoul',
      }
    )

    this.tasks.set(tenantId, task)
    logger.info('[MailScheduler] 스케줄 등록 완료', {
      tenantId,
      activeSchedules: this.tasks.size,
    })
  }

  /**
   * 특정 테넌트의 스케줄 중지 및 제거
   */
  stopForTenant(tenantId: string) {
    const task = this.tasks.get(tenantId)
    if (task) {
      task.stop()
      this.tasks.delete(tenantId)
      logger.info('[MailScheduler] 스케줄 중지', { tenantId })
    }
  }

  /**
   * 모든 스케줄 중지
   */
  stopAll() {
    logger.info('[MailScheduler] 모든 스케줄 중지', {
      count: this.tasks.size,
    })

    for (const [tenantId, task] of this.tasks.entries()) {
      task.stop()
      logger.debug('[MailScheduler] 스케줄 중지', { tenantId })
    }

    this.tasks.clear()
  }

  /**
   * 스케줄러 상태 조회
   */
  getStatus() {
    const schedules: Record<string, { isRunning: boolean }> = {}

    for (const [tenantId, task] of this.tasks.entries()) {
      schedules[tenantId] = {
        isRunning: true, // cron.ScheduledTask는 scheduled 상태만 확인 가능
      }
    }

    return {
      isInitialized: this.isInitialized,
      activeSchedules: this.tasks.size,
      schedules,
    }
  }

  /**
   * 활성화된 테넌트의 메일 설정 조회
   */
  private async getActiveTenantConfigs(): Promise<
    Array<{ tenantId: string; checkInterval: number }>
  > {
    // SystemConfig에서 메일 설정 조회
    const mailConfigs = await prisma.systemConfig.findMany({
      where: {
        key: {
          startsWith: 'mailServer.',
        },
      },
    })

    logger.info(`[MailScheduler] DB에서 메일 설정 ${mailConfigs.length}개 조회됨`, {
      configs: mailConfigs.map(c => ({ tenantId: c.tenantId, key: c.key }))
    })

    // 테넌트별로 그룹화
    const tenantConfigMap = new Map<string, Record<string, any>>()

    for (const config of mailConfigs) {
      if (!tenantConfigMap.has(config.tenantId)) {
        tenantConfigMap.set(config.tenantId, {})
      }

      const [, field] = config.key.split('.')
      const tenantConfig = tenantConfigMap.get(config.tenantId)!

      try {
        tenantConfig[field] = JSON.parse(config.value)
      } catch {
        tenantConfig[field] = config.value
      }
    }

    // 활성화되고 필수 설정이 모두 있는 테넌트만 반환
    const activeConfigs: Array<{ tenantId: string; checkInterval: number }> = []

    for (const [tenantId, config] of tenantConfigMap.entries()) {
      // 보안: 비밀번호, 사용자명 등 민감 정보 로깅 제외
      logger.debug(`[MailScheduler] 테넌트 ${tenantId} 설정 확인`, {
        enabled: config.enabled,
        hasHost: !!config.host,
        hasPort: !!config.port,
        hasCredentials: !!(config.username && config.password),
        checkInterval: config.checkInterval || 'N/A',
      })

      if (
        config.enabled === true &&
        config.host &&
        config.port &&
        config.username &&
        config.password
      ) {
        activeConfigs.push({
          tenantId,
          checkInterval: config.checkInterval || 5, // 기본값 5분
        })
      } else {
        logger.warn(
          `[MailScheduler] 테넌트 ${tenantId} 비활성: ` +
          `enabled=${config.enabled !== true ? 'FALSE' : 'true'}, ` +
          `missing=${[
            !config.host && 'host',
            !config.port && 'port',
            !config.username && 'username',
            !config.password && 'password'
          ].filter(Boolean).join(', ') || 'none'}`
        )
      }
    }

    logger.info(`[MailScheduler] 최종 활성 테넌트 ${activeConfigs.length}개`, {
      tenants: activeConfigs.map(c => ({ tenantId: c.tenantId, interval: c.checkInterval }))
    })

    return activeConfigs
  }
}

// 싱글톤 인스턴스
export const mailScheduler = new MailScheduler()
