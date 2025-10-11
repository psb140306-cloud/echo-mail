/**
 * Echo Mail Error Management System
 * 에러 분류, 코드 정의 및 처리 로직
 */

export enum ErrorCode {
  // 시스템 에러 (1000-1999)
  SYSTEM_ERROR = 1000,
  SYSTEM_STARTUP_FAILED = 1001,
  SYSTEM_SHUTDOWN_FAILED = 1002,
  SYSTEM_RESOURCE_EXHAUSTED = 1003,
  DATABASE_CONNECTION_FAILED = 1004,
  REDIS_CONNECTION_FAILED = 1005,

  // 메일 관련 에러 (2000-2999)
  EMAIL_CONNECTION_FAILED = 2000,
  EMAIL_AUTHENTICATION_FAILED = 2001,
  EMAIL_FETCH_FAILED = 2002,
  EMAIL_PARSE_FAILED = 2003,
  EMAIL_INVALID_FORMAT = 2004,
  EMAIL_ATTACHMENT_MISSING = 2005,
  EMAIL_SENDER_NOT_FOUND = 2006,
  EMAIL_CONTENT_INVALID = 2007,

  // 업체 관련 에러 (3000-3999)
  COMPANY_NOT_FOUND = 3000,
  COMPANY_NOT_REGISTERED = 3001,
  COMPANY_INACTIVE = 3002,
  COMPANY_DUPLICATE = 3003,
  COMPANY_INVALID_EMAIL = 3004,
  COMPANY_INVALID_REGION = 3005,
  CONTACT_NOT_FOUND = 3006,
  CONTACT_INACTIVE = 3007,
  CONTACT_INVALID_PHONE = 3008,

  // 배송 규칙 에러 (4000-4999)
  DELIVERY_RULE_NOT_FOUND = 4000,
  DELIVERY_RULE_INVALID = 4001,
  DELIVERY_DATE_CALCULATION_FAILED = 4002,
  HOLIDAY_DATA_UNAVAILABLE = 4003,
  BUSINESS_DAY_CALCULATION_FAILED = 4004,

  // 알림 발송 에러 (5000-5999)
  SMS_SEND_FAILED = 5000,
  SMS_API_ERROR = 5001,
  SMS_INVALID_PHONE = 5002,
  SMS_QUOTA_EXCEEDED = 5003,
  KAKAO_SEND_FAILED = 5100,
  KAKAO_API_ERROR = 5101,
  KAKAO_TEMPLATE_NOT_FOUND = 5102,
  KAKAO_FRIEND_NOT_ADDED = 5103,
  NOTIFICATION_QUEUE_FULL = 5200,
  NOTIFICATION_RETRY_EXCEEDED = 5201,
  NOTIFICATION_TEMPLATE_INVALID = 5202,

  // 설정 관련 에러 (6000-6999)
  CONFIG_INVALID = 6000,
  CONFIG_MISSING = 6001,
  API_KEY_INVALID = 6002,
  API_KEY_EXPIRED = 6003,
  MAIL_SERVER_CONFIG_INVALID = 6004,
  SMS_CONFIG_INVALID = 6005,
  KAKAO_CONFIG_INVALID = 6006,

  // 권한 및 인증 에러 (7000-7999)
  UNAUTHORIZED = 7000,
  FORBIDDEN = 7001,
  TOKEN_INVALID = 7002,
  TOKEN_EXPIRED = 7003,
  ACCESS_DENIED = 7004,

  // 데이터 검증 에러 (8000-8999)
  VALIDATION_FAILED = 8000,
  REQUIRED_FIELD_MISSING = 8001,
  INVALID_EMAIL_FORMAT = 8002,
  INVALID_PHONE_FORMAT = 8003,
  INVALID_DATE_FORMAT = 8004,
  DATA_TYPE_MISMATCH = 8005,

  // 외부 API 에러 (9000-9999)
  EXTERNAL_API_ERROR = 9000,
  EXTERNAL_API_TIMEOUT = 9001,
  EXTERNAL_API_RATE_LIMITED = 9002,
  EXTERNAL_API_UNAVAILABLE = 9003,
  HOLIDAY_API_ERROR = 9004,
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  SYSTEM = 'system',
  EMAIL = 'email',
  COMPANY = 'company',
  DELIVERY = 'delivery',
  NOTIFICATION = 'notification',
  CONFIG = 'config',
  AUTH = 'auth',
  VALIDATION = 'validation',
  EXTERNAL = 'external',
}

export interface ErrorInfo {
  code: ErrorCode
  message: string
  category: ErrorCategory
  severity: ErrorSeverity
  recoverable: boolean
  requiresAdminNotification: boolean
  retryable: boolean
}

export const ERROR_DEFINITIONS: Record<ErrorCode, ErrorInfo> = {
  // 시스템 에러
  [ErrorCode.SYSTEM_ERROR]: {
    code: ErrorCode.SYSTEM_ERROR,
    message: '시스템 오류가 발생했습니다.',
    category: ErrorCategory.SYSTEM,
    severity: ErrorSeverity.HIGH,
    recoverable: false,
    requiresAdminNotification: true,
    retryable: false,
  },
  [ErrorCode.SYSTEM_STARTUP_FAILED]: {
    code: ErrorCode.SYSTEM_STARTUP_FAILED,
    message: '시스템 시작에 실패했습니다.',
    category: ErrorCategory.SYSTEM,
    severity: ErrorSeverity.CRITICAL,
    recoverable: false,
    requiresAdminNotification: true,
    retryable: false,
  },
  [ErrorCode.DATABASE_CONNECTION_FAILED]: {
    code: ErrorCode.DATABASE_CONNECTION_FAILED,
    message: '데이터베이스 연결에 실패했습니다.',
    category: ErrorCategory.SYSTEM,
    severity: ErrorSeverity.CRITICAL,
    recoverable: true,
    requiresAdminNotification: true,
    retryable: true,
  },

  // 메일 관련 에러
  [ErrorCode.EMAIL_CONNECTION_FAILED]: {
    code: ErrorCode.EMAIL_CONNECTION_FAILED,
    message: '메일 서버 연결에 실패했습니다.',
    category: ErrorCategory.EMAIL,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
    requiresAdminNotification: true,
    retryable: true,
  },
  [ErrorCode.EMAIL_PARSE_FAILED]: {
    code: ErrorCode.EMAIL_PARSE_FAILED,
    message: '메일 파싱에 실패했습니다.',
    category: ErrorCategory.EMAIL,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    requiresAdminNotification: false,
    retryable: false,
  },
  [ErrorCode.EMAIL_SENDER_NOT_FOUND]: {
    code: ErrorCode.EMAIL_SENDER_NOT_FOUND,
    message: '발신자 정보를 찾을 수 없습니다.',
    category: ErrorCategory.EMAIL,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    requiresAdminNotification: false,
    retryable: false,
  },

  // 업체 관련 에러
  [ErrorCode.COMPANY_NOT_REGISTERED]: {
    code: ErrorCode.COMPANY_NOT_REGISTERED,
    message: '등록되지 않은 업체입니다.',
    category: ErrorCategory.COMPANY,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    requiresAdminNotification: true,
    retryable: false,
  },
  [ErrorCode.COMPANY_INACTIVE]: {
    code: ErrorCode.COMPANY_INACTIVE,
    message: '비활성 상태의 업체입니다.',
    category: ErrorCategory.COMPANY,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    requiresAdminNotification: false,
    retryable: false,
  },
  [ErrorCode.CONTACT_NOT_FOUND]: {
    code: ErrorCode.CONTACT_NOT_FOUND,
    message: '담당자 정보를 찾을 수 없습니다.',
    category: ErrorCategory.COMPANY,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    requiresAdminNotification: false,
    retryable: false,
  },

  // 배송 규칙 에러
  [ErrorCode.DELIVERY_DATE_CALCULATION_FAILED]: {
    code: ErrorCode.DELIVERY_DATE_CALCULATION_FAILED,
    message: '납기일 계산에 실패했습니다.',
    category: ErrorCategory.DELIVERY,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    requiresAdminNotification: false,
    retryable: true,
  },
  [ErrorCode.HOLIDAY_DATA_UNAVAILABLE]: {
    code: ErrorCode.HOLIDAY_DATA_UNAVAILABLE,
    message: '공휴일 데이터를 사용할 수 없습니다.',
    category: ErrorCategory.DELIVERY,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    requiresAdminNotification: false,
    retryable: true,
  },

  // 알림 발송 에러
  [ErrorCode.SMS_SEND_FAILED]: {
    code: ErrorCode.SMS_SEND_FAILED,
    message: 'SMS 발송에 실패했습니다.',
    category: ErrorCategory.NOTIFICATION,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    requiresAdminNotification: false,
    retryable: true,
  },
  [ErrorCode.KAKAO_SEND_FAILED]: {
    code: ErrorCode.KAKAO_SEND_FAILED,
    message: '카카오톡 발송에 실패했습니다.',
    category: ErrorCategory.NOTIFICATION,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    requiresAdminNotification: false,
    retryable: true,
  },
  [ErrorCode.NOTIFICATION_QUEUE_FULL]: {
    code: ErrorCode.NOTIFICATION_QUEUE_FULL,
    message: '알림 큐가 가득 찼습니다.',
    category: ErrorCategory.NOTIFICATION,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
    requiresAdminNotification: true,
    retryable: true,
  },

  // 설정 관련 에러
  [ErrorCode.API_KEY_INVALID]: {
    code: ErrorCode.API_KEY_INVALID,
    message: '유효하지 않은 API 키입니다.',
    category: ErrorCategory.CONFIG,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
    requiresAdminNotification: true,
    retryable: false,
  },

  // 데이터 검증 에러
  [ErrorCode.VALIDATION_FAILED]: {
    code: ErrorCode.VALIDATION_FAILED,
    message: '데이터 검증에 실패했습니다.',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    requiresAdminNotification: false,
    retryable: false,
  },
  [ErrorCode.INVALID_EMAIL_FORMAT]: {
    code: ErrorCode.INVALID_EMAIL_FORMAT,
    message: '잘못된 이메일 형식입니다.',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    requiresAdminNotification: false,
    retryable: false,
  },

  // 외부 API 에러
  [ErrorCode.EXTERNAL_API_TIMEOUT]: {
    code: ErrorCode.EXTERNAL_API_TIMEOUT,
    message: '외부 API 응답 시간이 초과되었습니다.',
    category: ErrorCategory.EXTERNAL,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    requiresAdminNotification: false,
    retryable: true,
  },
} as Record<ErrorCode, ErrorInfo>

/**
 * Echo Mail Custom Error Class
 */
export class EchoMailError extends Error {
  public readonly code: ErrorCode
  public readonly category: ErrorCategory
  public readonly severity: ErrorSeverity
  public readonly recoverable: boolean
  public readonly requiresAdminNotification: boolean
  public readonly retryable: boolean
  public readonly context?: Record<string, any>
  public readonly timestamp: Date

  constructor(code: ErrorCode, context?: Record<string, any>, cause?: Error) {
    const errorInfo = ERROR_DEFINITIONS[code]
    super(errorInfo.message)

    this.name = 'EchoMailError'
    this.code = code
    this.category = errorInfo.category
    this.severity = errorInfo.severity
    this.recoverable = errorInfo.recoverable
    this.requiresAdminNotification = errorInfo.requiresAdminNotification
    this.retryable = errorInfo.retryable
    this.context = context
    this.timestamp = new Date()
    this.cause = cause

    // 스택 트레이스 설정
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EchoMailError)
    }
  }

  /**
   * 에러를 로그용 객체로 변환
   */
  toLogObject(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      recoverable: this.recoverable,
      requiresAdminNotification: this.requiresAdminNotification,
      retryable: this.retryable,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      cause: this.cause?.message,
    }
  }

  /**
   * 사용자 친화적 메시지 생성
   */
  getUserFriendlyMessage(): string {
    switch (this.severity) {
      case ErrorSeverity.LOW:
        return '일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      case ErrorSeverity.MEDIUM:
        return '처리 중 오류가 발생했습니다. 문제가 지속되면 관리자에게 문의하세요.'
      case ErrorSeverity.HIGH:
        return '중요한 오류가 발생했습니다. 관리자에게 즉시 문의하세요.'
      case ErrorSeverity.CRITICAL:
        return '시스템 오류가 발생했습니다. 긴급히 관리자에게 문의하세요.'
      default:
        return this.message
    }
  }
}

/**
 * 에러 팩토리 함수들
 */
export const createEchoMailError = {
  // 시스템 에러
  systemError: (context?: Record<string, any>, cause?: Error) =>
    new EchoMailError(ErrorCode.SYSTEM_ERROR, context, cause),

  databaseConnectionFailed: (context?: Record<string, any>, cause?: Error) =>
    new EchoMailError(ErrorCode.DATABASE_CONNECTION_FAILED, context, cause),

  // 메일 에러
  emailConnectionFailed: (context?: Record<string, any>, cause?: Error) =>
    new EchoMailError(ErrorCode.EMAIL_CONNECTION_FAILED, context, cause),

  emailParseFailed: (context?: Record<string, any>, cause?: Error) =>
    new EchoMailError(ErrorCode.EMAIL_PARSE_FAILED, context, cause),

  emailSenderNotFound: (context?: Record<string, any>) =>
    new EchoMailError(ErrorCode.EMAIL_SENDER_NOT_FOUND, context),

  // 업체 에러
  companyNotRegistered: (context?: Record<string, any>) =>
    new EchoMailError(ErrorCode.COMPANY_NOT_REGISTERED, context),

  companyInactive: (context?: Record<string, any>) =>
    new EchoMailError(ErrorCode.COMPANY_INACTIVE, context),

  contactNotFound: (context?: Record<string, any>) =>
    new EchoMailError(ErrorCode.CONTACT_NOT_FOUND, context),

  // 배송 에러
  deliveryDateCalculationFailed: (context?: Record<string, any>, cause?: Error) =>
    new EchoMailError(ErrorCode.DELIVERY_DATE_CALCULATION_FAILED, context, cause),

  // 알림 에러
  smsSendFailed: (context?: Record<string, any>, cause?: Error) =>
    new EchoMailError(ErrorCode.SMS_SEND_FAILED, context, cause),

  kakaoSendFailed: (context?: Record<string, any>, cause?: Error) =>
    new EchoMailError(ErrorCode.KAKAO_SEND_FAILED, context, cause),

  notificationQueueFull: (context?: Record<string, any>) =>
    new EchoMailError(ErrorCode.NOTIFICATION_QUEUE_FULL, context),

  // 검증 에러
  validationFailed: (context?: Record<string, any>) =>
    new EchoMailError(ErrorCode.VALIDATION_FAILED, context),

  invalidEmailFormat: (context?: Record<string, any>) =>
    new EchoMailError(ErrorCode.INVALID_EMAIL_FORMAT, context),
}

/**
 * 에러 유틸리티 함수들
 */
export const errorUtils = {
  /**
   * 에러가 재시도 가능한지 확인
   */
  isRetryable: (error: Error | EchoMailError): boolean => {
    if (error instanceof EchoMailError) {
      return error.retryable
    }
    return false
  },

  /**
   * 에러가 관리자 알림이 필요한지 확인
   */
  requiresAdminNotification: (error: Error | EchoMailError): boolean => {
    if (error instanceof EchoMailError) {
      return error.requiresAdminNotification
    }
    return true // 알 수 없는 에러는 항상 알림
  },

  /**
   * 에러 심각도 확인
   */
  getSeverity: (error: Error | EchoMailError): ErrorSeverity => {
    if (error instanceof EchoMailError) {
      return error.severity
    }
    return ErrorSeverity.HIGH // 알 수 없는 에러는 높은 심각도
  },

  /**
   * 에러 카테고리 확인
   */
  getCategory: (error: Error | EchoMailError): ErrorCategory => {
    if (error instanceof EchoMailError) {
      return error.category
    }
    return ErrorCategory.SYSTEM
  },
}
