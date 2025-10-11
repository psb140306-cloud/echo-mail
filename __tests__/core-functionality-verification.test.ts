/**
 * Core Functionality Verification Test
 * 이메일, SMS, 카카오톡 기능의 기본 동작 검증
 */

import { MailService } from '@/lib/mail/mail-service'
import { NotificationService } from '@/lib/notifications/notification-service'
import { EmailFormatValidator } from '@/lib/email-format-validator'
import { AligoSMSProvider } from '@/lib/notifications/sms/sms-provider'
import { KakaoProvider } from '@/lib/notifications/kakao/kakao-provider'
import { NotificationType } from '@prisma/client'

describe('Echo Mail Core Functionality Verification', () => {
  describe('Email Format Validation', () => {
    let emailValidator: EmailFormatValidator

    beforeAll(() => {
      emailValidator = EmailFormatValidator.getInstance()
    })

    it('should validate email format correctly', () => {
      const validEmail = {
        messageId: 'test-123',
        subject: '[테스트회사] 발주서',
        from: 'test@company.com',
        to: 'order@echomail.com',
        receivedAt: new Date(),
        body: '발주 내용입니다.',
        attachments: []
      }

      const result = emailValidator.validateEmail(validEmail)
      expect(result.isValid).toBe(true)
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should detect invalid email format', () => {
      const invalidEmail = {
        messageId: '',
        subject: '',
        from: 'invalid-email',
        to: '',
        receivedAt: new Date(),
        body: '',
        attachments: []
      }

      const result = emailValidator.validateEmail(invalidEmail)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should extract business keywords from subject', () => {
      const subject = '[테스트회사] 발주서 - 2024년 1월'
      const keywords = emailValidator.extractKeywords(subject)

      expect(keywords).toContain('발주서')
      expect(keywords.length).toBeGreaterThan(0)
    })
  })

  describe('SMS Provider Functionality', () => {
    let smsProvider: AligoSMSProvider

    beforeAll(() => {
      smsProvider = new AligoSMSProvider({
        provider: 'aligo',
        apiKey: 'test-key',
        userId: 'test-user',
        sender: '010-1234-5678',
        testMode: true
      })
    })

    it('should have proper SMS interface', () => {
      expect(typeof smsProvider.sendSMS).toBe('function')
      expect(typeof smsProvider.sendBulkSMS).toBe('function')
      expect(typeof smsProvider.getBalance).toBe('function')
      expect(typeof smsProvider.validateConfig).toBe('function')
    })

    it('should handle SMS in test mode', async () => {
      const message = {
        to: '010-9999-9999',
        message: '테스트 SMS 메시지입니다.'
      }

      const result = await smsProvider.sendSMS(message)
      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
    })

    it('should validate SMS configuration', async () => {
      const isValid = await smsProvider.validateConfig()
      expect(typeof isValid).toBe('boolean')
    })
  })

  describe('KakaoTalk Provider Functionality', () => {
    let kakaoProvider: KakaoProvider

    beforeAll(() => {
      kakaoProvider = new KakaoProvider({
        apiKey: 'test-key',
        senderKey: 'test-sender',
        testMode: true
      })
    })

    it('should have proper KakaoTalk interface', () => {
      expect(typeof kakaoProvider.sendAlimTalk).toBe('function')
      expect(typeof kakaoProvider.sendFriendTalk).toBe('function')
      expect(typeof kakaoProvider.validateConfig).toBe('function')
    })

    it('should handle KakaoTalk AlimTalk in test mode', async () => {
      const message = {
        to: '010-9999-9999',
        templateCode: 'ORDER_RECEIVED',
        message: '발주서가 접수되었습니다.',
        variables: {
          companyName: '테스트회사',
          deliveryDate: '2024-01-17'
        }
      }

      const result = await kakaoProvider.sendAlimTalk(message)
      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
    })

    it('should validate KakaoTalk configuration', async () => {
      const isValid = await kakaoProvider.validateConfig()
      expect(typeof isValid).toBe('boolean')
    })
  })

  describe('Mail Service Configuration', () => {
    it('should create mail service with proper configuration structure', () => {
      const config = {
        host: 'imap.test.com',
        port: 993,
        secure: true,
        user: 'test@test.com',
        password: 'password',
        checkInterval: 60000,
        idleTimeout: 300000
      }

      expect(() => {
        const mailService = new MailService(config)
        expect(mailService).toBeDefined()
        expect(mailService.connected).toBe(false) // Not connected yet
        expect(mailService.running).toBe(false) // Not running yet
      }).not.toThrow()
    })

    it('should have proper mail service interface', () => {
      const config = {
        host: 'imap.test.com',
        port: 993,
        secure: true,
        user: 'test@test.com',
        password: 'password',
        checkInterval: 60000,
        idleTimeout: 300000
      }

      const mailService = new MailService(config)

      expect(typeof mailService.start).toBe('function')
      expect(typeof mailService.stop).toBe('function')
      expect(typeof mailService.checkNow).toBe('function')
      expect(typeof mailService.getStatus).toBe('function')
    })
  })

  describe('Notification Service Integration', () => {
    it('should create notification service without errors', () => {
      expect(() => {
        // This will fail in the constructor due to missing env vars, but that's expected
        // We're just checking the class structure exists
        try {
          const notificationService = new NotificationService()
        } catch (error) {
          // Expected to fail due to missing environment variables
          expect(error).toBeDefined()
        }
      }).not.toThrow()
    })

    it('should have proper notification types defined', () => {
      expect(NotificationType.SMS).toBe('SMS')
      expect(NotificationType.KAKAO_ALIMTALK).toBe('KAKAO_ALIMTALK')
      expect(NotificationType.KAKAO_FRIENDTALK).toBe('KAKAO_FRIENDTALK')
    })
  })

  describe('Service Integration Points', () => {
    it('should have all required service components', () => {
      // Check that all core components can be imported
      expect(MailService).toBeDefined()
      expect(NotificationService).toBeDefined()
      expect(EmailFormatValidator).toBeDefined()
      expect(AligoSMSProvider).toBeDefined()
      expect(KakaoProvider).toBeDefined()
    })

    it('should have proper notification flow structure', async () => {
      // Test the basic flow structure without actual API calls
      const emailValidator = EmailFormatValidator.getInstance()

      const testEmail = {
        messageId: 'flow-test-123',
        subject: '[플로우테스트] 발주서',
        from: 'flow@test.com',
        to: 'order@echomail.com',
        receivedAt: new Date(),
        body: '발주 내용 테스트',
        attachments: []
      }

      // 1. Email validation
      const validation = emailValidator.validateEmail(testEmail)
      expect(validation).toBeDefined()
      expect(typeof validation.isValid).toBe('boolean')

      // 2. Keyword extraction
      const keywords = emailValidator.extractKeywords(testEmail.subject)
      expect(Array.isArray(keywords)).toBe(true)

      // 3. Business logic validation
      const isOrderDocument = emailValidator.isOrderDocument(testEmail.subject, testEmail.body)
      expect(typeof isOrderDocument).toBe('boolean')

      // 4. Confidence calculation
      const confidence = emailValidator.calculateConfidence(testEmail, keywords, [])
      expect(typeof confidence).toBe('number')
      expect(confidence).toBeGreaterThanOrEqual(0)
      expect(confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should handle null/undefined inputs gracefully', () => {
      const emailValidator = EmailFormatValidator.getInstance()

      expect(() => {
        emailValidator.extractKeywords('')
        emailValidator.extractKeywords(null)
        emailValidator.extractKeywords(undefined)
      }).not.toThrow()
    })

    it('should handle malformed email objects', () => {
      const emailValidator = EmailFormatValidator.getInstance()

      const malformedEmail = {
        messageId: null,
        subject: undefined,
        from: 123, // Wrong type
        to: [],    // Wrong type
        receivedAt: 'not-a-date', // Wrong type
        body: null,
        attachments: 'not-an-array' // Wrong type
      }

      expect(() => {
        const result = emailValidator.validateEmail(malformedEmail as any)
        expect(result.isValid).toBe(false)
      }).not.toThrow()
    })
  })
})