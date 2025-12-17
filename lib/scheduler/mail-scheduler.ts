import cron from 'node-cron'
import { logger } from '@/lib/utils/logger'
import { mailMonitorService } from '@/lib/mail/mail-monitor-service'
import { processScheduledEmails } from './scheduled-email-processor'
import { prisma } from '@/lib/db'
import { runWithAdvisoryLock } from '@/lib/db/advisory-lock'

/**
 * 메일 자동 확인 스케줄러
 * 단일 글로벌 cron으로 모든 테넌트의 메일을 확인 (스케줄 충돌 방지)
 */
export class MailScheduler {
  private globalTask: cron.ScheduledTask | null = null
  private currentInterval: number = 2 // 기본 2분
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

    // 글로벌 스케줄 시작
    await this.startGlobalSchedule()

    this.isInitialized = true
    logger.info('[MailScheduler] 초기화 완료')
  }

  /**
   * 글로벌 스케줄 시작 (단일 cron으로 모든 테넌트 처리)
   */
  async startGlobalSchedule() {
    logger.info('[MailScheduler] 글로벌 스케줄 시작')

    // 기존 스케줄 중지
    this.stopAll()

    // 활성화된 테넌트 설정 조회하여 최소 간격 결정
    const configs = await this.getActiveTenantConfigs()

    if (configs.length === 0) {
      logger.info('[MailScheduler] 활성 테넌트 없음 - 스케줄 대기')
      return
    }

    // 고정 2분 간격 사용 (모든 테넌트 동일)
    const FIXED_INTERVAL = 2
    this.currentInterval = FIXED_INTERVAL

    logger.info(`[MailScheduler] 활성 테넌트 ${configs.length}개, 고정 간격 ${FIXED_INTERVAL}분`)

    // 단일 글로벌 cron 등록
    const cronExpression = `*/${FIXED_INTERVAL} * * * *`

    this.globalTask = cron.schedule(
      cronExpression,
      async () => {
        const lock = await runWithAdvisoryLock({ key1: 51001, key2: 1 }, async () => {
          logger.info('[MailScheduler] 글로벌 스케줄 작업 실행', {
            intervalMinutes: FIXED_INTERVAL,
          })

          try {
            // 1. 예약된 메일 발송 처리 (모든 테넌트 대상)
            const scheduledResult = await processScheduledEmails()
            if (scheduledResult.processed > 0) {
              logger.info('[MailScheduler] 예약 메일 처리 완료', {
                processed: scheduledResult.processed,
                sent: scheduledResult.sent,
                failed: scheduledResult.failed,
              })
            }

            // 2. 모든 테넌트의 수신 메일 확인 (1회 호출)
            const results = await mailMonitorService.checkAllTenants()

            // 결과 요약 로깅
            let totalNew = 0
            let totalProcessed = 0
            let totalFailed = 0
            for (const [, result] of results.entries()) {
              totalNew += result.newMailsCount
              totalProcessed += result.processedCount
              totalFailed += result.failedCount
            }

            logger.info('[MailScheduler] 글로벌 스케줄 작업 완료', {
              tenantsProcessed: results.size,
              totalNewMails: totalNew,
              totalProcessed,
              totalFailed,
            })
          } catch (error) {
            logger.error('[MailScheduler] 글로벌 스케줄 작업 실패:', {
              error: error instanceof Error ? error.message : '알 수 없는 오류',
            })
          }
        })

        if (!lock.acquired) {
          logger.info('[MailScheduler] 다른 인스턴스가 실행 중 - 스킵', {
            intervalMinutes: FIXED_INTERVAL,
          })
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Seoul',
      }
    )

    logger.info('[MailScheduler] 글로벌 스케줄 등록 완료', {
      cronExpression,
      intervalMinutes: FIXED_INTERVAL,
    })
  }

  /**
   * 스케줄 재로드 (설정 변경 시 호출)
   */
  async reloadAllSchedules() {
    logger.info('[MailScheduler] 스케줄 재로드')
    await this.startGlobalSchedule()
  }

  /**
   * 특정 테넌트 설정 변경 시 호출 (하위 호환성 유지)
   * 실제로는 글로벌 스케줄을 재시작
   */
  scheduleForTenant(tenantId: string, intervalMinutes: number) {
    logger.info('[MailScheduler] 테넌트 설정 변경 감지 - 글로벌 스케줄 재시작', {
      tenantId,
      intervalMinutes,
    })
    // 글로벌 스케줄 재시작 (비동기)
    this.startGlobalSchedule().catch(err => {
      logger.error('[MailScheduler] 글로벌 스케줄 재시작 실패:', err)
    })
  }

  /**
   * 특정 테넌트 스케줄 중지 (하위 호환성 유지)
   */
  stopForTenant(tenantId: string) {
    logger.info('[MailScheduler] 테넌트 비활성화 감지 - 글로벌 스케줄 재시작', {
      tenantId,
    })
    // 글로벌 스케줄 재시작 (비동기)
    this.startGlobalSchedule().catch(err => {
      logger.error('[MailScheduler] 글로벌 스케줄 재시작 실패:', err)
    })
  }

  /**
   * 모든 스케줄 중지
   */
  stopAll() {
    if (this.globalTask) {
      this.globalTask.stop()
      this.globalTask = null
      logger.info('[MailScheduler] 글로벌 스케줄 중지')
    }
  }

  /**
   * 스케줄러 상태 조회
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.globalTask !== null,
      intervalMinutes: this.currentInterval,
    }
  }

  /**
   * 활성화된 테넌트 목록 조회 (메일 설정이 완료된 테넌트만)
   */
  private async getActiveTenantConfigs(): Promise<Array<{ tenantId: string }>> {
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
    const activeConfigs: Array<{ tenantId: string }> = []

    for (const [tenantId, config] of tenantConfigMap.entries()) {
      // 보안: 비밀번호, 사용자명 등 민감 정보 로깅 제외
      logger.debug(`[MailScheduler] 테넌트 ${tenantId} 설정 확인`, {
        enabled: config.enabled,
        hasHost: !!config.host,
        hasPort: !!config.port,
        hasCredentials: !!(config.username && config.password),
      })

      if (
        config.enabled === true &&
        config.host &&
        config.port &&
        config.username &&
        config.password
      ) {
        activeConfigs.push({ tenantId })
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
      tenants: activeConfigs.map(c => c.tenantId)
    })

    return activeConfigs
  }
}

// 싱글톤 인스턴스
export const mailScheduler = new MailScheduler()
