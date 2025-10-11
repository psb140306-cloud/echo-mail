/**
 * Echo Mail Global Error Handler
 * 전역 에러 처리 및 로깅 시스템
 */

import { EchoMailError, ErrorSeverity, ErrorCategory, errorUtils } from './errors'
import { logger } from './logger'

export interface ErrorHandlerOptions {
  logError?: boolean
  notifyAdmin?: boolean
  sendResponse?: boolean
  includeStack?: boolean
}

export interface ErrorContext {
  userId?: string
  companyId?: string
  requestId?: string
  userAgent?: string
  ip?: string
  endpoint?: string
  method?: string
  timestamp?: Date
  additionalData?: Record<string, any>
}

/**
 * 전역 에러 핸들러 클래스
 */
export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler
  private adminNotificationQueue: Array<{
    error: EchoMailError
    context: ErrorContext
    timestamp: Date
  }> = []

  private constructor() {}

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler()
    }
    return GlobalErrorHandler.instance
  }

  /**
   * 에러 처리 메인 메서드
   */
  async handleError(
    error: Error | EchoMailError,
    context: ErrorContext = {},
    options: ErrorHandlerOptions = {}
  ): Promise<void> {
    const { logError = true, notifyAdmin = true, includeStack = true } = options

    // EchoMailError로 변환 또는 래핑
    const echoError = this.normalizeError(error, context)

    // 컨텍스트 정보 추가
    const enrichedContext = {
      ...context,
      timestamp: new Date(),
      errorCode: echoError.code,
      errorCategory: echoError.category,
      errorSeverity: echoError.severity,
    }

    try {
      // 1. 에러 로깅
      if (logError) {
        await this.logError(echoError, enrichedContext, includeStack)
      }

      // 2. 메트릭 수집
      await this.collectMetrics(echoError, enrichedContext)

      // 3. 관리자 알림 (필요한 경우)
      if (notifyAdmin && echoError.requiresAdminNotification) {
        await this.queueAdminNotification(echoError, enrichedContext)
      }

      // 4. 자동 복구 시도 (가능한 경우)
      if (echoError.recoverable) {
        await this.attemptRecovery(echoError, enrichedContext)
      }
    } catch (handlerError) {
      // 에러 핸들러 자체에서 오류 발생 시 기본 로깅
      console.error('Error handler failed:', handlerError)
      console.error('Original error:', echoError)
    }
  }

  /**
   * 에러를 EchoMailError로 정규화
   */
  private normalizeError(error: Error | EchoMailError, context: ErrorContext): EchoMailError {
    if (error instanceof EchoMailError) {
      return error
    }

    // 일반 에러를 EchoMailError로 래핑
    return new EchoMailError(
      1000, // SYSTEM_ERROR
      {
        originalMessage: error.message,
        originalName: error.name,
        ...context,
      },
      error
    )
  }

  /**
   * 에러 로깅
   */
  private async logError(
    error: EchoMailError,
    context: ErrorContext,
    includeStack: boolean
  ): Promise<void> {
    const logData = {
      ...error.toLogObject(),
      context,
      ...(includeStack && { stack: error.stack }),
    }

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('CRITICAL ERROR', logData)
        break
      case ErrorSeverity.HIGH:
        logger.error('HIGH SEVERITY ERROR', logData)
        break
      case ErrorSeverity.MEDIUM:
        logger.warn('MEDIUM SEVERITY ERROR', logData)
        break
      case ErrorSeverity.LOW:
        logger.info('LOW SEVERITY ERROR', logData)
        break
      default:
        logger.error('UNKNOWN SEVERITY ERROR', logData)
    }
  }

  /**
   * 메트릭 수집
   */
  private async collectMetrics(error: EchoMailError, context: ErrorContext): Promise<void> {
    try {
      // 에러 카운터 증가
      await this.incrementErrorCounter(error.category, error.code.toString())

      // 시간대별 에러 통계
      await this.recordErrorByTime(error.severity, context.timestamp || new Date())

      // 엔드포인트별 에러 통계 (API 호출인 경우)
      if (context.endpoint) {
        await this.recordErrorByEndpoint(context.endpoint, error.code.toString())
      }

      // 업체별 에러 통계
      if (context.companyId) {
        await this.recordErrorByCompany(context.companyId, error.category)
      }
    } catch (metricsError) {
      logger.warn('Failed to collect error metrics', { error: metricsError })
    }
  }

  /**
   * 관리자 알림 큐에 추가
   */
  private async queueAdminNotification(error: EchoMailError, context: ErrorContext): Promise<void> {
    this.adminNotificationQueue.push({
      error,
      context,
      timestamp: new Date(),
    })

    // 큐가 일정 크기를 초과하면 즉시 처리
    if (this.adminNotificationQueue.length >= 10) {
      await this.flushAdminNotifications()
    }

    // 크리티컬 에러는 즉시 알림
    if (error.severity === ErrorSeverity.CRITICAL) {
      await this.sendImmediateAdminNotification(error, context)
    }
  }

  /**
   * 관리자 알림 일괄 처리
   */
  private async flushAdminNotifications(): Promise<void> {
    const notifications = [...this.adminNotificationQueue]
    this.adminNotificationQueue = []

    try {
      // 에러를 심각도별로 그룹화
      const groupedErrors = this.groupErrorsBySeverity(notifications)

      // 각 심각도별로 알림 발송
      for (const [severity, errors] of Object.entries(groupedErrors)) {
        await this.sendAdminNotificationBatch(severity as ErrorSeverity, errors)
      }
    } catch (notificationError) {
      logger.error('Failed to send admin notifications', { error: notificationError })
      // 실패한 알림을 다시 큐에 추가
      this.adminNotificationQueue.unshift(...notifications)
    }
  }

  /**
   * 자동 복구 시도
   */
  private async attemptRecovery(error: EchoMailError, context: ErrorContext): Promise<void> {
    try {
      switch (error.category) {
        case ErrorCategory.EMAIL:
          await this.recoverEmailConnection(error, context)
          break

        case ErrorCategory.NOTIFICATION:
          await this.recoverNotificationService(error, context)
          break

        case ErrorCategory.SYSTEM:
          await this.recoverSystemService(error, context)
          break

        default:
          logger.info('No recovery strategy available', {
            errorCode: error.code,
            category: error.category,
          })
      }
    } catch (recoveryError) {
      logger.warn('Recovery attempt failed', {
        originalError: error.code,
        recoveryError: recoveryError,
      })
    }
  }

  /**
   * 메일 연결 복구
   */
  private async recoverEmailConnection(error: EchoMailError, context: ErrorContext): Promise<void> {
    logger.info('Attempting email connection recovery', { errorCode: error.code })

    // TODO: 메일 서버 재연결 로직 구현
    // - 연결 상태 확인
    // - 재연결 시도
    // - 설정 검증
  }

  /**
   * 알림 서비스 복구
   */
  private async recoverNotificationService(
    error: EchoMailError,
    context: ErrorContext
  ): Promise<void> {
    logger.info('Attempting notification service recovery', { errorCode: error.code })

    // TODO: 알림 서비스 복구 로직 구현
    // - 큐 상태 확인
    // - 실패한 메시지 재처리
    // - API 연결 복구
  }

  /**
   * 시스템 서비스 복구
   */
  private async recoverSystemService(error: EchoMailError, context: ErrorContext): Promise<void> {
    logger.info('Attempting system service recovery', { errorCode: error.code })

    // TODO: 시스템 복구 로직 구현
    // - 데이터베이스 연결 복구
    // - 캐시 연결 복구
    // - 서비스 재시작
  }

  /**
   * 에러 카운터 증가
   */
  private async incrementErrorCounter(category: ErrorCategory, errorCode: string): Promise<void> {
    // TODO: 메트릭 수집 시스템 연동
    // Redis 또는 메트릭 저장소에 카운터 증가
    logger.debug('Error counter incremented', { category, errorCode })
  }

  /**
   * 시간대별 에러 기록
   */
  private async recordErrorByTime(severity: ErrorSeverity, timestamp: Date): Promise<void> {
    // TODO: 시간대별 에러 통계 기록
    logger.debug('Error recorded by time', { severity, timestamp })
  }

  /**
   * 엔드포인트별 에러 기록
   */
  private async recordErrorByEndpoint(endpoint: string, errorCode: string): Promise<void> {
    // TODO: API 엔드포인트별 에러 통계
    logger.debug('Error recorded by endpoint', { endpoint, errorCode })
  }

  /**
   * 업체별 에러 기록
   */
  private async recordErrorByCompany(companyId: string, category: ErrorCategory): Promise<void> {
    // TODO: 업체별 에러 통계
    logger.debug('Error recorded by company', { companyId, category })
  }

  /**
   * 에러를 심각도별로 그룹화
   */
  private groupErrorsBySeverity(
    notifications: Array<{
      error: EchoMailError
      context: ErrorContext
      timestamp: Date
    }>
  ): Record<ErrorSeverity, typeof notifications> {
    return notifications.reduce(
      (groups, notification) => {
        const severity = notification.error.severity
        if (!groups[severity]) {
          groups[severity] = []
        }
        groups[severity].push(notification)
        return groups
      },
      {} as Record<ErrorSeverity, typeof notifications>
    )
  }

  /**
   * 즉시 관리자 알림 발송
   */
  private async sendImmediateAdminNotification(
    error: EchoMailError,
    context: ErrorContext
  ): Promise<void> {
    try {
      // TODO: 즉시 알림 발송 (이메일, Slack, SMS 등)
      logger.warn('Immediate admin notification sent', {
        errorCode: error.code,
        severity: error.severity,
        context,
      })
    } catch (notificationError) {
      logger.error('Failed to send immediate admin notification', {
        error: notificationError,
        originalError: error.code,
      })
    }
  }

  /**
   * 관리자 알림 일괄 발송
   */
  private async sendAdminNotificationBatch(
    severity: ErrorSeverity,
    errors: Array<{
      error: EchoMailError
      context: ErrorContext
      timestamp: Date
    }>
  ): Promise<void> {
    try {
      // TODO: 배치 알림 발송
      logger.info('Admin notification batch sent', {
        severity,
        errorCount: errors.length,
        errors: errors.map((e) => ({
          code: e.error.code,
          timestamp: e.timestamp,
        })),
      })
    } catch (notificationError) {
      logger.error('Failed to send admin notification batch', {
        error: notificationError,
        severity,
        errorCount: errors.length,
      })
    }
  }

  /**
   * 주기적으로 관리자 알림 처리
   */
  startAdminNotificationProcessor(): void {
    setInterval(async () => {
      if (this.adminNotificationQueue.length > 0) {
        await this.flushAdminNotifications()
      }
    }, 30000) // 30초마다 처리
  }

  /**
   * 에러 핸들러 통계 조회
   */
  async getErrorStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalErrors: number
    errorsByCategory: Record<ErrorCategory, number>
    errorsBySeverity: Record<ErrorSeverity, number>
    topErrors: Array<{ code: number; count: number }>
  }> {
    // TODO: 에러 통계 조회 구현
    return {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      topErrors: [],
    }
  }
}

/**
 * 편의 함수들
 */

// 전역 에러 핸들러 인스턴스
export const globalErrorHandler = GlobalErrorHandler.getInstance()

// Express 미들웨어용 에러 핸들러
export function expressErrorHandler() {
  return async (error: Error, req: any, res: any, next: any) => {
    const context: ErrorContext = {
      requestId: req.id || req.headers['x-request-id'],
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      userId: req.user?.id,
      additionalData: {
        body: req.body,
        params: req.params,
        query: req.query,
      },
    }

    await globalErrorHandler.handleError(error, context)

    // 클라이언트 응답
    if (error instanceof EchoMailError) {
      res.status(500).json({
        success: false,
        error: {
          code: error.code,
          message: error.getUserFriendlyMessage(),
          ...(process.env.NODE_ENV === 'development' && {
            details: error.message,
            stack: error.stack,
          }),
        },
      })
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: '서버 오류가 발생했습니다.',
          ...(process.env.NODE_ENV === 'development' && {
            details: error.message,
          }),
        },
      })
    }
  }
}

// Next.js API 핸들러용
export function nextApiErrorHandler(handler: Function) {
  return async (req: any, res: any) => {
    try {
      return await handler(req, res)
    } catch (error) {
      const context: ErrorContext = {
        requestId: req.headers['x-request-id'],
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        endpoint: req.url,
        method: req.method,
        additionalData: {
          body: req.body,
          query: req.query,
        },
      }

      await globalErrorHandler.handleError(error as Error, context)

      if (error instanceof EchoMailError) {
        res.status(500).json({
          success: false,
          error: {
            code: error.code,
            message: error.getUserFriendlyMessage(),
          },
        })
      } else {
        res.status(500).json({
          success: false,
          error: {
            message: '서버 오류가 발생했습니다.',
          },
        })
      }
    }
  }
}

// Promise rejection 핸들러
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  globalErrorHandler.handleError(error, {
    additionalData: {
      type: 'unhandledRejection',
      promise: promise.toString(),
    },
  })
})

// Uncaught exception 핸들러
process.on('uncaughtException', (error: Error) => {
  globalErrorHandler.handleError(error, {
    additionalData: {
      type: 'uncaughtException',
    },
  })

  // Uncaught exception의 경우 프로세스 종료
  setTimeout(() => {
    process.exit(1)
  }, 1000)
})
