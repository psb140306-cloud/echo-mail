import { logger } from '@/lib/utils/logger'
import { PrismaClient, NotificationType, NotificationStatus } from '@prisma/client'

const prisma = new PrismaClient()

export interface NotificationJob {
  id: string
  type: NotificationType
  recipient: string
  message: string
  templateCode?: string
  variables?: Record<string, string>
  priority: 'low' | 'normal' | 'high' | 'urgent'
  scheduledAt?: Date
  maxRetries: number
  currentRetries: number
  companyId?: string
  contactId?: string
  metadata?: Record<string, any>
}

export interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  total: number
}

export class NotificationQueue {
  private isProcessing = false
  private processingInterval: NodeJS.Timeout | null = null
  private readonly BATCH_SIZE = 10
  private readonly PROCESS_INTERVAL = 5000 // 5초

  constructor() {}

  /**
   * 알림을 큐에 추가
   */
  async enqueue(notification: Omit<NotificationJob, 'id' | 'currentRetries'>): Promise<string> {
    try {
      // 데이터베이스에 알림 작업 저장 (실제 구현 시 NotificationLog 테이블 사용)
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      logger.info('알림 큐에 추가', {
        jobId,
        type: notification.type,
        recipient: notification.recipient,
        priority: notification.priority
      })

      // 메모리 기반 큐 (실제 구현에서는 Redis나 데이터베이스 사용)
      await this.saveToDatabase({
        ...notification,
        id: jobId,
        currentRetries: 0
      })

      return jobId

    } catch (error) {
      logger.error('알림 큐 추가 실패:', error)
      throw error
    }
  }

  /**
   * 대량 알림 추가
   */
  async enqueueBulk(notifications: Omit<NotificationJob, 'id' | 'currentRetries'>[]): Promise<string[]> {
    const jobIds: string[] = []

    for (const notification of notifications) {
      try {
        const jobId = await this.enqueue(notification)
        jobIds.push(jobId)
      } catch (error) {
        logger.error('대량 알림 추가 중 오류:', error)
      }
    }

    logger.info(`대량 알림 큐 추가 완료: ${jobIds.length}/${notifications.length}`)

    return jobIds
  }

  /**
   * 큐 처리 시작
   */
  async startProcessing(onProcess: (job: NotificationJob) => Promise<boolean>): Promise<void> {
    if (this.isProcessing) {
      logger.warn('알림 큐 처리가 이미 실행 중입니다')
      return
    }

    this.isProcessing = true
    logger.info('알림 큐 처리 시작')

    this.processingInterval = setInterval(async () => {
      try {
        await this.processJobs(onProcess)
      } catch (error) {
        logger.error('큐 처리 중 오류:', error)
      }
    }, this.PROCESS_INTERVAL)
  }

  /**
   * 큐 처리 중지
   */
  stopProcessing(): void {
    if (!this.isProcessing) {
      return
    }

    this.isProcessing = false

    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    logger.info('알림 큐 처리 중지')
  }

  /**
   * 작업 처리
   */
  private async processJobs(onProcess: (job: NotificationJob) => Promise<boolean>): Promise<void> {
    try {
      // 처리 대기 중인 작업 조회 (우선순위 순)
      const jobs = await this.getPendingJobs(this.BATCH_SIZE)

      if (jobs.length === 0) {
        return
      }

      logger.info(`${jobs.length}개 알림 작업 처리 시작`)

      for (const job of jobs) {
        try {
          // 작업 상태를 처리 중으로 변경
          await this.updateJobStatus(job.id, 'PROCESSING')

          // 작업 처리
          const success = await onProcess(job)

          if (success) {
            // 성공 시 완료 상태로 변경
            await this.updateJobStatus(job.id, 'SENT')
            logger.info(`알림 작업 완료: ${job.id}`)
          } else {
            // 실패 시 재시도 또는 실패 처리
            await this.handleJobFailure(job)
          }

        } catch (error) {
          logger.error(`알림 작업 처리 오류 (${job.id}):`, error)
          await this.handleJobFailure(job)
        }
      }

    } catch (error) {
      logger.error('작업 배치 처리 오류:', error)
    }
  }

  /**
   * 처리 대기 중인 작업 조회
   */
  private async getPendingJobs(limit: number): Promise<NotificationJob[]> {
    try {
      // 실제 구현에서는 데이터베이스에서 조회
      // 현재는 테스트용 빈 배열 반환
      return []

      // 예상 구현:
      // const notifications = await prisma.notificationLog.findMany({
      //   where: {
      //     status: 'PENDING',
      //     OR: [
      //       { scheduledAt: { lte: new Date() } },
      //       { scheduledAt: null }
      //     ]
      //   },
      //   orderBy: [
      //     { priority: 'desc' },
      //     { createdAt: 'asc' }
      //   ],
      //   take: limit
      // })
      //
      // return notifications.map(this.mapToJob)

    } catch (error) {
      logger.error('대기 중인 작업 조회 실패:', error)
      return []
    }
  }

  /**
   * 작업 실패 처리
   */
  private async handleJobFailure(job: NotificationJob): Promise<void> {
    try {
      const newRetryCount = job.currentRetries + 1

      if (newRetryCount >= job.maxRetries) {
        // 최대 재시도 횟수 초과 시 실패 처리
        await this.updateJobStatus(job.id, 'FAILED')
        logger.warn(`알림 작업 최종 실패: ${job.id} (재시도: ${newRetryCount}/${job.maxRetries})`)
      } else {
        // 재시도 스케줄링
        const retryDelay = this.calculateRetryDelay(newRetryCount)
        const retryAt = new Date(Date.now() + retryDelay)

        await this.updateJobRetry(job.id, newRetryCount, retryAt)
        logger.info(`알림 작업 재시도 스케줄: ${job.id} (${newRetryCount}/${job.maxRetries}) at ${retryAt.toISOString()}`)
      }

    } catch (error) {
      logger.error(`작업 실패 처리 오류 (${job.id}):`, error)
    }
  }

  /**
   * 재시도 지연 시간 계산 (지수 백오프)
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = 60000 // 1분
    const maxDelay = 3600000 // 1시간

    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay)
    return delay
  }

  /**
   * 작업 상태 업데이트
   */
  private async updateJobStatus(jobId: string, status: NotificationStatus): Promise<void> {
    try {
      // 실제 구현에서는 데이터베이스 업데이트
      logger.debug(`작업 상태 업데이트: ${jobId} -> ${status}`)

      // await prisma.notificationLog.update({
      //   where: { id: jobId },
      //   data: { status }
      // })

    } catch (error) {
      logger.error(`작업 상태 업데이트 실패 (${jobId}):`, error)
    }
  }

  /**
   * 작업 재시도 정보 업데이트
   */
  private async updateJobRetry(jobId: string, retryCount: number, retryAt: Date): Promise<void> {
    try {
      // 실제 구현에서는 데이터베이스 업데이트
      logger.debug(`작업 재시도 정보 업데이트: ${jobId}`)

      // await prisma.notificationLog.update({
      //   where: { id: jobId },
      //   data: {
      //     currentRetries: retryCount,
      //     scheduledAt: retryAt,
      //     status: 'PENDING'
      //   }
      // })

    } catch (error) {
      logger.error(`작업 재시도 정보 업데이트 실패 (${jobId}):`, error)
    }
  }

  /**
   * 데이터베이스에 작업 저장
   */
  private async saveToDatabase(job: NotificationJob): Promise<void> {
    try {
      // 실제 구현에서는 NotificationLog 테이블에 저장
      logger.debug(`작업 데이터베이스 저장: ${job.id}`)

      // await prisma.notificationLog.create({
      //   data: {
      //     id: job.id,
      //     type: job.type,
      //     recipient: job.recipient,
      //     message: job.message,
      //     templateCode: job.templateCode,
      //     variables: job.variables ? JSON.stringify(job.variables) : null,
      //     priority: job.priority,
      //     scheduledAt: job.scheduledAt,
      //     maxRetries: job.maxRetries,
      //     currentRetries: job.currentRetries,
      //     companyId: job.companyId,
      //     contactId: job.contactId,
      //     metadata: job.metadata ? JSON.stringify(job.metadata) : null,
      //     status: 'PENDING'
      //   }
      // })

    } catch (error) {
      logger.error(`작업 데이터베이스 저장 실패 (${job.id}):`, error)
      throw error
    }
  }

  /**
   * 큐 통계 조회
   */
  async getStats(): Promise<QueueStats> {
    try {
      // 실제 구현에서는 데이터베이스에서 집계
      const stats: QueueStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0
      }

      // const result = await prisma.notificationLog.groupBy({
      //   by: ['status'],
      //   _count: {
      //     status: true
      //   }
      // })
      //
      // result.forEach(item => {
      //   const count = item._count.status
      //   switch (item.status) {
      //     case 'PENDING':
      //       stats.pending = count
      //       break
      //     case 'PROCESSING':
      //       stats.processing = count
      //       break
      //     case 'SENT':
      //       stats.completed = count
      //       break
      //     case 'FAILED':
      //       stats.failed = count
      //       break
      //   }
      // })
      //
      // stats.total = stats.pending + stats.processing + stats.completed + stats.failed

      return stats

    } catch (error) {
      logger.error('큐 통계 조회 실패:', error)
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0
      }
    }
  }

  /**
   * 특정 작업 취소
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      await this.updateJobStatus(jobId, 'FAILED')
      logger.info(`알림 작업 취소: ${jobId}`)
      return true

    } catch (error) {
      logger.error(`작업 취소 실패 (${jobId}):`, error)
      return false
    }
  }

  /**
   * 처리 상태 확인
   */
  get processing(): boolean {
    return this.isProcessing
  }
}

// 싱글톤 인스턴스
export const notificationQueue = new NotificationQueue()