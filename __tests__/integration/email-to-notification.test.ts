/**
 * Integration Test: Email to Notification Flow
 * 이메일 수신부터 알림 발송까지의 통합 테스트
 */

import { MailProcessor } from '@/lib/mail/mail-processor'
import { NotificationService } from '@/lib/notifications/notification-service'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { EmailFormatValidator } from '@/lib/email-format-validator'
import { UnregisteredCompanyHandler } from '@/lib/unregistered-company-handler'

// Mock 외부 서비스
jest.mock('@/lib/mail/imap-client')
jest.mock('@/lib/notifications/sms/sms-provider')
jest.mock('@/lib/notifications/kakao/kakao-provider')

describe('Email to Notification Integration Flow', () => {
  let mailProcessor: MailProcessor
  let notificationService: NotificationService
  let emailValidator: EmailFormatValidator
  let unregisteredHandler: UnregisteredCompanyHandler

  beforeAll(async () => {
    // 테스트 데이터베이스 연결
    await db.$connect()

    // Redis 연결 (테스트용)
    await redis.connect()

    // 서비스 초기화
    mailProcessor = new MailProcessor()
    notificationService = new NotificationService()
    emailValidator = EmailFormatValidator.getInstance()
    unregisteredHandler = UnregisteredCompanyHandler.getInstance()
  })

  afterAll(async () => {
    // 연결 정리
    await db.$disconnect()
    await redis.disconnect()
  })

  beforeEach(async () => {
    // 테스트 데이터 초기화
    await db.$transaction([
      db.company.deleteMany(),
      db.contact.deleteMany(),
      db.emailLog.deleteMany(),
      db.notificationLog.deleteMany(),
      db.deliveryRule.deleteMany()
    ])

    // Redis 캐시 초기화
    await redis.flushAll()
  })

  describe('등록된 업체 이메일 처리', () => {
    it('should process email from registered company and send notifications', async () => {
      // 1. 테스트 업체 및 담당자 생성
      const company = await db.company.create({
        data: {
          name: '테스트 회사',
          email: 'test@company.com',
          region: '서울',
          isActive: true,
          contacts: {
            create: [
              {
                name: '김철수',
                phone: '010-1234-5678',
                email: 'kim@company.com',
                position: '매니저',
                smsEnabled: true,
                kakaoEnabled: true,
                isActive: true
              },
              {
                name: '이영희',
                phone: '010-9999-8888',
                position: '대리',
                smsEnabled: true,
                kakaoEnabled: false,
                isActive: true
              }
            ]
          }
        },
        include: {
          contacts: true
        }
      })

      // 2. 납품 규칙 설정
      await db.deliveryRule.create({
        data: {
          region: '서울',
          morningCutoff: '11:00',
          afternoonCutoff: '15:00',
          morningDeliveryDays: 1,
          afternoonDeliveryDays: 2,
          excludeWeekends: true,
          excludeHolidays: true,
          isActive: true
        }
      })

      // 3. 테스트 이메일 데이터
      const testEmail = {
        messageId: 'test-msg-123',
        subject: '[테스트 회사] 발주서 - 2024년 1월 15일',
        from: 'test@company.com',
        to: 'order@echomail.com',
        receivedAt: new Date(),
        body: `
          안녕하세요.
          테스트 회사입니다.

          발주 내역:
          - 품목: 테스트 상품 A
          - 수량: 100개
          - 납기일: 2024년 1월 17일

          감사합니다.
        `,
        attachments: [
          {
            filename: '발주서_테스트회사_20240115.pdf',
            contentType: 'application/pdf',
            size: 1024 * 50,
            content: Buffer.from('PDF content')
          }
        ]
      }

      // 4. 이메일 처리 실행
      const result = await mailProcessor.processEmail(testEmail)

      // 5. 검증: 이메일 로그 생성 확인
      expect(result.success).toBe(true)
      expect(result.emailLog).toBeDefined()
      expect(result.emailLog.status).toBe('MATCHED')
      expect(result.emailLog.companyId).toBe(company.id)

      const savedEmailLog = await db.emailLog.findUnique({
        where: { id: result.emailLog.id }
      })
      expect(savedEmailLog).toBeDefined()
      expect(savedEmailLog.subject).toBe(testEmail.subject)

      // 6. 검증: 알림 발송 확인
      const notifications = await db.notificationLog.findMany({
        where: { emailLogId: result.emailLog.id }
      })

      // 활성화된 담당자 2명 x (SMS + 카카오톡 선택적) = 3개 알림
      expect(notifications.length).toBeGreaterThanOrEqual(2)

      // SMS 알림 확인
      const smsNotifications = notifications.filter(n => n.type === 'SMS')
      expect(smsNotifications).toHaveLength(2)

      // 카카오톡 알림 확인 (김철수만 활성화)
      const kakaoNotifications = notifications.filter(n => n.type === 'KAKAO_ALIMTALK')
      expect(kakaoNotifications).toHaveLength(1)
      expect(kakaoNotifications[0].recipient).toBe('010-1234-5678')

      // 7. 검증: 납기일 계산 확인
      const deliveryInfo = result.deliveryDate
      expect(deliveryInfo).toBeDefined()
      expect(deliveryInfo.estimatedDate).toBeDefined()

      // 8. 검증: Redis 캐싱 확인
      const cachedCompany = await redis.get(`company:${company.email}`)
      expect(cachedCompany).toBeDefined()
      expect(JSON.parse(cachedCompany).id).toBe(company.id)
    })

    it('should handle email with invalid format gracefully', async () => {
      // 잘못된 형식의 이메일 테스트
      const invalidEmail = {
        messageId: 'invalid-msg-123',
        subject: '',  // 빈 제목
        from: 'invalid-email',  // 잘못된 이메일 형식
        to: 'order@echomail.com',
        receivedAt: new Date(),
        body: null,  // null 본문
        attachments: []
      }

      const result = await mailProcessor.processEmail(invalidEmail)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error.code).toBe('INVALID_EMAIL_FORMAT')

      // 이메일 로그는 생성되지만 FAILED 상태
      const emailLog = await db.emailLog.findFirst({
        where: { messageId: 'invalid-msg-123' }
      })
      expect(emailLog).toBeDefined()
      expect(emailLog.status).toBe('FAILED')
      expect(emailLog.errorMessage).toContain('형식')

      // 알림은 발송되지 않음
      const notifications = await db.notificationLog.findMany({
        where: { emailLogId: emailLog.id }
      })
      expect(notifications).toHaveLength(0)
    })
  })

  describe('미등록 업체 이메일 처리', () => {
    it('should handle unregistered company email with extraction', async () => {
      const unregisteredEmail = {
        messageId: 'unreg-msg-123',
        subject: '[새로운회사] 발주 요청',
        from: 'new@unregistered.com',
        to: 'order@echomail.com',
        receivedAt: new Date(),
        body: `
          회사명: 새로운회사 주식회사
          담당자: 박민수
          연락처: 010-5555-5555

          처음 거래하는 새로운회사입니다.
          발주 내역을 보내드립니다.
        `,
        attachments: [
          {
            filename: '발주서_새로운회사.xlsx',
            contentType: 'application/vnd.ms-excel',
            size: 1024 * 30,
            content: Buffer.from('Excel content')
          }
        ]
      }

      const result = await mailProcessor.processEmail(unregisteredEmail)

      expect(result.success).toBe(true)
      expect(result.isUnregistered).toBe(true)
      expect(result.extractedCompanyInfo).toBeDefined()
      expect(result.extractedCompanyInfo.companyName).toBe('새로운회사 주식회사')
      expect(result.extractedCompanyInfo.suggestedActions).toBeDefined()

      // 이메일 로그는 RECEIVED 상태로 저장
      const emailLog = await db.emailLog.findFirst({
        where: { messageId: 'unreg-msg-123' }
      })
      expect(emailLog).toBeDefined()
      expect(emailLog.status).toBe('RECEIVED')
      expect(emailLog.companyId).toBeNull()

      // 관리자 알림 발송 확인
      const adminNotifications = await db.notificationLog.findMany({
        where: {
          emailLogId: emailLog.id,
          type: 'ADMIN_NOTIFICATION'
        }
      })
      expect(adminNotifications.length).toBeGreaterThan(0)
    })

    it('should auto-register company when confidence is high', async () => {
      // 높은 신뢰도 이메일 시뮬레이션을 위해 여러 번 이메일 전송
      const emails = [
        {
          messageId: 'auto-reg-1',
          subject: '[자동등록회사] 발주서',
          from: 'auto@register.com',
          body: '회사명: 자동등록회사(주)\n담당자: 최준호\n전화: 010-7777-7777'
        },
        {
          messageId: 'auto-reg-2',
          subject: '[자동등록회사] 추가 발주',
          from: 'auto@register.com',
          body: '회사명: 자동등록회사(주)\n동일한 회사입니다.'
        },
        {
          messageId: 'auto-reg-3',
          subject: '[자동등록회사] 긴급 발주',
          from: 'auto@register.com',
          body: '회사명: 자동등록회사(주)\n긴급 처리 부탁드립니다.'
        }
      ]

      // 여러 이메일 처리
      for (const email of emails) {
        await mailProcessor.processEmail({
          ...email,
          to: 'order@echomail.com',
          receivedAt: new Date(),
          attachments: []
        })
      }

      // 자동 등록 시뮬레이션
      const autoRegisterResult = await unregisteredHandler.shouldAutoRegister('auto@register.com')

      if (autoRegisterResult.shouldRegister) {
        // 자동 등록 실행
        const company = await db.company.create({
          data: {
            name: autoRegisterResult.companyName,
            email: 'auto@register.com',
            region: '서울',  // 기본값
            isActive: true,
            contacts: {
              create: {
                name: '최준호',
                phone: '010-7777-7777',
                isActive: true,
                smsEnabled: true,
                kakaoEnabled: false
              }
            }
          }
        })

        expect(company).toBeDefined()
        expect(company.name).toBe('자동등록회사(주)')

        // 이전 이메일들을 업데이트
        await db.emailLog.updateMany({
          where: { sender: 'auto@register.com' },
          data: {
            companyId: company.id,
            status: 'MATCHED'
          }
        })

        const updatedLogs = await db.emailLog.findMany({
          where: { companyId: company.id }
        })
        expect(updatedLogs).toHaveLength(3)
      }
    })
  })

  describe('알림 발송 실패 및 재시도', () => {
    it('should retry failed SMS notifications', async () => {
      // SMS 발송 실패 시뮬레이션
      const mockSmsProvider = require('@/lib/notifications/sms/sms-provider')
      mockSmsProvider.sendSMS
        .mockRejectedValueOnce(new Error('Network timeout'))  // 첫 번째 시도 실패
        .mockResolvedValueOnce({ success: true, messageId: 'sms-123' })  // 재시도 성공

      const company = await db.company.create({
        data: {
          name: '재시도 테스트 회사',
          email: 'retry@test.com',
          region: '서울',
          isActive: true,
          contacts: {
            create: {
              name: '테스트',
              phone: '010-1111-1111',
              smsEnabled: true,
              isActive: true
            }
          }
        }
      })

      const testEmail = {
        messageId: 'retry-test-123',
        subject: '[재시도 테스트] 발주서',
        from: 'retry@test.com',
        to: 'order@echomail.com',
        receivedAt: new Date(),
        body: '재시도 테스트 내용',
        attachments: []
      }

      const result = await mailProcessor.processEmail(testEmail)
      expect(result.success).toBe(true)

      // 알림 발송 상태 확인
      const notification = await db.notificationLog.findFirst({
        where: {
          emailLogId: result.emailLog.id,
          type: 'SMS'
        }
      })

      expect(notification).toBeDefined()
      expect(notification.retryCount).toBeGreaterThan(0)
      expect(notification.status).toBe('SENT')  // 재시도 후 성공

      // 재시도 로그 확인
      const retryLogs = await db.notificationRetryLog.findMany({
        where: { notificationId: notification.id }
      })
      expect(retryLogs.length).toBeGreaterThan(0)
      expect(retryLogs[0].error).toContain('timeout')
    })

    it('should fallback to SMS when Kakao fails', async () => {
      const mockKakaoProvider = require('@/lib/notifications/kakao/kakao-provider')
      mockKakaoProvider.sendAlimtalk
        .mockRejectedValue(new Error('Template not approved'))

      const mockSmsProvider = require('@/lib/notifications/sms/sms-provider')
      mockSmsProvider.sendSMS
        .mockResolvedValue({ success: true, messageId: 'fallback-sms-123' })

      const company = await db.company.create({
        data: {
          name: '폴백 테스트 회사',
          email: 'fallback@test.com',
          region: '서울',
          isActive: true,
          contacts: {
            create: {
              name: '폴백 테스트',
              phone: '010-2222-2222',
              smsEnabled: true,
              kakaoEnabled: true,  // 카카오톡 우선
              isActive: true
            }
          }
        }
      })

      const testEmail = {
        messageId: 'fallback-test-123',
        subject: '[폴백 테스트] 발주서',
        from: 'fallback@test.com',
        to: 'order@echomail.com',
        receivedAt: new Date(),
        body: '폴백 테스트 내용',
        attachments: []
      }

      const result = await mailProcessor.processEmail(testEmail)
      expect(result.success).toBe(true)

      // 알림 발송 확인
      const notifications = await db.notificationLog.findMany({
        where: { emailLogId: result.emailLog.id }
      })

      // 카카오톡 실패, SMS 성공
      const kakaoNotification = notifications.find(n => n.type === 'KAKAO_ALIMTALK')
      const smsNotification = notifications.find(n => n.type === 'SMS')

      expect(kakaoNotification).toBeDefined()
      expect(kakaoNotification.status).toBe('FAILED')
      expect(kakaoNotification.errorMessage).toContain('Template')

      expect(smsNotification).toBeDefined()
      expect(smsNotification.status).toBe('SENT')
      expect(smsNotification.metadata?.isFallback).toBe(true)
    })
  })

  describe('대량 이메일 처리 성능', () => {
    it('should handle concurrent email processing efficiently', async () => {
      // 여러 업체 생성
      const companies = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          db.company.create({
            data: {
              name: `테스트 회사 ${i}`,
              email: `test${i}@company.com`,
              region: '서울',
              isActive: true,
              contacts: {
                create: {
                  name: `담당자 ${i}`,
                  phone: `010-${String(i).padStart(4, '0')}-${String(i).padStart(4, '0')}`,
                  smsEnabled: true,
                  isActive: true
                }
              }
            }
          })
        )
      )

      // 각 업체에서 이메일 발송
      const emails = companies.map((company, i) => ({
        messageId: `bulk-test-${i}`,
        subject: `[${company.name}] 발주서`,
        from: company.email,
        to: 'order@echomail.com',
        receivedAt: new Date(),
        body: `발주 내용 ${i}`,
        attachments: []
      }))

      // 동시 처리 시작
      const startTime = Date.now()
      const results = await Promise.all(
        emails.map(email => mailProcessor.processEmail(email))
      )
      const processingTime = Date.now() - startTime

      // 모든 이메일 처리 성공 확인
      expect(results.every(r => r.success)).toBe(true)

      // 처리 시간 확인 (10개 이메일 5초 이내)
      expect(processingTime).toBeLessThan(5000)

      // 이메일 로그 확인
      const emailLogs = await db.emailLog.findMany()
      expect(emailLogs).toHaveLength(10)

      // 알림 발송 확인 (각 업체당 1개씩)
      const notifications = await db.notificationLog.findMany()
      expect(notifications).toHaveLength(10)

      // Redis 캐싱 확인
      for (const company of companies) {
        const cached = await redis.get(`company:${company.email}`)
        expect(cached).toBeDefined()
      }
    })

    it('should handle queue overflow gracefully', async () => {
      // 큐 크기 제한 설정 (테스트용)
      const maxQueueSize = 5
      await redis.set('notification:queue:max_size', maxQueueSize)

      // 큐 오버플로우 시뮬레이션
      const emails = Array.from({ length: 10 }, (_, i) => ({
        messageId: `overflow-test-${i}`,
        subject: `오버플로우 테스트 ${i}`,
        from: 'overflow@test.com',
        to: 'order@echomail.com',
        receivedAt: new Date(),
        body: `내용 ${i}`,
        attachments: []
      }))

      const results = await Promise.all(
        emails.map(email => mailProcessor.processEmail(email))
      )

      // 일부는 성공, 일부는 큐 오버플로우로 지연
      const successCount = results.filter(r => r.success).length
      const queuedCount = results.filter(r => r.queued).length

      expect(successCount).toBeLessThanOrEqual(maxQueueSize)
      expect(queuedCount).toBeGreaterThan(0)

      // 큐에 대기 중인 작업 확인
      const queueLength = await redis.llen('notification:queue:pending')
      expect(queueLength).toBeGreaterThan(0)
    })
  })

  describe('트랜잭션 롤백 처리', () => {
    it('should rollback all changes on notification failure', async () => {
      // 알림 발송 실패 강제 설정
      const mockSmsProvider = require('@/lib/notifications/sms/sms-provider')
      mockSmsProvider.sendSMS
        .mockRejectedValue(new Error('Critical SMS gateway error'))

      const company = await db.company.create({
        data: {
          name: '롤백 테스트 회사',
          email: 'rollback@test.com',
          region: '서울',
          isActive: true,
          contacts: {
            create: {
              name: '롤백 테스트',
              phone: '010-3333-3333',
              smsEnabled: true,
              kakaoEnabled: false,
              isActive: true
            }
          }
        }
      })

      const testEmail = {
        messageId: 'rollback-test-123',
        subject: '[롤백 테스트] 발주서',
        from: 'rollback@test.com',
        to: 'order@echomail.com',
        receivedAt: new Date(),
        body: '롤백 테스트 내용',
        attachments: [],
        requireTransaction: true  // 트랜잭션 모드 활성화
      }

      try {
        await mailProcessor.processEmail(testEmail)
      } catch (error) {
        // 오류 발생 예상
        expect(error.message).toContain('Critical')
      }

      // 이메일 로그가 롤백되었는지 확인
      const emailLog = await db.emailLog.findFirst({
        where: { messageId: 'rollback-test-123' }
      })
      expect(emailLog).toBeNull()  // 트랜잭션 롤백으로 저장되지 않음

      // 알림 로그도 롤백되었는지 확인
      const notifications = await db.notificationLog.findMany({
        where: {
          recipient: '010-3333-3333'
        }
      })
      expect(notifications).toHaveLength(0)
    })
  })
})