import { NotificationType } from '@prisma/client'
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
import { prisma, TenantContext } from '@/lib/db'

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
  errorCode?: string // 에러 코드 (TIMEOUT, AUTH_ERROR, NETWORK_ERROR 등)
  provider?: string
  failoverUsed?: boolean
}

// 에러 코드 정의
export const ErrorCodes = {
  // 확실한 실패 (재시도 불가)
  AUTH_ERROR: 'AUTH_ERROR',           // 인증 오류
  INVALID_PARAMS: 'INVALID_PARAMS',   // 잘못된 파라미터
  INVALID_PHONE: 'INVALID_PHONE',     // 잘못된 전화번호
  BLOCKED: 'BLOCKED',                 // 수신 거부
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',   // 할당량 초과

  // 불확실한 실패 (재시도 가능)
  TIMEOUT: 'TIMEOUT',                 // 타임아웃
  NETWORK_ERROR: 'NETWORK_ERROR',     // 네트워크 오류
  SERVER_ERROR: 'SERVER_ERROR',       // 서버 오류 (5xx)
  UNKNOWN: 'UNKNOWN',                 // 알 수 없는 오류
} as const

// 재시도 가능한 에러 코드
const RETRYABLE_ERROR_CODES = [
  ErrorCodes.TIMEOUT,
  ErrorCodes.NETWORK_ERROR,
  ErrorCodes.SERVER_ERROR,
  ErrorCodes.UNKNOWN,
]

// 에러 메시지로부터 에러 코드 추출
function classifyError(error: string | Error): string {
  const errorMsg = typeof error === 'string' ? error.toLowerCase() : error.message.toLowerCase()

  if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('timedout')) {
    return ErrorCodes.TIMEOUT
  }
  if (errorMsg.includes('auth') || errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
    return ErrorCodes.AUTH_ERROR
  }
  if (errorMsg.includes('invalid') && (errorMsg.includes('phone') || errorMsg.includes('number'))) {
    return ErrorCodes.INVALID_PHONE
  }
  if (errorMsg.includes('invalid') || errorMsg.includes('param') || errorMsg.includes('400')) {
    return ErrorCodes.INVALID_PARAMS
  }
  if (errorMsg.includes('block') || errorMsg.includes('reject') || errorMsg.includes('refuse')) {
    return ErrorCodes.BLOCKED
  }
  if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('exceeded')) {
    return ErrorCodes.QUOTA_EXCEEDED
  }
  if (errorMsg.includes('network') || errorMsg.includes('connection') || errorMsg.includes('socket')) {
    return ErrorCodes.NETWORK_ERROR
  }
  if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503') || errorMsg.includes('504')) {
    return ErrorCodes.SERVER_ERROR
  }

  return ErrorCodes.UNKNOWN
}

// 재시도 가능 여부 확인
function isRetryableError(errorCode: string): boolean {
  return RETRYABLE_ERROR_CODES.includes(errorCode as any)
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

// 재시도 설정 인터페이스
interface RetrySettings {
  retryEnabled: boolean
  retryInterval: number // 분 단위
  maxRetries: number
}

export class NotificationService {
  private smsProvider: SMSProvider | null = null
  private kakaoProvider: KakaoProvider | null = null
  private isQueueProcessing = false
  private initialized = false

  /**
   * 테넌트별 재시도 설정 조회
   */
  private async getRetrySettings(tenantId: string): Promise<RetrySettings> {
    try {
      const configs = await prisma.systemConfig.findMany({
        where: {
          tenantId,
          key: { startsWith: 'notification.' },
        },
      })

      const settings: RetrySettings = {
        retryEnabled: false,
        retryInterval: 10,
        maxRetries: 2,
      }

      configs.forEach((config) => {
        const key = config.key.split('.')[1]
        try {
          const value = JSON.parse(config.value)
          if (key === 'retryEnabled') settings.retryEnabled = value
          if (key === 'retryInterval') settings.retryInterval = value
          if (key === 'maxRetries') settings.maxRetries = value
        } catch {
          // 파싱 실패 시 무시
        }
      })

      return settings
    } catch (error) {
      logger.error('재시도 설정 조회 실패:', error)
      return { retryEnabled: false, retryInterval: 10, maxRetries: 2 }
    }
  }

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

      // [중복 방지 로직 정리 - 2025-11-26]
      // 1. 근본 원인 해결: fallback ID를 UID 기반으로 변경 (bodyHash 불안정 문제 해결)
      // 2. emailLogId + contactId 기반 Optimistic Locking이 이제 제대로 작동함
      // 3. "오늘 업체+담당자" 체크는 제거됨 (하루에 같은 업체에서 여러 발주 가능해야 함)

      // [Optimistic Locking] 발송 전에 PENDING 상태로 로그를 먼저 생성
      // 이렇게 하면 두 번째 스케줄러가 실행될 때 이미 로그가 존재하므로 중복 발송 방지
      let pendingLogId: string | null = null

      if (request.emailLogId && request.contactId && tenantId) {
        try {
          // 먼저 기존 로그 확인 (PENDING, SENT, DELIVERED 모두 체크)
          const existingLog = await prisma.notificationLog.findUnique({
            where: {
              notification_unique_per_contact: {
                tenantId,
                emailLogId: request.emailLogId,
                contactId: request.contactId,
                type: request.type,
              },
            },
          })

          if (existingLog) {
            // 이미 성공한 경우 스킵
            if (existingLog.status === 'SENT' || existingLog.status === 'DELIVERED') {
              logger.info('[Optimistic Locking] 이미 성공한 발송 이력 존재, 스킵', {
                emailLogId: request.emailLogId,
                existingId: existingLog.id,
                existingStatus: existingLog.status,
                contactId: request.contactId,
              })

              return {
                success: true,
                messageId: existingLog.providerMessageId || existingLog.id,
                provider: 'SKIPPED(이미 발송됨)',
              }
            }

            // PENDING 상태인 경우 - 다른 스케줄러가 처리 중
            if (existingLog.status === 'PENDING') {
              // 5분 이상 PENDING 상태면 타임아웃으로 간주하고 재처리 허용
              const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
              if (existingLog.createdAt > fiveMinutesAgo) {
                logger.info('[Optimistic Locking] 다른 프로세스가 처리 중 (PENDING), 스킵', {
                  emailLogId: request.emailLogId,
                  existingId: existingLog.id,
                  contactId: request.contactId,
                })

                return {
                  success: true,
                  messageId: existingLog.id,
                  provider: 'SKIPPED(처리 중)',
                }
              }

              logger.info('[Optimistic Locking] PENDING 타임아웃, 재처리 시도', {
                emailLogId: request.emailLogId,
                existingId: existingLog.id,
              })
            }

            // FAILED 상태인 경우 pendingLogId 설정 (나중에 업데이트용)
            pendingLogId = existingLog.id
          } else {
            // 새 로그 생성 (PENDING 상태)
            const newLog = await prisma.notificationLog.create({
              data: {
                type: request.type,
                recipient: request.recipient,
                message: 'PENDING',
                status: 'PENDING',
                companyId: request.companyId,
                contactId: request.contactId,
                tenantId,
                emailLogId: request.emailLogId,
              },
            })
            pendingLogId = newLog.id

            logger.info('[Optimistic Locking] PENDING 로그 생성', {
              logId: newLog.id,
              emailLogId: request.emailLogId,
              contactId: request.contactId,
              type: request.type,
            })
          }
        } catch (error) {
          // unique constraint violation - 다른 프로세스가 먼저 생성함
          if ((error as any)?.code === 'P2002') {
            logger.info('[Optimistic Locking] 다른 프로세스가 먼저 로그 생성, 스킵', {
              emailLogId: request.emailLogId,
              contactId: request.contactId,
            })

            return {
              success: true,
              provider: 'SKIPPED(다른 프로세스 처리 중)',
            }
          }
          throw error
        }
      } else if (request.emailLogId && tenantId) {
        // contactId가 없는 경우 - 기존 로직 (recipient 기반 체크)
        const existingSuccess = await prisma.notificationLog.findFirst({
          where: {
            emailLogId: request.emailLogId,
            tenantId,
            type: request.type,
            recipient: request.recipient,
            status: { in: ['SENT', 'DELIVERED', 'PENDING'] },
          },
        })

        if (existingSuccess) {
          logger.info('[중복 발송 방지] 이미 처리 중이거나 성공한 발송 이력 존재, 스킵', {
            emailLogId: request.emailLogId,
            existingId: existingSuccess.id,
            existingStatus: existingSuccess.status,
            recipient: request.recipient,
          })

          return {
            success: true,
            messageId: existingSuccess.providerMessageId || existingSuccess.id,
            provider: `SKIPPED(${existingSuccess.status})`,
          }
        }
      }

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

      // 발송 로그 저장 (PENDING → SENT/FAILED 업데이트)
      await this.logNotification(request, result, rendered.content, pendingLogId)

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

      await this.logNotification(request, errorResult, undefined, pendingLogId)

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
        tenantId: request.tenantId,
        emailLogId: request.emailLogId,
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
   * - 유니크 키 기반 중복 방지
   * - 불확실 실패만 제한적 재시도 (최대 2회)
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

      // 기존 발송 이력 조회 (담당자별로 확인)
      // SENT/DELIVERED 상태인 담당자는 스킵, FAILED는 재시도 가능 여부 판단
      const existingNotifications = emailLogId
        ? await prisma.notificationLog.findMany({
            where: {
              emailLogId,
              tenantId: company.tenantId,
            },
          })
        : []

      // 담당자별 발송 상태 매핑
      const contactNotificationMap = new Map<string, { status: string; errorCode: string | null; retryCount: number }>()
      for (const notif of existingNotifications) {
        if (notif.contactId) {
          const key = `${notif.contactId}-${notif.type}`
          contactNotificationMap.set(key, {
            status: notif.status,
            errorCode: notif.errorCode,
            retryCount: notif.retryCount,
          })
        }
      }

      logger.info('[발주 알림] 기존 발송 이력 확인', {
        emailLogId,
        existingCount: existingNotifications.length,
        contactCount: company.contacts.length,
      })

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

      // 요일 계산 - KST 타임존으로 Date를 파싱해서 정확한 요일 추출
      // UTC Date를 만들고 KST 오프셋(+9시간)을 적용한 날짜로 요일 계산
      const kstWeekdayShort = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        weekday: 'short',
      }).format(deliveryDate)

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
        shortDate: `${kstMonth}/${kstDay}(${kstWeekdayShort})`,
        // 배송 시간대 - "미정"일 경우 공백 처리 (11/19(수) 배송 예정)
        deliveryTime: deliveryTime === '미정' ? '' : ` ${deliveryTime}`,
      }

      const results: NotificationResult[] = []
      const MAX_RETRIES = 2 // 불확실 실패 시 최대 재시도 횟수

      // 활성 담당자들에게 알림 발송
      for (const contact of company.contacts) {
        let smsAlreadySent = false // SMS 중복 발송 방지 플래그

        // 담당자별 알림 설정 로깅
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
          const kakaoKey = `${contact.id}-KAKAO_ALIMTALK`
          const kakaoExisting = contactNotificationMap.get(kakaoKey)

          // 이미 성공 상태면 스킵
          if (kakaoExisting && (kakaoExisting.status === 'SENT' || kakaoExisting.status === 'DELIVERED')) {
            logger.info('[알림 발송] 카카오 이미 성공, 스킵', { contactId: contact.id })
            continue
          }

          // FAILED 상태인 경우 재시도 가능 여부 판단
          if (kakaoExisting && kakaoExisting.status === 'FAILED') {
            const canRetry = kakaoExisting.errorCode
              ? isRetryableError(kakaoExisting.errorCode) && kakaoExisting.retryCount < MAX_RETRIES
              : kakaoExisting.retryCount < MAX_RETRIES // errorCode 없으면 재시도 허용

            if (!canRetry) {
              logger.info('[알림 발송] 카카오 재시도 불가 (확실한 실패 또는 최대 재시도 초과)', {
                contactId: contact.id,
                errorCode: kakaoExisting.errorCode,
                retryCount: kakaoExisting.retryCount,
              })
              continue
            }

            logger.info('[알림 발송] 카카오 재시도 시도', {
              contactId: contact.id,
              errorCode: kakaoExisting.errorCode,
              retryCount: kakaoExisting.retryCount,
            })
          }

          const kakaoResult = await this.sendNotification({
            type: NotificationType.KAKAO_ALIMTALK,
            recipient: contact.phone,
            templateName: 'ORDER_RECEIVED_KAKAO',
            variables,
            companyId: company.id,
            contactId: contact.id,
            tenantId: company.tenantId,
            enableFailover: contact.smsEnabled,
            emailLogId,
          })

          results.push(kakaoResult)

          // 카카오 성공 또는 SMS 폴백이 시도된 경우 SMS 스킵
          if (kakaoResult.success || kakaoResult.failoverUsed || kakaoResult.provider?.includes('SMS')) {
            smsAlreadySent = true
          }

          if (kakaoResult.success || kakaoResult.failoverUsed) {
            continue
          }
        }

        // SMS 발송
        if (contact.smsEnabled && !smsAlreadySent) {
          const smsKey = `${contact.id}-SMS`
          const smsExisting = contactNotificationMap.get(smsKey)

          // 이미 성공 상태면 스킵
          if (smsExisting && (smsExisting.status === 'SENT' || smsExisting.status === 'DELIVERED')) {
            logger.info('[알림 발송] SMS 이미 성공, 스킵', { contactId: contact.id })
            continue
          }

          // FAILED 상태인 경우 재시도 가능 여부 판단
          if (smsExisting && smsExisting.status === 'FAILED') {
            const canRetry = smsExisting.errorCode
              ? isRetryableError(smsExisting.errorCode) && smsExisting.retryCount < MAX_RETRIES
              : smsExisting.retryCount < MAX_RETRIES

            if (!canRetry) {
              logger.info('[알림 발송] SMS 재시도 불가 (확실한 실패 또는 최대 재시도 초과)', {
                contactId: contact.id,
                errorCode: smsExisting.errorCode,
                retryCount: smsExisting.retryCount,
              })
              continue
            }

            logger.info('[알림 발송] SMS 재시도 시도', {
              contactId: contact.id,
              errorCode: smsExisting.errorCode,
              retryCount: smsExisting.retryCount,
            })
          }

          const smsResult = await this.sendNotification({
            type: NotificationType.SMS,
            recipient: contact.phone,
            templateName: 'ORDER_RECEIVED_SMS',
            variables,
            companyId: company.id,
            contactId: contact.id,
            tenantId: company.tenantId,
            emailLogId,
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

      // NCP API 중복 체크는 너무 광범위하여 제거됨 (2025-11-26)
      // 문제: "오늘 해당 번호로 발송했으면 스킵" → 다른 업체 발주도 차단됨
      // 해결: DB 기반 중복 방지에 의존 (notification-service.ts의 Optimistic Locking)
      // - emailLogId + contactId + type 조합으로 중복 체크
      // - 같은 메일에 대해 같은 담당자에게만 중복 방지

      const result = await provider.sendSMS(message)

      if (result.success) {
        return {
          success: true,
          messageId: result.messageId,
          provider: 'SMS',
        }
      } else {
        const errorCode = classifyError(result.error || 'Unknown error')
        return {
          success: false,
          error: result.error,
          errorCode,
          provider: 'SMS',
        }
      }
    } catch (error) {
      logger.error('SMS 발송 오류:', error)
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류'
      const errorCode = classifyError(errorMsg)
      return {
        success: false,
        error: errorMsg,
        errorCode,
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

      if (result.success) {
        return {
          success: true,
          messageId: result.messageId,
          provider: 'KakaoAlimTalk',
        }
      } else {
        const errorCode = classifyError(result.error || 'Unknown error')
        return {
          success: false,
          error: result.error,
          errorCode,
          provider: 'KakaoAlimTalk',
        }
      }
    } catch (error) {
      logger.error('카카오 알림톡 발송 오류:', error)
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류'
      const errorCode = classifyError(errorMsg)
      return {
        success: false,
        error: errorMsg,
        errorCode,
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

      if (result.success) {
        return {
          success: true,
          messageId: result.messageId,
          provider: 'KakaoFriendTalk',
        }
      } else {
        const errorCode = classifyError(result.error || 'Unknown error')
        return {
          success: false,
          error: result.error,
          errorCode,
          provider: 'KakaoFriendTalk',
        }
      }
    } catch (error) {
      logger.error('카카오 친구톡 발송 오류:', error)
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류'
      const errorCode = classifyError(errorMsg)
      return {
        success: false,
        error: errorMsg,
        errorCode,
        provider: 'KakaoFriendTalk',
      }
    }
  }

  /**
   * 알림 발송 로그 저장 (update 또는 create)
   * - pendingLogId가 있으면 해당 로그를 update (PENDING → SENT/FAILED/PENDING_RETRY)
   * - 상태 전이 규칙: SENT/DELIVERED → 덮어쓰지 않음
   * - 재시도 설정이 활성화되어 있고 재시도 가능한 에러면 PENDING_RETRY 상태로 저장
   */
  private async logNotification(
    request: NotificationRequest,
    result: NotificationResult,
    renderedMessage?: string,
    pendingLogId?: string | null
  ): Promise<void> {
    try {
      const tenantId = request.tenantId || ''
      const errorCode = result.errorCode || (result.error ? classifyError(result.error) : null)

      // 재시도 설정 조회 (실패한 경우에만)
      let retrySettings: RetrySettings | null = null
      if (!result.success && tenantId) {
        retrySettings = await this.getRetrySettings(tenantId)
      }

      // 기존 로그의 retryCount 조회 (재시도 횟수 체크용)
      let currentRetryCount = 0
      if (pendingLogId) {
        const existingLog = await prisma.notificationLog.findUnique({
          where: { id: pendingLogId },
          select: { retryCount: true },
        })
        currentRetryCount = existingLog?.retryCount || 0
      }

      // 실패 상태 결정: 재시도 가능하면 PENDING_RETRY, 아니면 FAILED
      let newStatus: string = result.success ? 'SENT' : 'FAILED'
      let nextRetryAt: Date | null = null

      if (!result.success && retrySettings?.retryEnabled && errorCode) {
        const canRetry = isRetryableError(errorCode) && currentRetryCount < retrySettings.maxRetries
        if (canRetry) {
          newStatus = 'PENDING_RETRY'
          nextRetryAt = new Date(Date.now() + retrySettings.retryInterval * 60 * 1000)

          logger.info('[재시도 예약] 발송 실패, 재시도 예약됨', {
            errorCode,
            retryCount: currentRetryCount + 1,
            maxRetries: retrySettings.maxRetries,
            nextRetryAt: nextRetryAt.toISOString(),
            retryInterval: retrySettings.retryInterval,
          })
        }
      }

      logger.debug('알림 로그 저장', {
        type: request.type,
        recipient: request.recipient,
        template: request.templateName,
        success: result.success,
        provider: result.provider,
        errorCode,
        newStatus,
        pendingLogId,
        hasEmailLogId: !!request.emailLogId,
        hasContactId: !!request.contactId,
      })

      // pendingLogId가 있으면 해당 로그를 update
      if (pendingLogId) {
        await prisma.notificationLog.update({
          where: { id: pendingLogId },
          data: {
            status: newStatus,
            sentAt: result.success ? new Date() : null,
            errorMessage: result.error,
            errorCode,
            providerMessageId: result.messageId,
            message: renderedMessage || undefined,
            retryCount: { increment: 1 },
            nextRetryAt,
            maxRetries: retrySettings?.maxRetries ?? 3,
          },
        })

        logger.info('[로그 저장] PENDING → 상태 업데이트 완료', {
          logId: pendingLogId,
          status: newStatus,
          type: request.type,
          nextRetryAt: nextRetryAt?.toISOString(),
        })
        return
      }

      // emailLogId와 contactId가 있으면 upsert, 없으면 create
      if (request.emailLogId && request.contactId && tenantId) {
        // 기존 로그 확인
        const existingLog = await prisma.notificationLog.findUnique({
          where: {
            notification_unique_per_contact: {
              tenantId,
              emailLogId: request.emailLogId,
              contactId: request.contactId,
              type: request.type,
            },
          },
        })

        // 상태 전이 규칙: SENT 또는 DELIVERED면 덮어쓰지 않음
        if (existingLog && (existingLog.status === 'SENT' || existingLog.status === 'DELIVERED')) {
          logger.info('[로그 저장] 이미 성공 상태, 덮어쓰지 않음', {
            existingStatus: existingLog.status,
            newStatus,
            notificationId: existingLog.id,
          })
          return
        }

        // upsert 실행
        await prisma.notificationLog.upsert({
          where: {
            notification_unique_per_contact: {
              tenantId,
              emailLogId: request.emailLogId,
              contactId: request.contactId,
              type: request.type,
            },
          },
          create: {
            type: request.type,
            recipient: request.recipient,
            message: renderedMessage || JSON.stringify(request.variables),
            status: newStatus,
            sentAt: result.success ? new Date() : null,
            errorMessage: result.error,
            errorCode,
            providerMessageId: result.messageId,
            companyId: request.companyId,
            contactId: request.contactId,
            tenantId,
            emailLogId: request.emailLogId,
            nextRetryAt,
            maxRetries: retrySettings?.maxRetries ?? 3,
          },
          update: {
            // PENDING/FAILED/PENDING_RETRY → SENT/FAILED/PENDING_RETRY 업데이트 허용
            status: newStatus,
            sentAt: result.success ? new Date() : undefined,
            errorMessage: result.error,
            errorCode,
            providerMessageId: result.messageId || undefined,
            retryCount: { increment: 1 },
            message: renderedMessage || undefined,
            nextRetryAt,
            maxRetries: retrySettings?.maxRetries ?? undefined,
          },
        })

        logger.info('[로그 저장] upsert 완료', {
          tenantId,
          emailLogId: request.emailLogId,
          contactId: request.contactId,
          type: request.type,
          status: newStatus,
          nextRetryAt: nextRetryAt?.toISOString(),
        })
      } else {
        // emailLogId나 contactId가 없는 경우 (수동 발송 등) - 일반 create
        await prisma.notificationLog.create({
          data: {
            type: request.type,
            recipient: request.recipient,
            message: renderedMessage || JSON.stringify(request.variables),
            status: newStatus,
            sentAt: result.success ? new Date() : null,
            errorMessage: result.error,
            errorCode,
            providerMessageId: result.messageId,
            companyId: request.companyId,
            contactId: request.contactId,
            tenantId,
            emailLogId: request.emailLogId,
            nextRetryAt,
            maxRetries: retrySettings?.maxRetries ?? 3,
          },
        })
      }
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
          tenantId: job.tenantId,
          emailLogId: job.emailLogId,
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

    // 환경변수에서 실제 provider 이름 가져오기
    const smsProviderName = process.env.SMS_PROVIDER || 'solapi'
    const kakaoProviderName = process.env.KAKAO_PROVIDER || 'solapi'

    const [smsBalance, queueStats] = await Promise.all([
      this.smsProvider?.getBalance().catch(() => 0) || Promise.resolve(0),
      notificationQueue.getStats(),
    ])

    // NCP는 잔액 API가 없어서 -1 반환 → 사용 가능으로 처리
    const smsAvailable = smsBalance === -1 ? true : smsBalance > 0

    return {
      sms: {
        provider: smsProviderName,
        balance: smsBalance,
        available: smsAvailable,
      },
      kakao: {
        provider: kakaoProviderName,
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
