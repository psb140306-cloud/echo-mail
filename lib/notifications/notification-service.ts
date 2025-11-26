import { NotificationType, PrismaClient } from '@prisma/client'
import { logger } from '@/lib/utils/logger'
import { SMSProvider, createSMSProviderFromEnv, SMSMessage } from './sms/sms-provider'
import { KakaoProvider, createKakaoProviderFromEnv, KakaoMessage } from './kakao/kakao-provider'
import { notificationQueue, NotificationJob } from './queue/notification-queue'
import { templateManager, renderNotificationTemplate } from './templates/template-manager'
import { calculateDeliveryDate } from '@/lib/utils/delivery-calculator'
import {
  UsageTracker,
  UsageType,
  trackSMSUsage,
  trackKakaoUsage,
  checkNotificationLimit,
} from '@/lib/usage/usage-tracker'
import { TenantContext } from '@/lib/db'

const prisma = new PrismaClient()

export interface NotificationRequest {
  type: NotificationType
  recipient: string
  templateName: string
  variables: Record<string, string>
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  scheduledAt?: Date
  companyId?: string
  contactId?: string
  enableFailover?: boolean
  tenantId?: string // 선택적 tenantId (미들웨어에서 전달)
  emailLogId?: string // 이메일 로그 ID (중복 발송 방지)
}

export interface NotificationResult {
  success: boolean
  messageId?: string
  error?: string
  provider?: string
  failoverUsed?: boolean
}

export interface BulkNotificationRequest {
  notifications: NotificationRequest[]
  batchSize?: number
}

export interface BulkNotificationResult {
  totalCount: number
  successCount: number
  failureCount: number
  results: NotificationResult[]
}

export class NotificationService {
  private smsProvider: SMSProvider | null = null
  private kakaoProvider: KakaoProvider | null = null
  private isQueueProcessing = false
  private initialized = false

  /**
   * 한국 시간대 기준으로 날짜의 연/월/일/시/분 추출
   */
  private getKSTComponents(date: Date) {
    const kstString = date.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

    const parts = kstString.split(', ')
    const datePart = parts[0].split('/')  // MM/DD/YYYY
    const timePart = parts[1].split(':')  // HH:MM

    return {
      year: parseInt(datePart[2]),
      month: parseInt(datePart[0]) - 1,  // JS month is 0-indexed
      day: parseInt(datePart[1]),
      hours: parseInt(timePart[0]),
      minutes: parseInt(timePart[1])
    }
  }

  /**
   * 시간 문자열을 분 단위로 변환
   */
  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number)
    return hours * 60 + minutes
  }

  private initialize() {
    if (this.initialized) return

    try {
      // SMS Provider 초기화 (fallback용 - 환경변수)
      this.smsProvider = createSMSProviderFromEnv()

      // Kakao Provider 초기화 (선택적)
      try {
        this.kakaoProvider = createKakaoProviderFromEnv()
      } catch (kakaoError) {
        logger.info('카카오 Provider 초기화 실패 (선택사항이므로 계속 진행)', kakaoError)
        this.kakaoProvider = null
      }

      this.initialized = true
    } catch (error) {
      logger.error('SMS Provider 초기화 실패:', error)
      throw error
    }
  }

  /**
   * SMS Provider 가져오기 (환경변수만 사용)
   */
  private async getTenantSMSProvider(_tenantId: string): Promise<SMSProvider> {
    // 환경변수에서 생성한 Provider를 그대로 사용
    // 테넌트별 구분 없이 시스템 전역 SMS 설정 사용
    logger.info('[NotificationService] SMS Provider 사용 (환경변수)')
    return this.smsProvider!
  }

  /**
   * 즉시 알림 발송
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResult> {
    try {
      // 초기화 (최초 1회만 실행)
      this.initialize()

      // 테넌트 ID 가져오기: 파라미터 우선, 없으면 컨텍스트에서
      let tenantId = request.tenantId

      if (!tenantId) {
        const tenantContext = TenantContext.getInstance()
        tenantId = tenantContext.getTenantId()
      }

      if (!tenantId) {
        throw new Error('테넌트 컨텍스트가 설정되지 않았습니다.')
      }

      // 사용량 제한 체크
      const limitCheck = await checkNotificationLimit(tenantId)
      if (!limitCheck.allowed) {
        logger.warn('알림 발송 제한 초과', {
          tenantId,
          type: request.type,
          currentUsage: limitCheck.currentUsage,
          limit: limitCheck.limit,
          message: limitCheck.message,
        })

        return {
          success: false,
          error:
            limitCheck.message ||
            '월 알림 발송 한도를 초과했습니다. 플랜 업그레이드를 고려해주세요.',
          provider: 'usage_limiter',
        }
      }

      logger.info('알림 발송 시작', {
        tenantId,
        type: request.type,
        recipient: request.recipient,
        template: request.templateName,
        currentUsage: limitCheck.currentUsage,
        limit: limitCheck.limit,
      })

      // 템플릿 렌더링
      const rendered = await renderNotificationTemplate(
        request.templateName,
        request.variables,
        request.type,
        tenantId
      )

      // 발송 타입별 처리
      let result: NotificationResult

      switch (request.type) {
        case NotificationType.SMS:
          result = await this.sendSMS({
            to: request.recipient,
            message: rendered.content,
            subject: rendered.subject,
          }, tenantId)
          break

        case NotificationType.KAKAO_ALIMTALK:
          // 카카오 Provider가 없으면 즉시 SMS로 폴백
          if (!this.kakaoProvider) {
            logger.info('카카오 Provider 미설정, SMS로 폴백', {
              recipient: request.recipient,
            })

            result = await this.sendSMS({
              to: request.recipient,
              message: rendered.content,
            }, tenantId)

            if (result.success) {
              result = {
                ...result,
                failoverUsed: true,
                provider: 'SMS(카카오 미설정으로 폴백)',
              }
            }
            break
          }

          result = await this.sendKakaoAlimTalk({
            to: request.recipient,
            templateCode: request.templateName,
            message: rendered.content,
            variables: request.variables,
          })

          // 카카오 실패 시 SMS 폴백
          if (!result.success && request.enableFailover) {
            logger.info('카카오 알림톡 실패, SMS 폴백 시도', {
              recipient: request.recipient,
              error: result.error,
            })

            const smsResult = await this.sendSMS({
              to: request.recipient,
              message: rendered.content,
            }, tenantId)

            if (smsResult.success) {
              result = {
                ...smsResult,
                failoverUsed: true,
                provider: 'SMS(폴백)',
              }
            }
          }
          break

        case NotificationType.KAKAO_FRIENDTALK:
          // 카카오 Provider가 없으면 즉시 SMS로 폴백
          if (!this.kakaoProvider) {
            logger.info('카카오 Provider 미설정, SMS로 폴백', {
              recipient: request.recipient,
            })

            result = await this.sendSMS({
              to: request.recipient,
              message: rendered.content,
            }, tenantId)

            if (result.success) {
              result = {
                ...result,
                failoverUsed: true,
                provider: 'SMS(카카오 미설정으로 폴백)',
              }
            }
            break
          }

          result = await this.sendKakaoFriendTalk({
            to: request.recipient,
            message: rendered.content,
          })
          break

        default:
          throw new Error(`지원하지 않는 알림 타입: ${request.type}`)
      }

      // 발송 성공시 사용량 추적
      if (result.success) {
        const usageMetadata = {
          recipient: request.recipient,
          templateName: request.templateName,
          provider: result.provider,
          messageId: result.messageId,
          companyId: request.companyId,
          contactId: request.contactId,
        }

        // 타입별 사용량 추적
        switch (request.type) {
          case NotificationType.SMS:
            await trackSMSUsage(tenantId, 1, usageMetadata)
            break
          case NotificationType.KAKAO_ALIMTALK:
          case NotificationType.KAKAO_FRIENDTALK:
            await trackKakaoUsage(tenantId, 1, usageMetadata)
            break
        }

        // 폴백 사용시 SMS 사용량도 추가
        if (result.failoverUsed) {
          await trackSMSUsage(tenantId, 1, { ...usageMetadata, fallback: true })
        }

        logger.debug('사용량 추적 완료', {
          tenantId,
          type: request.type,
          failoverUsed: result.failoverUsed,
        })
      }

      // 발송 로그 저장
      await this.logNotification(request, result, rendered.content)

      logger.info('알림 발송 완료', {
        tenantId,
        type: request.type,
        recipient: request.recipient,
        success: result.success,
        provider: result.provider,
        failoverUsed: result.failoverUsed,
      })

      return result
    } catch (error) {
      logger.error('알림 발송 실패:', error)

      const errorResult: NotificationResult = {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }

      await this.logNotification(request, errorResult)

      return errorResult
    }
  }

  /**
   * 큐를 통한 비동기 알림 발송
   */
  async queueNotification(request: NotificationRequest): Promise<string> {
    try {
      const job: Omit<NotificationJob, 'id' | 'currentRetries'> = {
        type: request.type,
        recipient: request.recipient,
        message: '', // 큐 처리 시 템플릿 렌더링
        templateCode: request.templateName,
        variables: request.variables,
        priority: request.priority || 'normal',
        scheduledAt: request.scheduledAt,
        maxRetries: this.getMaxRetries(request.type),
        companyId: request.companyId,
        contactId: request.contactId,
        metadata: {
          enableFailover: request.enableFailover,
        },
      }

      const jobId = await notificationQueue.enqueue(job)

      logger.info('알림 큐 등록 완료', {
        jobId,
        type: request.type,
        recipient: request.recipient,
        template: request.templateName,
      })

      return jobId
    } catch (error) {
      logger.error('알림 큐 등록 실패:', error)
      throw error
    }
  }

  /**
   * 대량 알림 발송
   */
  async sendBulkNotifications(request: BulkNotificationRequest): Promise<BulkNotificationResult> {
    const batchSize = request.batchSize || 50
    const results: NotificationResult[] = []
    let successCount = 0
    let failureCount = 0

    logger.info(`대량 알림 발송 시작: ${request.notifications.length}개`, { batchSize })

    // 배치 단위로 처리
    for (let i = 0; i < request.notifications.length; i += batchSize) {
      const batch = request.notifications.slice(i, i + batchSize)

      const batchResults = await Promise.allSettled(
        batch.map((notification) => this.sendNotification(notification))
      )

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
          if (result.value.success) {
            successCount++
          } else {
            failureCount++
          }
        } else {
          results.push({
            success: false,
            error: result.reason?.message || '알 수 없는 오류',
          })
          failureCount++
        }
      })

      // 배치 간 간격 (Rate Limiting)
      if (i + batchSize < request.notifications.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    logger.info('대량 알림 발송 완료', {
      total: request.notifications.length,
      success: successCount,
      failure: failureCount,
    })

    return {
      totalCount: request.notifications.length,
      successCount,
      failureCount,
      results,
    }
  }

  /**
   * 발주 접수 알림 발송 (비즈니스 로직)
   */
  async sendOrderReceivedNotification(
    companyId: string,
    orderDateTime?: Date,
    emailLogId?: string
  ): Promise<NotificationResult[]> {
    try {
      // 업체 및 담당자 정보 조회
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          contacts: {
            where: { isActive: true },
          },
        },
      })

      if (!company) {
        throw new Error('업체를 찾을 수 없습니다')
      }

      // 중복 발송 체크: emailLogId가 있으면 해당 메일에 대한 발송 이력 확인
      if (emailLogId) {
        const existingNotification = await prisma.notificationLog.findFirst({
          where: {
            emailLogId,
            tenantId: company.tenantId,
            status: 'SENT',
          },
        })

        if (existingNotification) {
          logger.warn('[중복 발송 방지] 동일 메일에 대한 발송 이력 존재', {
            emailLogId,
            notificationId: existingNotification.id,
            sentAt: existingNotification.createdAt,
          })
          return [] // 빈 배열 반환하여 중복 발송 방지
        }
      }

      // 납품일 계산 (이메일 수신 시간 또는 현재 시간 사용)
      const deliveryResult = await calculateDeliveryDate({
        region: company.region,
        orderDateTime: orderDateTime || new Date(),
        tenantId: company.tenantId,
      })

      // 배송 시간대는 deliveryResult에 이미 계산되어 있음
      const deliveryTime = deliveryResult.deliveryTime || '미정'

      // 날짜 포맷 준비 (한국 시간대 기준)
      const deliveryDate = deliveryResult.deliveryDate
      const weekdays = ['일', '월', '화', '수', '목', '금', '토']

      // 한국 시간대로 날짜 컴포넌트 추출
      const kstDateString = deliveryDate.toLocaleString('en-US', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false
      })

      const parts = kstDateString.split(', ')
      const datePart = parts[0].split('/') // MM/DD/YYYY
      const kstMonth = parseInt(datePart[0])
      const kstDay = parseInt(datePart[1])
      const kstYear = parseInt(datePart[2])

      // 요일 계산 - KST 타임존으로 Date를 파싱해서 정확한 요일 추출
      // UTC Date를 만들고 KST 오프셋(+9시간)을 적용한 날짜로 요일 계산
      const kstDate = new Date(`${kstYear}-${String(kstMonth).padStart(2, '0')}-${String(kstDay).padStart(2, '0')}T12:00:00+09:00`)
      const kstDayOfWeek = kstDate.getUTCDay()

      const variables = {
        companyName: company.name,
        deliveryDate: deliveryDate.toLocaleDateString('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        }),
        // SMS용 짧은 날짜 형식 (예: 11/18(월)) - 한국 시간 기준
        shortDate: `${kstMonth}/${kstDay}(${weekdays[kstDayOfWeek]})`,
        // 배송 시간대 - "미정"일 경우 공백 처리 (11/19(수) 배송 예정)
        deliveryTime: deliveryTime === '미정' ? '' : ` ${deliveryTime}`,
      }

      const results: NotificationResult[] = []

      // 활성 담당자들에게 알림 발송
      for (const contact of company.contacts) {
        let smsAlreadySent = false // SMS 중복 발송 방지 플래그

        // 디버그: 담당자별 알림 설정 로깅
        logger.info('[알림 발송] 담당자 처리 시작', {
          contactId: contact.id,
          contactName: contact.name,
          phone: contact.phone,
          kakaoEnabled: contact.kakaoEnabled,
          smsEnabled: contact.smsEnabled,
          hasKakaoProvider: !!this.kakaoProvider,
        })

        // 카카오 알림톡 우선 시도
        if (contact.kakaoEnabled) {
          const kakaoResult = await this.sendNotification({
            type: NotificationType.KAKAO_ALIMTALK,
            recipient: contact.phone,
            templateName: 'ORDER_RECEIVED_KAKAO',
            variables,
            companyId: company.id,
            contactId: contact.id,
            tenantId: company.tenantId,
            enableFailover: contact.smsEnabled,
            emailLogId, // 이메일 로그 ID 전달
          })

          results.push(kakaoResult)

          // 카카오 성공 또는 SMS 폴백이 시도된 경우 (성공/실패 무관) SMS 스킵
          // failoverUsed가 true면 이미 SMS 발송 시도됨
          // kakaoProvider가 null이면 내부적으로 SMS로 폴백 시도됨
          if (kakaoResult.success || kakaoResult.failoverUsed || kakaoResult.provider?.includes('SMS')) {
            smsAlreadySent = true
          }

          // 카카오 성공 시 완전히 스킵
          if (kakaoResult.success || kakaoResult.failoverUsed) {
            continue
          }
        }

        // SMS 발송 (shortDate 사용으로 90바이트 이하 유지)
        // 단, 이미 SMS 폴백이 시도된 경우 스킵
        if (contact.smsEnabled && !smsAlreadySent) {
          const smsResult = await this.sendNotification({
            type: NotificationType.SMS,
            recipient: contact.phone,
            templateName: 'ORDER_RECEIVED_SMS',
            variables, // shortDate가 포함된 variables 사용
            companyId: company.id,
            contactId: contact.id,
            tenantId: company.tenantId,
            emailLogId, // 이메일 로그 ID 전달
          })

          results.push(smsResult)
        }
      }

      logger.info('발주 접수 알림 발송 완료', {
        companyId,
        companyName: company.name,
        contactCount: company.contacts.length,
        notificationCount: results.length,
        successCount: results.filter((r) => r.success).length,
      })

      return results
    } catch (error) {
      logger.error('발주 접수 알림 발송 실패:', error)
      throw error
    }
  }

  /**
   * SMS 발송
   */
  private async sendSMS(message: SMSMessage, tenantId?: string): Promise<NotificationResult> {
    try {
      if (!this.smsProvider) {
        throw new Error('SMS provider가 초기화되지 않았습니다')
      }

      // 테넌트별 SMS Provider 사용 (발신번호 포함)
      let provider = this.smsProvider
      if (tenantId) {
        provider = await this.getTenantSMSProvider(tenantId)
      }

      const result = await provider.sendSMS(message)

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        provider: 'SMS',
      }
    } catch (error) {
      logger.error('SMS 발송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        provider: 'SMS',
      }
    }
  }

  /**
   * 카카오 알림톡 발송
   */
  private async sendKakaoAlimTalk(message: KakaoMessage): Promise<NotificationResult> {
    try {
      if (!this.kakaoProvider) {
        throw new Error('Kakao provider가 초기화되지 않았습니다')
      }
      const result = await this.kakaoProvider.sendAlimTalk(message)

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        provider: 'KakaoAlimTalk',
      }
    } catch (error) {
      logger.error('카카오 알림톡 발송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        provider: 'KakaoAlimTalk',
      }
    }
  }

  /**
   * 카카오 친구톡 발송
   */
  private async sendKakaoFriendTalk(
    message: Omit<KakaoMessage, 'templateCode'>
  ): Promise<NotificationResult> {
    try {
      if (!this.kakaoProvider) {
        throw new Error('Kakao provider가 초기화되지 않았습니다')
      }
      const result = await this.kakaoProvider.sendFriendTalk(message)

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        provider: 'KakaoFriendTalk',
      }
    } catch (error) {
      logger.error('카카오 친구톡 발송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        provider: 'KakaoFriendTalk',
      }
    }
  }

  /**
   * 알림 발송 로그 저장
   */
  private async logNotification(
    request: NotificationRequest,
    result: NotificationResult,
    renderedMessage?: string
  ): Promise<void> {
    try {
      logger.debug('알림 로그 저장', {
        type: request.type,
        recipient: request.recipient,
        template: request.templateName,
        success: result.success,
        provider: result.provider,
      })

      // NotificationLog 테이블에 저장
      await prisma.notificationLog.create({
        data: {
          type: request.type,
          recipient: request.recipient,
          message: renderedMessage || JSON.stringify(request.variables), // 렌더링된 메시지 또는 변수
          status: result.success ? 'SENT' : 'FAILED',
          errorMessage: result.error,
          companyId: request.companyId,
          tenantId: request.tenantId || '',
          emailLogId: request.emailLogId, // 이메일 로그 연결
          // createdAt 제거 - 자동으로 설정됨
        },
      })
    } catch (error) {
      logger.error('알림 로그 저장 실패:', error)
    }
  }

  /**
   * 알림 타입별 최대 재시도 횟수
   */
  private getMaxRetries(type: NotificationType): number {
    switch (type) {
      case NotificationType.SMS:
        return 3
      case NotificationType.KAKAO_ALIMTALK:
      case NotificationType.KAKAO_FRIENDTALK:
        return 2
      default:
        return 1
    }
  }

  /**
   * 큐 처리 시작
   */
  async startQueueProcessing(): Promise<void> {
    if (this.isQueueProcessing) {
      logger.warn('알림 큐 처리가 이미 실행 중입니다')
      return
    }

    this.isQueueProcessing = true

    await notificationQueue.startProcessing(async (job: NotificationJob) => {
      try {
        // 템플릿 렌더링
        const rendered = await renderNotificationTemplate(
          job.templateCode!,
          job.variables || {},
          job.type
        )

        // 알림 발송
        const request: NotificationRequest = {
          type: job.type,
          recipient: job.recipient,
          templateName: job.templateCode!,
          variables: job.variables || {},
          companyId: job.companyId,
          contactId: job.contactId,
          enableFailover: job.metadata?.enableFailover,
        }

        const result = await this.sendNotification(request)

        return result.success
      } catch (error) {
        logger.error(`큐 작업 처리 실패 (${job.id}):`, error)
        return false
      }
    })

    logger.info('알림 큐 처리 시작 완료')
  }

  /**
   * 큐 처리 중지
   */
  stopQueueProcessing(): void {
    if (!this.isQueueProcessing) {
      return
    }

    notificationQueue.stopProcessing()
    this.isQueueProcessing = false

    logger.info('알림 큐 처리 중지 완료')
  }

  /**
   * 서비스 상태 조회
   */
  async getStatus() {
    this.initialize()

    const [smsBalance, queueStats] = await Promise.all([
      this.smsProvider?.getBalance().catch(() => 0) || Promise.resolve(0),
      notificationQueue.getStats(),
    ])

    return {
      sms: {
        provider: 'aligo',
        balance: smsBalance,
        available: smsBalance > 0,
      },
      kakao: {
        provider: 'kakao',
        available: await (this.kakaoProvider?.validateConfig() || Promise.resolve(false)),
      },
      queue: {
        processing: this.isQueueProcessing,
        stats: queueStats,
      },
    }
  }
}

// 싱글톤 인스턴스
export const notificationService = new NotificationService()

// 편의 함수들
export async function sendNotification(request: NotificationRequest): Promise<NotificationResult> {
  return notificationService.sendNotification(request)
}

export async function queueNotification(request: NotificationRequest): Promise<string> {
  return notificationService.queueNotification(request)
}

export async function sendOrderReceivedNotification(
  companyId: string,
  orderDateTime?: Date,
  emailLogId?: string
): Promise<NotificationResult[]> {
  return notificationService.sendOrderReceivedNotification(companyId, orderDateTime, emailLogId)
}
