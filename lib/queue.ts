import Queue from 'bull'
import { queueRedis } from './redis'

// 큐 설정
const defaultJobOptions = {
  removeOnComplete: 10, // 완료된 작업 10개만 보관
  removeOnFail: 50, // 실패한 작업 50개만 보관
  attempts: 3, // 기본 재시도 횟수
  backoff: {
    type: 'exponential',
    delay: 2000, // 2초부터 시작하여 지수적으로 증가
  },
}

// =============================================================================
// 알림 발송 큐
// =============================================================================
export const notificationQueue = new Queue('notification', {
  redis: {
    host: queueRedis.options.host,
    port: queueRedis.options.port,
    password: queueRedis.options.password,
  },
  defaultJobOptions,
})

// 알림 발송 작업 타입
export interface NotificationJob {
  type: 'SMS' | 'KAKAO_ALIMTALK' | 'KAKAO_FRIENDTALK'
  recipient: string
  message: string
  companyId?: string
  emailLogId?: string
  templateData?: Record<string, any>
  priority?: number
}

// SMS 발송 작업 추가
export const addSmsJob = async (
  data: Omit<NotificationJob, 'type'>,
  options?: Queue.JobOptions
) => {
  return await notificationQueue.add(
    'send-sms',
    { ...data, type: 'SMS' },
    {
      priority: data.priority || 1,
      delay: options?.delay || 0,
      ...options,
    }
  )
}

// 카카오톡 알림톡 발송 작업 추가
export const addKakaoAlimtalkJob = async (
  data: Omit<NotificationJob, 'type'>,
  options?: Queue.JobOptions
) => {
  return await notificationQueue.add(
    'send-kakao-alimtalk',
    { ...data, type: 'KAKAO_ALIMTALK' },
    {
      priority: data.priority || 2,
      delay: options?.delay || 0,
      ...options,
    }
  )
}

// 카카오톡 친구톡 발송 작업 추가
export const addKakaoFriendtalkJob = async (
  data: Omit<NotificationJob, 'type'>,
  options?: Queue.JobOptions
) => {
  return await notificationQueue.add(
    'send-kakao-friendtalk',
    { ...data, type: 'KAKAO_FRIENDTALK' },
    {
      priority: data.priority || 3,
      delay: options?.delay || 0,
      ...options,
    }
  )
}

// =============================================================================
// 메일 처리 큐
// =============================================================================
export const emailQueue = new Queue('email', {
  redis: {
    host: queueRedis.options.host,
    port: queueRedis.options.port,
    password: queueRedis.options.password,
  },
  defaultJobOptions,
})

// 메일 처리 작업 타입
export interface EmailJob {
  messageId: string
  subject: string
  sender: string
  recipient: string
  receivedAt: Date
  hasAttachment: boolean
  attachments?: Array<{
    filename: string
    contentType: string
    size: number
  }>
}

// 메일 처리 작업 추가
export const addEmailProcessJob = async (data: EmailJob, options?: Queue.JobOptions) => {
  return await emailQueue.add('process-email', data, {
    priority: 1,
    delay: options?.delay || 0,
    ...options,
  })
}

// =============================================================================
// 스케줄 작업 큐
// =============================================================================
export const scheduleQueue = new Queue('schedule', {
  redis: {
    host: queueRedis.options.host,
    port: queueRedis.options.port,
    password: queueRedis.options.password,
  },
  defaultJobOptions,
})

// 스케줄 작업 타입
export interface ScheduleJob {
  type: 'cleanup' | 'health-check' | 'report'
  data?: Record<string, any>
}

// 정리 작업 스케줄링
export const scheduleCleanupJob = async () => {
  return await scheduleQueue.add(
    'cleanup',
    { type: 'cleanup' },
    {
      repeat: { cron: '0 2 * * *' }, // 매일 오전 2시
    }
  )
}

// 헬스체크 작업 스케줄링
export const scheduleHealthCheckJob = async () => {
  return await scheduleQueue.add(
    'health-check',
    { type: 'health-check' },
    {
      repeat: { every: 5 * 60 * 1000 }, // 5분마다
    }
  )
}

// 일일 리포트 작업 스케줄링
export const scheduleDailyReportJob = async () => {
  return await scheduleQueue.add(
    'daily-report',
    { type: 'report' },
    {
      repeat: { cron: '0 9 * * *' }, // 매일 오전 9시
    }
  )
}

// =============================================================================
// 큐 모니터링 및 관리
// =============================================================================

// 큐 상태 조회
export const getQueueStats = async () => {
  const [notificationStats, emailStats, scheduleStats] = await Promise.all([
    {
      waiting: await notificationQueue.waiting(),
      active: await notificationQueue.active(),
      completed: await notificationQueue.completed(),
      failed: await notificationQueue.failed(),
      delayed: await notificationQueue.delayed(),
    },
    {
      waiting: await emailQueue.waiting(),
      active: await emailQueue.active(),
      completed: await emailQueue.completed(),
      failed: await emailQueue.failed(),
      delayed: await emailQueue.delayed(),
    },
    {
      waiting: await scheduleQueue.waiting(),
      active: await scheduleQueue.active(),
      completed: await scheduleQueue.completed(),
      failed: await scheduleQueue.failed(),
      delayed: await scheduleQueue.delayed(),
    },
  ])

  return {
    notification: {
      waiting: notificationStats.waiting.length,
      active: notificationStats.active.length,
      completed: notificationStats.completed.length,
      failed: notificationStats.failed.length,
      delayed: notificationStats.delayed.length,
    },
    email: {
      waiting: emailStats.waiting.length,
      active: emailStats.active.length,
      completed: emailStats.completed.length,
      failed: emailStats.failed.length,
      delayed: emailStats.delayed.length,
    },
    schedule: {
      waiting: scheduleStats.waiting.length,
      active: scheduleStats.active.length,
      completed: scheduleStats.completed.length,
      failed: scheduleStats.failed.length,
      delayed: scheduleStats.delayed.length,
    },
  }
}

// 실패한 작업 재시도
export const retryFailedJobs = async (queueName: 'notification' | 'email' | 'schedule') => {
  const queue =
    queueName === 'notification'
      ? notificationQueue
      : queueName === 'email'
        ? emailQueue
        : scheduleQueue

  const failed = await queue.failed()
  let retried = 0

  for (const job of failed) {
    try {
      await job.retry()
      retried++
    } catch (error) {
      console.error(`Failed to retry job ${job.id}:`, error)
    }
  }

  return retried
}

// 큐 정리
export const cleanQueue = async (queueName: 'notification' | 'email' | 'schedule') => {
  const queue =
    queueName === 'notification'
      ? notificationQueue
      : queueName === 'email'
        ? emailQueue
        : scheduleQueue

  await Promise.all([
    queue.clean(24 * 60 * 60 * 1000, 'completed'), // 24시간 이상 된 완료 작업 삭제
    queue.clean(7 * 24 * 60 * 60 * 1000, 'failed'), // 7일 이상 된 실패 작업 삭제
  ])
}

// 큐 초기화 (개발/테스트용)
export const initializeQueues = async () => {
  // 기본 스케줄 작업 등록
  await scheduleCleanupJob()
  await scheduleHealthCheckJob()
  await scheduleDailyReportJob()

  console.log('✅ 큐 초기화 완료')
}

// 큐 종료
export const closeQueues = async () => {
  await Promise.all([notificationQueue.close(), emailQueue.close(), scheduleQueue.close()])

  console.log('✅ 큐 종료 완료')
}

export { notificationQueue, emailQueue, scheduleQueue }
