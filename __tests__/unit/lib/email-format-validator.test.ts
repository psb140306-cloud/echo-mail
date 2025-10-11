/**
 * Unit Tests for Email Format Validator
 * 이메일 형식 검증 로직 단위 테스트
 */

import {
  EmailFormatValidator,
  EmailErrorType,
  EmailWarningType,
  ErrorSeverity,
} from '@/lib/email-format-validator'

describe('EmailFormatValidator', () => {
  let validator: EmailFormatValidator

  beforeEach(() => {
    validator = EmailFormatValidator.getInstance()
  })

  describe('validateEmail', () => {
    it('should validate a proper business email successfully', async () => {
      const emailData = {
        from: '업체담당자 <contact@company.com>',
        subject: '[긴급] 발주 요청서',
        body: '안녕하세요. ABC 회사입니다. 첨부한 발주서를 확인해주세요.',
        attachments: [
          {
            name: '발주서_ABC회사.pdf',
            content: Buffer.from('%PDF-1.4 test content'),
            contentType: 'application/pdf',
          },
        ],
        size: 1024 * 500, // 500KB
        receivedAt: new Date(),
      }

      const result = await validator.validateEmail(emailData)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.7)
      expect(result.errors).toHaveLength(0)
      expect(result.extractedData).toBeDefined()
      expect(result.extractedData?.sender.email).toBe('contact@company.com')
    })

    it('should detect invalid sender email format', async () => {
      const emailData = {
        from: 'invalid-email',
        subject: '테스트',
        body: '테스트 내용',
      }

      const result = await validator.validateEmail(emailData)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: EmailErrorType.INVALID_SENDER,
          severity: 'CRITICAL',
        })
      )
    })

    it('should detect empty email content', async () => {
      const emailData = {
        from: 'test@company.com',
        subject: '',
        body: '',
        html: '',
      }

      const result = await validator.validateEmail(emailData)

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: EmailErrorType.EMPTY_CONTENT,
          severity: 'HIGH',
        })
      )
    })

    it('should detect oversized emails', async () => {
      const emailData = {
        from: 'test@company.com',
        subject: '테스트',
        body: '테스트',
        size: 30 * 1024 * 1024, // 30MB (제한: 25MB)
      }

      const result = await validator.validateEmail(emailData)

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: EmailErrorType.OVERSIZED_EMAIL,
          severity: 'HIGH',
        })
      )
    })

    it('should validate attachments properly', async () => {
      const emailData = {
        from: 'test@company.com',
        subject: '발주서',
        body: '발주서 첨부합니다.',
        attachments: [
          {
            name: 'order.pdf',
            content: Buffer.from('%PDF-1.4'),
            contentType: 'application/pdf',
          },
          {
            name: 'suspicious.exe',
            content: Buffer.from('MZ'), // PE 헤더
            contentType: 'application/octet-stream',
          },
        ],
      }

      const result = await validator.validateEmail(emailData)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: EmailWarningType.UNUSUAL_FORMATTING,
          field: 'attachment',
        })
      )
    })

    it('should extract business keywords from subject', async () => {
      const emailData = {
        from: 'test@company.com',
        subject: '[긴급] 주문 요청서 - ABC 회사',
        body: '주문 내용입니다.',
      }

      const result = await validator.validateEmail(emailData)

      expect(result.extractedData?.subject.keywords).toContain('주문')
    })

    it('should detect spam-like content', async () => {
      const emailData = {
        from: 'test@suspicious.com',
        subject: '!!!무료 당첨!!! 클릭하세요!!!',
        body: '무료로 돈을 받으세요. 여기를 클릭하세요!',
      }

      const result = await validator.validateEmail(emailData)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: EmailWarningType.POTENTIAL_SPAM,
        })
      )
    })

    it('should detect temporary email domains', async () => {
      const emailData = {
        from: 'test@10minutemail.com',
        subject: '테스트',
        body: '테스트 내용',
      }

      const result = await validator.validateEmail(emailData)

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: EmailErrorType.INVALID_SENDER,
          field: 'from',
        })
      )
    })
  })

  describe('extractSenderInfo', () => {
    it('should extract sender name and email correctly', () => {
      const validator = EmailFormatValidator.getInstance()

      // Private method testing - accessing via any type
      const extractSenderInfo = (validator as any).extractSenderInfo.bind(validator)

      const result1 = extractSenderInfo('"홍길동" <hong@company.com>')
      expect(result1).toEqual({
        email: 'hong@company.com',
        name: '홍길동',
        domain: 'company.com',
      })

      const result2 = extractSenderInfo('ABC 회사 <info@abc.co.kr>')
      expect(result2).toEqual({
        email: 'info@abc.co.kr',
        name: 'ABC 회사',
        domain: 'abc.co.kr',
      })

      const result3 = extractSenderInfo('simple@test.com')
      expect(result3).toEqual({
        email: 'simple@test.com',
        name: undefined,
        domain: 'test.com',
      })
    })
  })

  describe('extractKeywords', () => {
    it('should extract order-related keywords', () => {
      const validator = EmailFormatValidator.getInstance()
      const extractKeywords = (validator as any).extractKeywords.bind(validator)

      const keywords1 = extractKeywords('[긴급] 발주 요청서 - 오늘 처리 부탁')
      expect(keywords1).toContain('발주')
      expect(keywords1).toContain('긴급')
      expect(keywords1).toContain('오늘')

      const keywords2 = extractKeywords('Order confirmation for ABC company')
      expect(keywords2).toContain('order')

      const keywords3 = extractKeywords('견적서 요청합니다')
      expect(keywords3).toContain('견적')
    })
  })

  describe('isOrderDocument', () => {
    it('should identify order documents correctly', () => {
      const validator = EmailFormatValidator.getInstance()
      const isOrderDocument = (validator as any).isOrderDocument.bind(validator)

      expect(isOrderDocument('발주서_ABC회사.pdf')).toBe(true)
      expect(isOrderDocument('Order_Form_2024.xlsx')).toBe(true)
      expect(isOrderDocument('견적서_20240101.hwp')).toBe(true)
      expect(isOrderDocument('Invoice_12345.pdf')).toBe(true)
      expect(isOrderDocument('주문내역.docx')).toBe(true)

      expect(isOrderDocument('random_file.txt')).toBe(false)
      expect(isOrderDocument('photo.jpg')).toBe(false)
    })
  })

  describe('isSuspiciousDomain', () => {
    it('should detect suspicious domains', () => {
      const validator = EmailFormatValidator.getInstance()
      const isSuspiciousDomain = (validator as any).isSuspiciousDomain.bind(validator)

      expect(isSuspiciousDomain('tempmail.com')).toBe(true)
      expect(isSuspiciousDomain('10minutemail.com')).toBe(true)
      expect(isSuspiciousDomain('guerrillamail.com')).toBe(true)

      expect(isSuspiciousDomain('company.com')).toBe(false)
      expect(isSuspiciousDomain('gmail.com')).toBe(false)
      expect(isSuspiciousDomain('naver.com')).toBe(false)
    })
  })

  describe('isSpamSubject', () => {
    it('should detect spam-like subjects', () => {
      const validator = EmailFormatValidator.getInstance()
      const isSpamSubject = (validator as any).isSpamSubject.bind(validator)

      expect(isSpamSubject('무료 당첨!!!')).toBe(true)
      expect(isSpamSubject('URGENT: Click here now!!!')).toBe(true)
      expect(isSpamSubject('당첨되셨습니다 클릭하세요')).toBe(true)

      expect(isSpamSubject('발주 요청서')).toBe(false)
      expect(isSpamSubject('회의 안건 공유')).toBe(false)
      expect(isSpamSubject('Order confirmation')).toBe(false)
    })
  })

  describe('hasEncodingIssues', () => {
    it('should detect encoding problems', () => {
      const validator = EmailFormatValidator.getInstance()
      const hasEncodingIssues = (validator as any).hasEncodingIssues.bind(validator)

      expect(hasEncodingIssues('정상적인 한글 텍스트')).toBe(false)
      expect(hasEncodingIssues('Normal English text')).toBe(false)

      expect(hasEncodingIssues('��한글이 깨졌습니다��')).toBe(true)
      expect(hasEncodingIssues('Text with ????? encoding issues')).toBe(true)
    })
  })

  describe('calculateConfidence', () => {
    it('should calculate confidence score correctly', () => {
      const validator = EmailFormatValidator.getInstance()
      const calculateConfidence = (validator as any).calculateConfidence.bind(validator)

      // No errors, no warnings
      const confidence1 = calculateConfidence([], [], {
        businessData: {
          orderInfo: { confidence: 0.8 },
          companyInfo: { confidence: 0.9 },
          deliveryInfo: { confidence: 0.7 },
        },
      })
      expect(confidence1).toBeGreaterThan(0.7)

      // Critical errors
      const confidence2 = calculateConfidence([{ severity: 'CRITICAL' }], [], undefined)
      expect(confidence2).toBeLessThan(0.2)

      // Multiple warnings
      const confidence3 = calculateConfidence(
        [],
        [{ type: 'UNCLEAR_SUBJECT' }, { type: 'UNUSUAL_FORMATTING' }, { type: 'POTENTIAL_SPAM' }],
        undefined
      )
      expect(confidence3).toBeLessThan(0.8)
    })
  })

  describe('edge cases', () => {
    it('should handle null/undefined inputs gracefully', async () => {
      const emailData = {
        from: 'test@company.com',
        subject: null,
        body: undefined,
        attachments: null,
      } as any

      const result = await validator.validateEmail(emailData)

      // Should not throw error and return some result
      expect(result).toBeDefined()
      expect(result.isValid).toBeDefined()
      expect(result.errors).toBeDefined()
      expect(result.warnings).toBeDefined()
    })

    it('should handle very long subjects and content', async () => {
      const longSubject = 'A'.repeat(1000)
      const longContent = 'B'.repeat(100000)

      const emailData = {
        from: 'test@company.com',
        subject: longSubject,
        body: longContent,
      }

      const result = await validator.validateEmail(emailData)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: EmailWarningType.UNUSUAL_FORMATTING,
          field: 'subject',
        })
      )

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: EmailWarningType.UNUSUAL_FORMATTING,
          field: 'content',
        })
      )
    })

    it('should handle corrupted PDF files', async () => {
      const emailData = {
        from: 'test@company.com',
        subject: '발주서',
        body: '발주서입니다.',
        attachments: [
          {
            name: 'order.pdf',
            content: Buffer.from('Not a real PDF content'),
            contentType: 'application/pdf',
          },
        ],
      }

      const result = await validator.validateEmail(emailData)

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: EmailErrorType.CORRUPTED_ATTACHMENT,
        })
      )
    })
  })

  describe('performance', () => {
    it('should validate emails within reasonable time', async () => {
      const emailData = {
        from: 'test@company.com',
        subject: '발주 요청서',
        body: '발주 내용'.repeat(1000), // 큰 내용
        attachments: [
          {
            name: 'large_order.pdf',
            content: Buffer.alloc(1024 * 1024), // 1MB
            contentType: 'application/pdf',
          },
        ],
      }

      const startTime = Date.now()
      const result = await validator.validateEmail(emailData)
      const endTime = Date.now()

      // 5초 이내에 완료되어야 함
      expect(endTime - startTime).toBeLessThan(5000)
      expect(result).toBeDefined()
    })
  })
})
