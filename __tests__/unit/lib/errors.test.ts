/**
 * Unit Tests for Error Management System
 * 에러 관리 시스템 단위 테스트
 */

import {
  EchoMailError,
  ErrorCode,
  ErrorSeverity,
  ErrorCategory,
  ERROR_DEFINITIONS,
  createEchoMailError,
  errorUtils
} from '@/lib/errors'

describe('EchoMailError', () => {
  describe('constructor', () => {
    it('should create error with correct properties', () => {
      const context = { userId: '123', endpoint: '/api/test' }
      const cause = new Error('Original error')

      const error = new EchoMailError(ErrorCode.SYSTEM_ERROR, context, cause)

      expect(error.code).toBe(ErrorCode.SYSTEM_ERROR)
      expect(error.category).toBe(ErrorCategory.SYSTEM)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.message).toBe('시스템 오류가 발생했습니다.')
      expect(error.context).toEqual(context)
      expect(error.cause).toBe(cause)
      expect(error.timestamp).toBeInstanceOf(Date)
      expect(error.requiresAdminNotification).toBe(true)
      expect(error.retryable).toBe(false)
    })

    it('should handle unknown error codes gracefully', () => {
      const unknownCode = 99999 as ErrorCode

      expect(() => {
        new EchoMailError(unknownCode)
      }).toThrow()
    })

    it('should set stack trace correctly', () => {
      const error = new EchoMailError(ErrorCode.EMAIL_PARSE_FAILED)

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('EchoMailError')
    })
  })

  describe('toLogObject', () => {
    it('should convert error to structured log object', () => {
      const context = { companyId: 'comp123', emailCount: 5 }
      const error = new EchoMailError(ErrorCode.COMPANY_NOT_REGISTERED, context)

      const logObject = error.toLogObject()

      expect(logObject).toMatchObject({
        name: 'EchoMailError',
        code: ErrorCode.COMPANY_NOT_REGISTERED,
        message: '등록되지 않은 업체입니다.',
        category: ErrorCategory.COMPANY,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        requiresAdminNotification: true,
        retryable: false,
        context: context
      })
      expect(logObject.timestamp).toBeDefined()
      expect(logObject.stack).toBeDefined()
    })

    it('should include cause information when present', () => {
      const cause = new Error('Database connection failed')
      const error = new EchoMailError(ErrorCode.DATABASE_CONNECTION_FAILED, {}, cause)

      const logObject = error.toLogObject()

      expect(logObject.cause).toBe(cause.message)
    })
  })

  describe('getUserFriendlyMessage', () => {
    it('should return appropriate message for each severity level', () => {
      const criticalError = new EchoMailError(ErrorCode.SYSTEM_STARTUP_FAILED)
      expect(criticalError.getUserFriendlyMessage()).toContain('시스템 오류')
      expect(criticalError.getUserFriendlyMessage()).toContain('긴급')

      const highError = new EchoMailError(ErrorCode.EMAIL_CONNECTION_FAILED)
      expect(highError.getUserFriendlyMessage()).toContain('중요한 오류')

      const mediumError = new EchoMailError(ErrorCode.COMPANY_NOT_REGISTERED)
      expect(mediumError.getUserFriendlyMessage()).toContain('처리 중 오류')

      const lowError = new EchoMailError(ErrorCode.EMAIL_SENDER_NOT_FOUND)
      expect(lowError.getUserFriendlyMessage()).toContain('일시적인 문제')
    })
  })
})

describe('ERROR_DEFINITIONS', () => {
  it('should have definitions for all error codes', () => {
    const errorCodes = Object.values(ErrorCode).filter(value => typeof value === 'number')

    errorCodes.forEach(code => {
      expect(ERROR_DEFINITIONS[code as ErrorCode]).toBeDefined()
    })
  })

  it('should have consistent data structure for all definitions', () => {
    Object.values(ERROR_DEFINITIONS).forEach(definition => {
      expect(definition).toHaveProperty('code')
      expect(definition).toHaveProperty('message')
      expect(definition).toHaveProperty('category')
      expect(definition).toHaveProperty('severity')
      expect(definition).toHaveProperty('recoverable')
      expect(definition).toHaveProperty('requiresAdminNotification')
      expect(definition).toHaveProperty('retryable')

      expect(typeof definition.message).toBe('string')
      expect(definition.message.length).toBeGreaterThan(0)
      expect(Object.values(ErrorCategory)).toContain(definition.category)
      expect(Object.values(ErrorSeverity)).toContain(definition.severity)
      expect(typeof definition.recoverable).toBe('boolean')
      expect(typeof definition.requiresAdminNotification).toBe('boolean')
      expect(typeof definition.retryable).toBe('boolean')
    })
  })

  it('should have Korean messages for user-facing errors', () => {
    const userFacingCategories = [
      ErrorCategory.COMPANY,
      ErrorCategory.DELIVERY,
      ErrorCategory.NOTIFICATION,
      ErrorCategory.VALIDATION
    ]

    Object.values(ERROR_DEFINITIONS)
      .filter(def => userFacingCategories.includes(def.category))
      .forEach(definition => {
        // Check if message contains Korean characters
        expect(definition.message).toMatch(/[가-힣]/)
      })
  })
})

describe('createEchoMailError factory functions', () => {
  describe('systemError', () => {
    it('should create system error with context', () => {
      const context = { component: 'email-processor' }
      const cause = new Error('Memory exhausted')

      const error = createEchoMailError.systemError(context, cause)

      expect(error.code).toBe(ErrorCode.SYSTEM_ERROR)
      expect(error.category).toBe(ErrorCategory.SYSTEM)
      expect(error.context).toEqual(context)
      expect(error.cause).toBe(cause)
    })
  })

  describe('emailConnectionFailed', () => {
    it('should create email connection error', () => {
      const context = { server: 'imap.gmail.com', port: 993 }

      const error = createEchoMailError.emailConnectionFailed(context)

      expect(error.code).toBe(ErrorCode.EMAIL_CONNECTION_FAILED)
      expect(error.category).toBe(ErrorCategory.EMAIL)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.retryable).toBe(true)
    })
  })

  describe('companyNotRegistered', () => {
    it('should create company not registered error', () => {
      const context = { email: 'unknown@company.com', attemptedAction: 'order_processing' }

      const error = createEchoMailError.companyNotRegistered(context)

      expect(error.code).toBe(ErrorCode.COMPANY_NOT_REGISTERED)
      expect(error.category).toBe(ErrorCategory.COMPANY)
      expect(error.severity).toBe(ErrorSeverity.MEDIUM)
      expect(error.requiresAdminNotification).toBe(true)
    })
  })

  describe('smsSendFailed', () => {
    it('should create SMS send failed error', () => {
      const context = { phone: '010-1234-5678', provider: 'aligo' }
      const cause = new Error('API rate limit exceeded')

      const error = createEchoMailError.smsSendFailed(context, cause)

      expect(error.code).toBe(ErrorCode.SMS_SEND_FAILED)
      expect(error.category).toBe(ErrorCategory.NOTIFICATION)
      expect(error.retryable).toBe(true)
    })
  })

  describe('validationFailed', () => {
    it('should create validation failed error', () => {
      const context = { field: 'email', value: 'invalid-email', rule: 'email_format' }

      const error = createEchoMailError.validationFailed(context)

      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED)
      expect(error.category).toBe(ErrorCategory.VALIDATION)
      expect(error.severity).toBe(ErrorSeverity.LOW)
      expect(error.requiresAdminNotification).toBe(false)
    })
  })
})

describe('errorUtils', () => {
  describe('isRetryable', () => {
    it('should correctly identify retryable EchoMailError', () => {
      const retryableError = new EchoMailError(ErrorCode.EMAIL_CONNECTION_FAILED)
      const nonRetryableError = new EchoMailError(ErrorCode.SYSTEM_ERROR)
      const standardError = new Error('Standard error')

      expect(errorUtils.isRetryable(retryableError)).toBe(true)
      expect(errorUtils.isRetryable(nonRetryableError)).toBe(false)
      expect(errorUtils.isRetryable(standardError)).toBe(false)
    })
  })

  describe('requiresAdminNotification', () => {
    it('should correctly identify errors requiring admin notification', () => {
      const adminNotificationError = new EchoMailError(ErrorCode.COMPANY_NOT_REGISTERED)
      const noAdminNotificationError = new EchoMailError(ErrorCode.VALIDATION_FAILED)
      const standardError = new Error('Standard error')

      expect(errorUtils.requiresAdminNotification(adminNotificationError)).toBe(true)
      expect(errorUtils.requiresAdminNotification(noAdminNotificationError)).toBe(false)
      expect(errorUtils.requiresAdminNotification(standardError)).toBe(true) // Unknown errors always require notification
    })
  })

  describe('getSeverity', () => {
    it('should return correct severity for EchoMailError', () => {
      const criticalError = new EchoMailError(ErrorCode.SYSTEM_STARTUP_FAILED)
      const highError = new EchoMailError(ErrorCode.EMAIL_CONNECTION_FAILED)
      const mediumError = new EchoMailError(ErrorCode.SMS_SEND_FAILED)
      const lowError = new EchoMailError(ErrorCode.VALIDATION_FAILED)
      const standardError = new Error('Standard error')

      expect(errorUtils.getSeverity(criticalError)).toBe(ErrorSeverity.CRITICAL)
      expect(errorUtils.getSeverity(highError)).toBe(ErrorSeverity.HIGH)
      expect(errorUtils.getSeverity(mediumError)).toBe(ErrorSeverity.MEDIUM)
      expect(errorUtils.getSeverity(lowError)).toBe(ErrorSeverity.LOW)
      expect(errorUtils.getSeverity(standardError)).toBe(ErrorSeverity.HIGH) // Unknown errors get high severity
    })
  })

  describe('getCategory', () => {
    it('should return correct category for EchoMailError', () => {
      const systemError = new EchoMailError(ErrorCode.SYSTEM_ERROR)
      const emailError = new EchoMailError(ErrorCode.EMAIL_PARSE_FAILED)
      const companyError = new EchoMailError(ErrorCode.COMPANY_NOT_REGISTERED)
      const standardError = new Error('Standard error')

      expect(errorUtils.getCategory(systemError)).toBe(ErrorCategory.SYSTEM)
      expect(errorUtils.getCategory(emailError)).toBe(ErrorCategory.EMAIL)
      expect(errorUtils.getCategory(companyError)).toBe(ErrorCategory.COMPANY)
      expect(errorUtils.getCategory(standardError)).toBe(ErrorCategory.SYSTEM) // Unknown errors categorized as system
    })
  })
})

describe('Error categorization and relationships', () => {
  it('should have consistent severity levels across categories', () => {
    const criticalErrors = Object.values(ERROR_DEFINITIONS)
      .filter(def => def.severity === ErrorSeverity.CRITICAL)

    const highErrors = Object.values(ERROR_DEFINITIONS)
      .filter(def => def.severity === ErrorSeverity.HIGH)

    // Critical errors should be system-related
    criticalErrors.forEach(error => {
      expect(error.category).toBe(ErrorCategory.SYSTEM)
      expect(error.requiresAdminNotification).toBe(true)
    })

    // High severity errors should require admin notification
    highErrors.forEach(error => {
      expect(error.requiresAdminNotification).toBe(true)
    })
  })

  it('should have logical retry policies', () => {
    const retryableErrors = Object.values(ERROR_DEFINITIONS)
      .filter(def => def.retryable)

    const nonRetryableErrors = Object.values(ERROR_DEFINITIONS)
      .filter(def => !def.retryable)

    // Connection and API errors should be retryable
    retryableErrors.forEach(error => {
      const retryableCategories = [
        ErrorCategory.EMAIL,
        ErrorCategory.NOTIFICATION,
        ErrorCategory.EXTERNAL,
        ErrorCategory.SYSTEM
      ]
      if (retryableCategories.includes(error.category)) {
        expect([
          ErrorCode.EMAIL_CONNECTION_FAILED,
          ErrorCode.SMS_SEND_FAILED,
          ErrorCode.KAKAO_SEND_FAILED,
          ErrorCode.DATABASE_CONNECTION_FAILED,
          ErrorCode.EXTERNAL_API_TIMEOUT,
          ErrorCode.DELIVERY_DATE_CALCULATION_FAILED,
          ErrorCode.NOTIFICATION_QUEUE_FULL,
          ErrorCode.HOLIDAY_DATA_UNAVAILABLE
        ]).toContain(error.code)
      }
    })

    // Validation and authentication errors should not be retryable
    const validationErrors = Object.values(ERROR_DEFINITIONS)
      .filter(def => def.category === ErrorCategory.VALIDATION)

    validationErrors.forEach(error => {
      expect(error.retryable).toBe(false)
    })
  })

  it('should have appropriate recovery policies', () => {
    const recoverableErrors = Object.values(ERROR_DEFINITIONS)
      .filter(def => def.recoverable)

    const nonRecoverableErrors = Object.values(ERROR_DEFINITIONS)
      .filter(def => !def.recoverable)

    // System startup failures should not be recoverable
    expect(ERROR_DEFINITIONS[ErrorCode.SYSTEM_STARTUP_FAILED].recoverable).toBe(false)

    // Connection issues should be recoverable
    expect(ERROR_DEFINITIONS[ErrorCode.EMAIL_CONNECTION_FAILED].recoverable).toBe(true)
    expect(ERROR_DEFINITIONS[ErrorCode.DATABASE_CONNECTION_FAILED].recoverable).toBe(true)
  })
})

describe('Error inheritance and extension', () => {
  it('should extend native Error correctly', () => {
    const error = new EchoMailError(ErrorCode.SYSTEM_ERROR)

    expect(error instanceof Error).toBe(true)
    expect(error instanceof EchoMailError).toBe(true)
    expect(error.name).toBe('EchoMailError')
  })

  it('should maintain error chain with cause', () => {
    const originalError = new Error('Database timeout')
    const wrappedError = new EchoMailError(ErrorCode.DATABASE_CONNECTION_FAILED, {}, originalError)

    expect(wrappedError.cause).toBe(originalError)
    expect(wrappedError.message).not.toBe(originalError.message)
  })
})

describe('Performance and memory considerations', () => {
  it('should create errors efficiently', () => {
    const startTime = Date.now()
    const errors = []

    for (let i = 0; i < 1000; i++) {
      errors.push(new EchoMailError(ErrorCode.VALIDATION_FAILED, { iteration: i }))
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    expect(duration).toBeLessThan(100) // Should create 1000 errors in less than 100ms
    expect(errors).toHaveLength(1000)
  })

  it('should handle large context objects', () => {
    const largeContext = {
      data: 'x'.repeat(10000),
      array: Array.from({ length: 1000 }, (_, i) => i),
      nested: {
        deep: {
          structure: {
            with: 'lots of data'
          }
        }
      }
    }

    const error = new EchoMailError(ErrorCode.SYSTEM_ERROR, largeContext)
    const logObject = error.toLogObject()

    expect(logObject.context).toEqual(largeContext)
    expect(JSON.stringify(logObject)).toBeDefined() // Should be serializable
  })
})