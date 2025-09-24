/**
 * Unit Tests for Unregistered Company Handler
 * 미등록 업체 처리 로직 단위 테스트
 */

import {
  UnregisteredCompanyHandler,
  UnregisteredCompanyAction,
  CompanyExtractionResult
} from '@/lib/unregistered-company-handler'

// Mock dependencies
jest.mock('@/lib/error-handler')
jest.mock('@/lib/logger')

describe('UnregisteredCompanyHandler', () => {
  let handler: UnregisteredCompanyHandler

  beforeEach(() => {
    handler = UnregisteredCompanyHandler.getInstance()
    // Clear internal state
    ;(handler as any).unregisteredCompanies.clear()
  })

  describe('handleUnregisteredEmail', () => {
    it('should create new unregistered company info for first-time sender', async () => {
      const senderEmail = 'new@company.com'
      const emailContent = {
        subject: '[ABC 회사] 발주 요청서',
        body: '안녕하세요. ABC 회사입니다.',
        attachments: [
          {
            name: 'order_ABC.pdf',
            content: Buffer.from('PDF content')
          }
        ]
      }

      const result = await handler.handleUnregisteredEmail(senderEmail, emailContent)

      expect(result.action).toBeDefined()
      expect(result.companyInfo).toBeDefined()
      expect(result.companyInfo?.email).toBe(senderEmail)
      expect(result.companyInfo?.emailCount).toBe(1)
      expect(result.companyInfo?.companyName).toBe('ABC 회사')
    })

    it('should update existing unregistered company info', async () => {
      const senderEmail = 'existing@company.com'
      const firstEmail = {
        subject: '첫 번째 이메일',
        body: '첫 번째 내용'
      }
      const secondEmail = {
        subject: '두 번째 이메일',
        body: '두 번째 내용'
      }

      // 첫 번째 이메일 처리
      await handler.handleUnregisteredEmail(senderEmail, firstEmail)

      // 두 번째 이메일 처리
      const result = await handler.handleUnregisteredEmail(senderEmail, secondEmail)

      expect(result.companyInfo?.emailCount).toBe(2)
      expect(result.companyInfo?.extractedFromEmail?.subject).toBe('두 번째 이메일')
    })

    it('should suggest auto-registration for high confidence extraction', async () => {
      const senderEmail = 'highconf@company.com'
      const emailContent = {
        subject: '[XYZ 주식회사] 발주서',
        body: '회사명: XYZ 주식회사\n담당자: 김철수\n전화: 02-1234-5678',
        attachments: [
          {
            name: '발주서_XYZ주식회사.pdf',
            content: Buffer.from('%PDF-1.4 content')
          }
        ]
      }

      // 여러 번 이메일을 보내서 emailCount를 늘림
      await handler.handleUnregisteredEmail(senderEmail, emailContent)
      const result = await handler.handleUnregisteredEmail(senderEmail, emailContent)

      expect(result.companyInfo?.suggestedActions).toContainEqual(
        expect.objectContaining({
          type: 'AUTO_REGISTER',
          confidence: expect.any(Number)
        })
      )
    })

    it('should suggest blocking for excessive emails', async () => {
      const senderEmail = 'spam@company.com'
      const emailContent = {
        subject: 'Spam email',
        body: 'Spam content'
      }

      // 대량의 이메일을 짧은 시간에 발송
      const companyInfo = {
        email: senderEmail,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        emailCount: 15, // 과도한 이메일
        suggestedActions: [],
        extractedFromEmail: {
          subject: emailContent.subject,
          body: emailContent.body
        }
      }

      // Internal state 직접 설정
      ;(handler as any).unregisteredCompanies.set(senderEmail, companyInfo)

      const result = await handler.handleUnregisteredEmail(senderEmail, emailContent)

      expect(result.companyInfo?.suggestedActions).toContainEqual(
        expect.objectContaining({
          type: 'BLOCK'
        })
      )
    })
  })

  describe('extractFromSubject', () => {
    it('should extract company names from various subject patterns', async () => {
      const handler = UnregisteredCompanyHandler.getInstance()
      const extractFromSubject = (handler as any).extractFromSubject.bind(handler)

      // [업체명] 패턴
      const result1 = await extractFromSubject('[ABC 회사] 발주 요청')
      expect(result1.companyName).toBe('ABC 회사')
      expect(result1.confidence).toBeGreaterThan(0.6)

      // (주) 패턴
      const result2 = await extractFromSubject('(주)테크놀로지 발주서')
      expect(result2.companyName).toBe('테크놀로지')

      // 주식회사 패턴
      const result3 = await extractFromSubject('주식회사 삼성전자 주문서')
      expect(result3.companyName).toBe('삼성전자')

      // 일반적인 회사 패턴
      const result4 = await extractFromSubject('현대자동차 회사 발주')
      expect(result4.companyName).toBe('현대자동차')
    })

    it('should return low confidence for unclear subjects', async () => {
      const handler = UnregisteredCompanyHandler.getInstance()
      const extractFromSubject = (handler as any).extractFromSubject.bind(handler)

      const result = await extractFromSubject('일반적인 제목')
      expect(result.confidence).toBe(0)
      expect(result.companyName).toBeUndefined()
    })
  })

  describe('extractFromBody', () => {
    it('should extract company names from email body', async () => {
      const handler = UnregisteredCompanyHandler.getInstance()
      const extractFromBody = (handler as any).extractFromBody.bind(handler)

      const body1 = `
안녕하세요.
회사명: LG전자 주식회사
담당자: 이영희
연락처: 02-111-2222
`
      const result1 = await extractFromBody(body1)
      expect(result1.companyName).toBe('LG전자 주식회사')

      const body2 = `
보내는 회사: 네이버
내용: 발주 요청드립니다.
`
      const result2 = await extractFromBody(body2)
      expect(result2.companyName).toBe('네이버')
    })
  })

  describe('extractFromAttachment', () => {
    it('should extract company names from attachment filenames', async () => {
      const handler = UnregisteredCompanyHandler.getInstance()
      const extractFromAttachment = (handler as any).extractFromAttachment.bind(handler)

      const attachment1 = {
        name: 'Samsung_발주서.pdf',
        content: Buffer.from('content')
      }
      const result1 = await extractFromAttachment(attachment1)
      expect(result1.companyName).toBe('Samsung')

      const attachment2 = {
        name: 'Apple_Korea-주문서.xlsx',
        content: Buffer.from('content')
      }
      const result2 = await extractFromAttachment(attachment2)
      expect(result2.companyName).toBe('Apple_Korea')

      const attachment3 = {
        name: 'random_file.txt',
        content: Buffer.from('content')
      }
      const result3 = await extractFromAttachment(attachment3)
      expect(result3.confidence).toBe(0)
    })
  })

  describe('canAutoRegister', () => {
    it('should allow auto-registration for high confidence with multiple emails', () => {
      const handler = UnregisteredCompanyHandler.getInstance()
      const canAutoRegister = (handler as any).canAutoRegister.bind(handler)

      const companyInfo = {
        email: 'test@company.com',
        emailCount: 3,
        companyName: 'Test Company'
      }

      const extractionResult = {
        companyName: 'Test Company',
        confidence: 0.85,
        source: 'SUBJECT'
      }

      expect(canAutoRegister(companyInfo, extractionResult)).toBe(true)
    })

    it('should reject auto-registration for low confidence', () => {
      const handler = UnregisteredCompanyHandler.getInstance()
      const canAutoRegister = (handler as any).canAutoRegister.bind(handler)

      const companyInfo = {
        email: 'test@company.com',
        emailCount: 5,
        companyName: 'Test Company'
      }

      const extractionResult = {
        companyName: 'Test Company',
        confidence: 0.5, // 낮은 신뢰도
        source: 'SUBJECT'
      }

      expect(canAutoRegister(companyInfo, extractionResult)).toBe(false)
    })
  })

  describe('shouldBlock', () => {
    it('should block companies with excessive daily emails', () => {
      const handler = UnregisteredCompanyHandler.getInstance()
      const shouldBlock = (handler as any).shouldBlock.bind(handler)

      const companyInfo = {
        email: 'spam@company.com',
        emailCount: 20,
        firstSeenAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1일 전
        lastSeenAt: new Date()
      }

      expect(shouldBlock(companyInfo)).toBe(true)
    })

    it('should not block companies with normal email frequency', () => {
      const handler = UnregisteredCompanyHandler.getInstance()
      const shouldBlock = (handler as any).shouldBlock.bind(handler)

      const companyInfo = {
        email: 'normal@company.com',
        emailCount: 3,
        firstSeenAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7일 전
        lastSeenAt: new Date()
      }

      expect(shouldBlock(companyInfo)).toBe(false)
    })
  })

  describe('getUnregisteredCompanies', () => {
    it('should return paginated list of unregistered companies', async () => {
      const handler = UnregisteredCompanyHandler.getInstance()

      // Add test data
      for (let i = 0; i < 15; i++) {
        await handler.handleUnregisteredEmail(
          `test${i}@company.com`,
          { subject: `Test ${i}`, body: `Content ${i}` }
        )
      }

      const result = await handler.getUnregisteredCompanies(5, 0)

      expect(result.companies).toHaveLength(5)
      expect(result.total).toBe(15)
    })

    it('should return companies sorted by last seen date', async () => {
      const handler = UnregisteredCompanyHandler.getInstance()

      // Add companies with different timestamps
      const companies = ['old@test.com', 'new@test.com', 'middle@test.com']

      for (let i = 0; i < companies.length; i++) {
        await handler.handleUnregisteredEmail(
          companies[i],
          { subject: `Test ${i}`, body: `Content ${i}` }
        )

        // Simulate time passage
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      const result = await handler.getUnregisteredCompanies(10, 0)

      // Should be sorted by lastSeenAt descending
      expect(result.companies[0].email).toBe('middle@test.com')
      expect(result.companies[2].email).toBe('old@test.com')
    })
  })

  describe('approveUnregisteredCompany', () => {
    it('should approve and register a company', async () => {
      const handler = UnregisteredCompanyHandler.getInstance()
      const email = 'approve@test.com'

      // Add unregistered company
      await handler.handleUnregisteredEmail(email, {
        subject: 'Test',
        body: 'Test content'
      })

      const companyData = {
        name: 'Test Company',
        region: '서울',
        contacts: [
          {
            name: '담당자',
            phone: '02-1234-5678',
            email: email,
            position: '매니저'
          }
        ]
      }

      const result = await handler.approveUnregisteredCompany(email, companyData)

      expect(result.success).toBe(true)

      // Should be removed from unregistered list
      const unregisteredCompany = await handler.getUnregisteredCompany(email)
      expect(unregisteredCompany).toBeNull()
    })
  })

  describe('rejectUnregisteredCompany', () => {
    it('should reject and block a company', async () => {
      const handler = UnregisteredCompanyHandler.getInstance()
      const email = 'reject@test.com'

      // Add unregistered company
      await handler.handleUnregisteredEmail(email, {
        subject: 'Test',
        body: 'Test content'
      })

      await handler.rejectUnregisteredCompany(email, '스팸으로 판단')

      // Should be removed from unregistered list
      const unregisteredCompany = await handler.getUnregisteredCompany(email)
      expect(unregisteredCompany).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle malformed email content gracefully', async () => {
      const emailContent = {
        subject: null,
        body: undefined,
        attachments: null
      } as any

      const result = await handler.handleUnregisteredEmail('test@test.com', emailContent)

      expect(result).toBeDefined()
      expect(result.action).toBeDefined()
    })

    it('should handle very long company names', async () => {
      const longName = 'A'.repeat(200)
      const emailContent = {
        subject: `[${longName}] 발주`,
        body: `회사명: ${longName}`
      }

      const result = await handler.handleUnregisteredEmail('long@test.com', emailContent)

      // Should still process but may have lower confidence
      expect(result.companyInfo).toBeDefined()
    })

    it('should handle concurrent requests for same email', async () => {
      const email = 'concurrent@test.com'
      const emailContent = {
        subject: 'Test',
        body: 'Test content'
      }

      // Simulate concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        handler.handleUnregisteredEmail(email, emailContent)
      )

      const results = await Promise.all(promises)

      // All should complete successfully
      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(result.companyInfo).toBeDefined()
      })

      // Final count should reflect all emails
      const companyInfo = await handler.getUnregisteredCompany(email)
      expect(companyInfo?.emailCount).toBe(5)
    })
  })

  describe('performance', () => {
    it('should process emails within reasonable time limits', async () => {
      const largeEmailContent = {
        subject: 'Large email test',
        body: 'Content '.repeat(10000), // Large body
        attachments: [
          {
            name: 'large_attachment.pdf',
            content: Buffer.alloc(1024 * 100) // 100KB
          }
        ]
      }

      const startTime = Date.now()
      const result = await handler.handleUnregisteredEmail('perf@test.com', largeEmailContent)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(3000) // Should complete within 3 seconds
      expect(result).toBeDefined()
    })

    it('should handle large number of unregistered companies efficiently', async () => {
      const handler = UnregisteredCompanyHandler.getInstance()

      // Add many companies
      const promises = Array.from({ length: 100 }, (_, i) =>
        handler.handleUnregisteredEmail(
          `perf${i}@test.com`,
          { subject: `Test ${i}`, body: `Content ${i}` }
        )
      )

      const startTime = Date.now()
      await Promise.all(promises)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds

      // Verify all were processed
      const result = await handler.getUnregisteredCompanies(200, 0)
      expect(result.total).toBe(100)
    })
  })
})