import { logger } from '@/lib/utils/logger'
import { mailScheduler } from './mail-scheduler'
import { notificationRetryScheduler } from './notification-retry-scheduler'
import { announcementScheduler } from './announcement-scheduler'

/**
 * 스케줄러 초기화
 * 앱 시작 시 자동으로 호출됨
 */
export async function initializeSchedulers() {
  try {
    logger.info('[Scheduler] 스케줄러 초기화 시작')

    // 메일 스케줄러 초기화
    await mailScheduler.initialize()

    // 알림 재시도 스케줄러 초기화
    await notificationRetryScheduler.initialize()

    // 예약 공지 발송 스케줄러 초기화
    await announcementScheduler.initialize()

    logger.info('[Scheduler] 스케줄러 초기화 완료')
  } catch (error) {
    logger.error('[Scheduler] 스케줄러 초기화 실패:', error)
    // 스케줄러 실패해도 앱은 계속 실행되어야 함
  }
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    logger.info('[Scheduler] SIGTERM 수신, 스케줄러 종료')
    mailScheduler.stopAll()
    notificationRetryScheduler.stop()
    announcementScheduler.stop()
  })

  process.on('SIGINT', () => {
    logger.info('[Scheduler] SIGINT 수신, 스케줄러 종료')
    mailScheduler.stopAll()
    notificationRetryScheduler.stop()
    announcementScheduler.stop()
  })
}
