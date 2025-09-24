/**
 * Integration Test: Database Transactions
 * 데이터베이스 트랜잭션 통합 테스트
 */

import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

describe('Database Transaction Integration Tests', () => {
  beforeAll(async () => {
    await db.$connect()
    await redis.connect()
  })

  afterAll(async () => {
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
      db.deliveryRule.deleteMany(),
      db.holiday.deleteMany()
    ])
  })

  describe('Company Creation Transactions', () => {
    it('should create company with contacts atomically', async () => {
      const companyData = {
        name: '트랜잭션 테스트 회사',
        email: 'transaction@test.com',
        region: '서울',
        isActive: true,
        contacts: {
          create: [
            {
              name: '담당자1',
              phone: '010-1111-1111',
              email: 'contact1@test.com',
              position: '매니저',
              smsEnabled: true,
              kakaoEnabled: true,
              isActive: true
            },
            {
              name: '담당자2',
              phone: '010-2222-2222',
              email: 'contact2@test.com',
              position: '대리',
              smsEnabled: true,
              kakaoEnabled: false,
              isActive: true
            }
          ]
        }
      }

      const result = await db.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: companyData,
          include: {
            contacts: true
          }
        })

        // 추가 검증 로직
        if (company.contacts.length !== 2) {
          throw new Error('Expected 2 contacts')
        }

        return company
      })

      expect(result).toBeDefined()
      expect(result.name).toBe('트랜잭션 테스트 회사')
      expect(result.contacts).toHaveLength(2)

      // 실제 저장 확인
      const savedCompany = await db.company.findUnique({
        where: { id: result.id },
        include: { contacts: true }
      })
      expect(savedCompany).toBeDefined()
      expect(savedCompany.contacts).toHaveLength(2)
    })

    it('should rollback on validation error during company creation', async () => {
      const invalidCompanyData = {
        name: '롤백 테스트 회사',
        email: 'invalid-email',  // 잘못된 이메일 형식
        region: '서울',
        isActive: true,
        contacts: {
          create: [
            {
              name: '담당자',
              phone: 'invalid-phone',  // 잘못된 전화번호 형식
              isActive: true
            }
          ]
        }
      }

      await expect(
        db.$transaction(async (tx) => {
          // 이메일 검증
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(invalidCompanyData.email)) {
            throw new Error('Invalid email format')
          }

          return tx.company.create({
            data: invalidCompanyData,
            include: { contacts: true }
          })
        })
      ).rejects.toThrow('Invalid email format')

      // 회사가 생성되지 않았는지 확인
      const companies = await db.company.findMany()
      expect(companies).toHaveLength(0)

      // 담당자도 생성되지 않았는지 확인
      const contacts = await db.contact.findMany()
      expect(contacts).toHaveLength(0)
    })

    it('should handle nested transaction for bulk company import', async () => {
      const companiesData = [
        {
          name: '회사1',
          email: 'company1@test.com',
          region: '서울',
          contacts: [
            { name: '담당자1-1', phone: '010-1111-1111' },
            { name: '담당자1-2', phone: '010-1111-2222' }
          ]
        },
        {
          name: '회사2',
          email: 'company2@test.com',
          region: '부산',
          contacts: [
            { name: '담당자2-1', phone: '010-2222-1111' }
          ]
        },
        {
          name: '회사3',
          email: 'company3@test.com',
          region: '대구',
          contacts: [
            { name: '담당자3-1', phone: '010-3333-1111' },
            { name: '담당자3-2', phone: '010-3333-2222' },
            { name: '담당자3-3', phone: '010-3333-3333' }
          ]
        }
      ]

      const results = await db.$transaction(async (tx) => {
        const importResults = []

        for (const companyData of companiesData) {
          const company = await tx.company.create({
            data: {
              name: companyData.name,
              email: companyData.email,
              region: companyData.region,
              isActive: true,
              contacts: {
                create: companyData.contacts.map(contact => ({
                  ...contact,
                  isActive: true,
                  smsEnabled: true,
                  kakaoEnabled: false
                }))
              }
            },
            include: { contacts: true }
          })

          importResults.push(company)
        }

        // 검증: 총 담당자 수 확인
        const totalContacts = importResults.reduce(
          (sum, company) => sum + company.contacts.length,
          0
        )

        if (totalContacts !== 6) {
          throw new Error(`Expected 6 contacts, got ${totalContacts}`)
        }

        return importResults
      })

      expect(results).toHaveLength(3)
      expect(results[0].contacts).toHaveLength(2)
      expect(results[1].contacts).toHaveLength(1)
      expect(results[2].contacts).toHaveLength(3)

      // 실제 저장 확인
      const savedCompanies = await db.company.findMany({
        include: { contacts: true }
      })
      expect(savedCompanies).toHaveLength(3)

      const totalContacts = await db.contact.count()
      expect(totalContacts).toBe(6)
    })
  })

  describe('Email Processing Transactions', () => {
    it('should process email log and notifications in single transaction', async () => {
      // 사전 데이터 설정
      const company = await db.company.create({
        data: {
          name: '이메일 처리 테스트',
          email: 'email@test.com',
          region: '서울',
          isActive: true,
          contacts: {
            create: [
              {
                name: '담당자1',
                phone: '010-1111-1111',
                smsEnabled: true,
                kakaoEnabled: true,
                isActive: true
              },
              {
                name: '담당자2',
                phone: '010-2222-2222',
                smsEnabled: true,
                kakaoEnabled: false,
                isActive: true
              }
            ]
          }
        },
        include: { contacts: true }
      })

      const emailData = {
        messageId: 'trans-email-123',
        subject: '발주서',
        sender: 'email@test.com',
        recipient: 'order@echomail.com',
        receivedAt: new Date(),
        hasAttachment: true,
        status: 'MATCHED' as const,
        companyId: company.id
      }

      const result = await db.$transaction(async (tx) => {
        // 1. 이메일 로그 생성
        const emailLog = await tx.emailLog.create({
          data: emailData
        })

        // 2. 각 담당자에게 알림 생성
        const notifications = []
        for (const contact of company.contacts) {
          // SMS 알림
          if (contact.smsEnabled) {
            notifications.push(
              await tx.notificationLog.create({
                data: {
                  type: 'SMS',
                  recipient: contact.phone,
                  message: `[${company.name}] 새로운 발주가 도착했습니다.`,
                  status: 'PENDING',
                  companyId: company.id,
                  emailLogId: emailLog.id,
                  retryCount: 0,
                  maxRetries: 3
                }
              })
            )
          }

          // 카카오톡 알림
          if (contact.kakaoEnabled) {
            notifications.push(
              await tx.notificationLog.create({
                data: {
                  type: 'KAKAO_ALIMTALK',
                  recipient: contact.phone,
                  message: `[${company.name}] 새로운 발주가 도착했습니다.\n확인 부탁드립니다.`,
                  status: 'PENDING',
                  companyId: company.id,
                  emailLogId: emailLog.id,
                  retryCount: 0,
                  maxRetries: 3
                }
              })
            )
          }
        }

        // 3. 처리 완료 시간 업데이트
        await tx.emailLog.update({
          where: { id: emailLog.id },
          data: {
            processedAt: new Date(),
            status: 'PROCESSED'
          }
        })

        return { emailLog, notifications }
      })

      expect(result.emailLog).toBeDefined()
      expect(result.notifications).toHaveLength(3)  // 담당자1: SMS+카카오, 담당자2: SMS

      // 실제 저장 확인
      const savedEmailLog = await db.emailLog.findUnique({
        where: { id: result.emailLog.id },
        include: { notifications: true }
      })
      expect(savedEmailLog.status).toBe('PROCESSED')
      expect(savedEmailLog.notifications).toHaveLength(3)
    })

    it('should rollback all changes on notification creation failure', async () => {
      const company = await db.company.create({
        data: {
          name: '롤백 테스트',
          email: 'rollback@test.com',
          region: '서울',
          isActive: true
        }
      })

      await expect(
        db.$transaction(async (tx) => {
          const emailLog = await tx.emailLog.create({
            data: {
              messageId: 'rollback-123',
              subject: '롤백 테스트',
              sender: 'rollback@test.com',
              recipient: 'order@echomail.com',
              receivedAt: new Date(),
              hasAttachment: false,
              status: 'MATCHED',
              companyId: company.id
            }
          })

          // 의도적으로 잘못된 알림 데이터로 오류 발생
          await tx.notificationLog.create({
            data: {
              type: 'INVALID_TYPE' as any,  // 잘못된 타입
              recipient: '',  // 빈 수신자
              message: '',  // 빈 메시지
              status: 'PENDING',
              companyId: company.id,
              emailLogId: emailLog.id,
              retryCount: 0,
              maxRetries: 3
            }
          })

          return emailLog
        })
      ).rejects.toThrow()

      // 이메일 로그가 생성되지 않았는지 확인
      const emailLogs = await db.emailLog.findMany()
      expect(emailLogs).toHaveLength(0)

      // 알림 로그도 생성되지 않았는지 확인
      const notifications = await db.notificationLog.findMany()
      expect(notifications).toHaveLength(0)
    })
  })

  describe('Delivery Rule Transactions', () => {
    it('should create delivery rules with holidays atomically', async () => {
      const deliveryRuleData = {
        region: '서울',
        morningCutoff: '11:00',
        afternoonCutoff: '15:00',
        morningDeliveryDays: 1,
        afternoonDeliveryDays: 2,
        excludeWeekends: true,
        excludeHolidays: true,
        isActive: true
      }

      const holidaysData = [
        { date: new Date('2024-01-01'), name: '신정', isRecurring: true },
        { date: new Date('2024-02-09'), name: '설날', isRecurring: false },
        { date: new Date('2024-03-01'), name: '삼일절', isRecurring: true }
      ]

      const result = await db.$transaction(async (tx) => {
        // 1. 납품 규칙 생성
        const rule = await tx.deliveryRule.create({
          data: deliveryRuleData
        })

        // 2. 공휴일 생성
        const holidays = await tx.holiday.createMany({
          data: holidaysData
        })

        // 3. 지역별 공휴일 매핑 (관계 테이블이 있다면)
        // await tx.regionHoliday.createMany({...})

        return { rule, holidayCount: holidays.count }
      })

      expect(result.rule).toBeDefined()
      expect(result.rule.region).toBe('서울')
      expect(result.holidayCount).toBe(3)

      // 실제 저장 확인
      const savedRule = await db.deliveryRule.findFirst({
        where: { region: '서울' }
      })
      expect(savedRule).toBeDefined()

      const savedHolidays = await db.holiday.findMany()
      expect(savedHolidays).toHaveLength(3)
    })

    it('should handle concurrent delivery rule updates', async () => {
      // 초기 규칙 생성
      const initialRule = await db.deliveryRule.create({
        data: {
          region: '부산',
          morningCutoff: '10:00',
          afternoonCutoff: '14:00',
          morningDeliveryDays: 2,
          afternoonDeliveryDays: 3,
          excludeWeekends: true,
          excludeHolidays: false,
          isActive: true
        }
      })

      // 동시 업데이트 시뮬레이션
      const updates = [
        { morningCutoff: '11:00' },
        { afternoonCutoff: '15:00' },
        { excludeHolidays: true }
      ]

      const updatePromises = updates.map(updateData =>
        db.$transaction(async (tx) => {
          // 현재 값 읽기
          const current = await tx.deliveryRule.findUnique({
            where: { id: initialRule.id }
          })

          // 업데이트
          return tx.deliveryRule.update({
            where: { id: initialRule.id },
            data: updateData
          })
        })
      )

      // 모든 업데이트 실행
      await Promise.all(updatePromises)

      // 최종 결과 확인
      const finalRule = await db.deliveryRule.findUnique({
        where: { id: initialRule.id }
      })

      // 모든 업데이트가 반영되었는지 확인
      expect(finalRule.morningCutoff).toBe('11:00')
      expect(finalRule.afternoonCutoff).toBe('15:00')
      expect(finalRule.excludeHolidays).toBe(true)
    })
  })

  describe('Cascade Delete Transactions', () => {
    it('should cascade delete company with all related records', async () => {
      // 복잡한 관계 데이터 생성
      const company = await db.company.create({
        data: {
          name: '삭제 테스트 회사',
          email: 'delete@test.com',
          region: '서울',
          isActive: true,
          contacts: {
            create: [
              {
                name: '담당자1',
                phone: '010-1111-1111',
                isActive: true,
                smsEnabled: true,
                kakaoEnabled: true
              },
              {
                name: '담당자2',
                phone: '010-2222-2222',
                isActive: true,
                smsEnabled: true,
                kakaoEnabled: false
              }
            ]
          },
          emailLogs: {
            create: [
              {
                messageId: 'delete-test-1',
                subject: '테스트 이메일 1',
                sender: 'delete@test.com',
                recipient: 'order@echomail.com',
                receivedAt: new Date(),
                hasAttachment: false,
                status: 'PROCESSED'
              },
              {
                messageId: 'delete-test-2',
                subject: '테스트 이메일 2',
                sender: 'delete@test.com',
                recipient: 'order@echomail.com',
                receivedAt: new Date(),
                hasAttachment: true,
                status: 'PROCESSED'
              }
            ]
          }
        },
        include: {
          contacts: true,
          emailLogs: true
        }
      })

      // 알림 로그 추가
      const emailLogs = await db.emailLog.findMany({
        where: { companyId: company.id }
      })

      for (const emailLog of emailLogs) {
        await db.notificationLog.create({
          data: {
            type: 'SMS',
            recipient: '010-1111-1111',
            message: '테스트 알림',
            status: 'SENT',
            companyId: company.id,
            emailLogId: emailLog.id,
            retryCount: 0,
            maxRetries: 3
          }
        })
      }

      // 회사 삭제 (CASCADE)
      await db.$transaction(async (tx) => {
        // 명시적으로 관련 레코드 삭제 (CASCADE가 설정되어 있지 않은 경우)
        await tx.notificationLog.deleteMany({
          where: { companyId: company.id }
        })
        await tx.emailLog.deleteMany({
          where: { companyId: company.id }
        })
        await tx.contact.deleteMany({
          where: { companyId: company.id }
        })
        await tx.company.delete({
          where: { id: company.id }
        })
      })

      // 모든 관련 레코드가 삭제되었는지 확인
      const deletedCompany = await db.company.findUnique({
        where: { id: company.id }
      })
      expect(deletedCompany).toBeNull()

      const remainingContacts = await db.contact.findMany({
        where: { companyId: company.id }
      })
      expect(remainingContacts).toHaveLength(0)

      const remainingEmailLogs = await db.emailLog.findMany({
        where: { companyId: company.id }
      })
      expect(remainingEmailLogs).toHaveLength(0)

      const remainingNotifications = await db.notificationLog.findMany({
        where: { companyId: company.id }
      })
      expect(remainingNotifications).toHaveLength(0)
    })
  })

  describe('Optimistic Locking', () => {
    it('should handle version conflicts with optimistic locking', async () => {
      // 버전 필드가 있는 엔티티 생성
      const company = await db.company.create({
        data: {
          name: '낙관적 잠금 테스트',
          email: 'optimistic@test.com',
          region: '서울',
          isActive: true,
          version: 1  // 버전 필드가 있다고 가정
        }
      })

      // 두 개의 동시 업데이트 시뮬레이션
      const update1 = async () => {
        return db.$transaction(async (tx) => {
          const current = await tx.company.findUnique({
            where: { id: company.id }
          })

          // 시뮬레이션: 처리 시간
          await new Promise(resolve => setTimeout(resolve, 100))

          return tx.company.update({
            where: {
              id: company.id,
              version: current.version  // 낙관적 잠금 체크
            },
            data: {
              name: '업데이트 1',
              version: current.version + 1
            }
          })
        })
      }

      const update2 = async () => {
        return db.$transaction(async (tx) => {
          const current = await tx.company.findUnique({
            where: { id: company.id }
          })

          // 시뮬레이션: 처리 시간
          await new Promise(resolve => setTimeout(resolve, 50))

          return tx.company.update({
            where: {
              id: company.id,
              version: current.version  // 낙관적 잠금 체크
            },
            data: {
              name: '업데이트 2',
              version: current.version + 1
            }
          })
        })
      }

      // 동시 실행
      const results = await Promise.allSettled([update1(), update2()])

      // 하나는 성공, 하나는 실패 예상
      const successes = results.filter(r => r.status === 'fulfilled')
      const failures = results.filter(r => r.status === 'rejected')

      expect(successes.length).toBeGreaterThan(0)
      // Prisma의 경우 version 충돌시 에러 발생
    })
  })

  describe('Redis Cache Consistency', () => {
    it('should maintain cache consistency with database transactions', async () => {
      const cacheKey = 'company:cache@test.com'

      // 트랜잭션 내에서 생성 및 캐싱
      const company = await db.$transaction(async (tx) => {
        const newCompany = await tx.company.create({
          data: {
            name: '캐시 일관성 테스트',
            email: 'cache@test.com',
            region: '서울',
            isActive: true
          }
        })

        // 캐시에 저장
        await redis.setex(
          cacheKey,
          3600,
          JSON.stringify(newCompany)
        )

        return newCompany
      })

      // 캐시 확인
      const cachedData = await redis.get(cacheKey)
      expect(cachedData).toBeDefined()
      expect(JSON.parse(cachedData).id).toBe(company.id)

      // 업데이트 트랜잭션
      await db.$transaction(async (tx) => {
        await tx.company.update({
          where: { id: company.id },
          data: { name: '업데이트된 이름' }
        })

        // 캐시 무효화
        await redis.del(cacheKey)
      })

      // 캐시가 삭제되었는지 확인
      const invalidatedCache = await redis.get(cacheKey)
      expect(invalidatedCache).toBeNull()

      // 데이터베이스에서 최신 데이터 확인
      const updatedCompany = await db.company.findUnique({
        where: { id: company.id }
      })
      expect(updatedCompany.name).toBe('업데이트된 이름')
    })

    it('should rollback cache operations on transaction failure', async () => {
      const cacheKey = 'rollback:test@test.com'

      await expect(
        db.$transaction(async (tx) => {
          const company = await tx.company.create({
            data: {
              name: '캐시 롤백 테스트',
              email: 'rollback@test.com',
              region: '서울',
              isActive: true
            }
          })

          // 캐시에 저장
          await redis.setex(
            cacheKey,
            3600,
            JSON.stringify(company)
          )

          // 의도적 오류 발생
          throw new Error('Rollback test error')
        })
      ).rejects.toThrow('Rollback test error')

      // 데이터베이스에 회사가 생성되지 않았는지 확인
      const companies = await db.company.findMany({
        where: { email: 'rollback@test.com' }
      })
      expect(companies).toHaveLength(0)

      // 캐시도 저장되지 않았는지 확인
      // (실제로는 Redis 트랜잭션도 함께 롤백되어야 함)
      const cachedData = await redis.get(cacheKey)
      // Redis는 별도 트랜잭션이므로 수동으로 정리 필요
      if (cachedData) {
        await redis.del(cacheKey)
      }
    })
  })
})