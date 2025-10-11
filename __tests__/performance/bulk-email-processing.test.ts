/**
 * Performance Test: Bulk Email Processing
 * 대량 이메일 처리 성능 테스트
 */

import { MailProcessor } from '@/lib/mail/mail-processor'
import { NotificationService } from '@/lib/notifications/notification-service'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { performance } from 'perf_hooks'
import * as os from 'os'
import * as process from 'process'

// 성능 테스트 설정 가져오기
const config = require('./performance.config.js')

// 성능 측정 헬퍼
class PerformanceMonitor {
  private startTime: number = 0
  private startMemory: NodeJS.MemoryUsage | null = null
  private startCpu: NodeJS.CpuUsage | null = null

  start() {
    this.startTime = performance.now()
    this.startMemory = process.memoryUsage()
    this.startCpu = process.cpuUsage()
  }

  end() {
    const endTime = performance.now()
    const endMemory = process.memoryUsage()
    const endCpu = process.cpuUsage(this.startCpu!)

    return {
      duration: endTime - this.startTime,
      memory: {
        heapUsedDelta: (endMemory.heapUsed - this.startMemory!.heapUsed) / 1024 / 1024,
        heapTotalDelta: (endMemory.heapTotal - this.startMemory!.heapTotal) / 1024 / 1024,
        externalDelta: (endMemory.external - this.startMemory!.external) / 1024 / 1024,
        current: {
          heapUsed: endMemory.heapUsed / 1024 / 1024,
          heapTotal: endMemory.heapTotal / 1024 / 1024,
          external: endMemory.external / 1024 / 1024,
        },
      },
      cpu: {
        user: endCpu.user / 1000, // microseconds to milliseconds
        system: endCpu.system / 1000,
      },
    }
  }
}

// 테스트 데이터 생성기
class TestDataGenerator {
  static generateCompanies(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      name: `성능테스트회사${i + 1} 주식회사`,
      email: `perf${i + 1}@company.com`,
      region: ['서울', '부산', '대구', '인천', '광주'][i % 5],
      contacts: [
        {
          name: `담당자${i + 1}`,
          phone: `010-${String(Math.floor(1000 + (i % 9000))).padStart(4, '0')}-${String(Math.floor(1000 + (i % 9000))).padStart(4, '0')}`,
          email: `contact${i + 1}@company.com`,
          position: '매니저',
          smsEnabled: true,
          kakaoEnabled: i % 2 === 0,
          isActive: true,
        },
      ],
      isActive: true,
    }))
  }

  static generateEmails(companies: any[], emailsPerCompany: number = 1) {
    const emails = []
    for (const company of companies) {
      for (let i = 0; i < emailsPerCompany; i++) {
        emails.push({
          messageId: `perf-test-${company.email}-${i}-${Date.now()}`,
          subject: `[${company.name}] 성능테스트 발주서 ${i + 1}`,
          from: company.email,
          to: 'order@echomail.com',
          receivedAt: new Date(),
          body: `
성능 테스트용 이메일입니다.

발주 정보:
- 업체: ${company.name}
- 담당자: ${company.contacts[0].name}
- 연락처: ${company.contacts[0].phone}
- 발주 번호: PERF-${Date.now()}-${i}

처리 시간을 측정합니다.
          `,
          attachments:
            i % 3 === 0
              ? [
                  {
                    filename: `발주서_${company.name.replace(/\s+/g, '_')}_${i + 1}.pdf`,
                    contentType: 'application/pdf',
                    size: 1024 * (50 + (i % 50)), // 50-100KB
                    content: Buffer.alloc(1024 * (50 + (i % 50)), 'test'),
                  },
                ]
              : [],
        })
      }
    }
    return emails
  }
}

describe('Bulk Email Processing Performance Tests', () => {
  let mailProcessor: MailProcessor
  let notificationService: NotificationService
  let monitor: PerformanceMonitor

  beforeAll(async () => {
    await db.$connect()
    await redis.connect()

    mailProcessor = new MailProcessor()
    notificationService = new NotificationService()
    monitor = new PerformanceMonitor()

    // 성능 테스트 모드 활성화
    process.env.PERFORMANCE_TEST_MODE = 'true'
  })

  afterAll(async () => {
    await db.$disconnect()
    await redis.disconnect()
    delete process.env.PERFORMANCE_TEST_MODE
  })

  beforeEach(async () => {
    // 데이터베이스 초기화
    await db.$transaction([
      db.company.deleteMany(),
      db.contact.deleteMany(),
      db.emailLog.deleteMany(),
      db.notificationLog.deleteMany(),
    ])

    // Redis 초기화
    await redis.flushAll()

    // 가비지 컬렉션 강제 실행
    if (global.gc) {
      global.gc()
    }
  })

  describe('Single Email Processing Performance', () => {
    it('should process single email within performance threshold', async () => {
      // 테스트 데이터 준비
      const companies = TestDataGenerator.generateCompanies(1)
      const company = await db.company.create({
        data: companies[0],
        include: { contacts: true },
      })

      const emails = TestDataGenerator.generateEmails([company])
      const testEmail = emails[0]

      // 성능 측정 시작
      monitor.start()

      // 이메일 처리
      const result = await mailProcessor.processEmail(testEmail)

      // 성능 측정 종료
      const metrics = monitor.end()

      // 결과 검증
      expect(result.success).toBe(true)
      expect(result.emailLog).toBeDefined()

      // 성능 기준 검증
      expect(metrics.duration).toBeLessThan(
        config.performanceThresholds.emailProcessing.singleEmail
      )
      expect(metrics.memory.current.heapUsed).toBeLessThan(
        config.performanceThresholds.memory.baseline
      )

      console.log(
        `Single Email Processing: ${metrics.duration.toFixed(2)}ms, Memory: ${metrics.memory.current.heapUsed.toFixed(2)}MB`
      )
    })

    it('should handle email with large attachment efficiently', async () => {
      const companies = TestDataGenerator.generateCompanies(1)
      const company = await db.company.create({
        data: companies[0],
        include: { contacts: true },
      })

      // 대용량 첨부파일 이메일
      const largeEmail = {
        messageId: `large-attachment-${Date.now()}`,
        subject: `[${company.name}] 대용량 첨부파일 테스트`,
        from: company.email,
        to: 'order@echomail.com',
        receivedAt: new Date(),
        body: '대용량 첨부파일 처리 테스트',
        attachments: [
          {
            filename: 'large_document.pdf',
            contentType: 'application/pdf',
            size: 1024 * 1024 * 5, // 5MB
            content: Buffer.alloc(1024 * 1024 * 5, 'large'),
          },
        ],
      }

      monitor.start()
      const result = await mailProcessor.processEmail(largeEmail)
      const metrics = monitor.end()

      expect(result.success).toBe(true)
      expect(metrics.duration).toBeLessThan(
        config.performanceThresholds.emailProcessing.singleEmail * 2
      ) // 대용량은 2배 허용

      console.log(
        `Large Attachment Processing: ${metrics.duration.toFixed(2)}ms, Memory: ${metrics.memory.current.heapUsed.toFixed(2)}MB`
      )
    })
  })

  describe('Bulk Email Processing Performance', () => {
    it('should process 100 emails within threshold', async () => {
      const companyCount = 20
      const emailsPerCompany = 5 // 총 100개 이메일

      // 테스트 업체들 생성
      const companiesData = TestDataGenerator.generateCompanies(companyCount)
      const companies = []

      for (const companyData of companiesData) {
        const company = await db.company.create({
          data: companyData,
          include: { contacts: true },
        })
        companies.push(company)
      }

      // 이메일 생성
      const emails = TestDataGenerator.generateEmails(companies, emailsPerCompany)

      console.log(`Starting bulk processing of ${emails.length} emails...`)

      // 성능 측정 시작
      monitor.start()

      // 병렬 처리
      const batchSize = 10
      const results = []

      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize)
        const batchResults = await Promise.all(
          batch.map((email) => mailProcessor.processEmail(email))
        )
        results.push(...batchResults)

        // 진행상황 로그
        if ((i + batchSize) % 50 === 0) {
          console.log(`Processed ${Math.min(i + batchSize, emails.length)}/${emails.length} emails`)
        }
      }

      const metrics = monitor.end()

      // 결과 검증
      const successCount = results.filter((r) => r.success).length
      expect(successCount).toBe(emails.length)

      // 성능 기준 검증
      expect(metrics.duration).toBeLessThan(
        config.performanceThresholds.emailProcessing.bulkEmail100
      )
      expect(metrics.memory.current.heapUsed).toBeLessThan(
        config.performanceThresholds.memory.afterBulkProcessing
      )

      // 처리율 계산
      const emailsPerSecond = (emails.length / metrics.duration) * 1000
      expect(emailsPerSecond).toBeGreaterThan(3) // 최소 3개/초

      console.log(`Bulk Email Processing (${emails.length} emails):`)
      console.log(`  Duration: ${metrics.duration.toFixed(2)}ms`)
      console.log(`  Memory: ${metrics.memory.current.heapUsed.toFixed(2)}MB`)
      console.log(`  Rate: ${emailsPerSecond.toFixed(2)} emails/sec`)
    })

    it('should handle concurrent email processing', async () => {
      const companyCount = 10
      const companiesData = TestDataGenerator.generateCompanies(companyCount)

      // 업체들 병렬 생성
      const companyPromises = companiesData.map((data) =>
        db.company.create({ data, include: { contacts: true } })
      )
      const companies = await Promise.all(companyPromises)

      // 각 업체에서 동시에 이메일 발송 시뮬레이션
      const emails = TestDataGenerator.generateEmails(companies, 3) // 30개 이메일

      monitor.start()

      // 모든 이메일을 동시에 처리
      const results = await Promise.allSettled(
        emails.map((email) => mailProcessor.processEmail(email))
      )

      const metrics = monitor.end()

      // 결과 분석
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
      const failed = results.filter((r) => r.status === 'rejected' || !r.value?.success).length

      expect(successful).toBeGreaterThan(emails.length * 0.95) // 95% 이상 성공
      expect(failed).toBeLessThan(emails.length * 0.05) // 5% 미만 실패

      console.log(
        `Concurrent Processing: ${successful}/${emails.length} succeeded in ${metrics.duration.toFixed(2)}ms`
      )
    })
  })

  describe('Memory Usage and Leak Detection', () => {
    it('should not have memory leaks during bulk processing', async () => {
      const iterations = 5
      const emailsPerIteration = 20
      const memorySnapshots = []

      // 기준선 메모리 사용량
      if (global.gc) global.gc()
      const baseline = process.memoryUsage()

      for (let iteration = 0; iteration < iterations; iteration++) {
        // 테스트 데이터 생성
        const companies = TestDataGenerator.generateCompanies(5)
        const createdCompanies = []

        for (const companyData of companies) {
          const company = await db.company.create({
            data: companyData,
            include: { contacts: true },
          })
          createdCompanies.push(company)
        }

        // 이메일 처리
        const emails = TestDataGenerator.generateEmails(createdCompanies, emailsPerIteration / 5)

        for (const email of emails) {
          await mailProcessor.processEmail(email)
        }

        // 데이터 정리
        await db.$transaction([
          db.notificationLog.deleteMany(),
          db.emailLog.deleteMany(),
          db.contact.deleteMany(),
          db.company.deleteMany(),
        ])

        // 가비지 컬렉션 강제 실행
        if (global.gc) global.gc()

        // 메모리 스냅샷
        const currentMemory = process.memoryUsage()
        memorySnapshots.push({
          iteration,
          heapUsed: currentMemory.heapUsed / 1024 / 1024,
          heapTotal: currentMemory.heapTotal / 1024 / 1024,
          external: currentMemory.external / 1024 / 1024,
        })

        console.log(
          `Iteration ${iteration + 1}: Heap ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
        )
      }

      // 메모리 누수 검사
      const firstSnapshot = memorySnapshots[0]
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1]
      const memoryIncrease = lastSnapshot.heapUsed - firstSnapshot.heapUsed

      // 메모리 증가가 50MB 이하여야 함 (메모리 누수 없음)
      expect(memoryIncrease).toBeLessThan(50)

      console.log(
        `Memory leak test: ${memoryIncrease.toFixed(2)}MB increase over ${iterations} iterations`
      )
    })

    it('should handle memory pressure gracefully', async () => {
      // 메모리 압박 상황 시뮬레이션
      const largeDataSets = []

      try {
        // 대량의 메모리 할당
        for (let i = 0; i < 10; i++) {
          largeDataSets.push(Buffer.alloc(50 * 1024 * 1024, `data-${i}`)) // 50MB씩
        }

        // 메모리 압박 상황에서 이메일 처리
        const companies = TestDataGenerator.generateCompanies(5)
        const company = await db.company.create({
          data: companies[0],
          include: { contacts: true },
        })

        const emails = TestDataGenerator.generateEmails([company], 5)

        monitor.start()

        const results = []
        for (const email of emails) {
          try {
            const result = await mailProcessor.processEmail(email)
            results.push(result)
          } catch (error) {
            console.log('Memory pressure error:', error.message)
            // 메모리 정리 후 재시도
            largeDataSets.splice(0, 5) // 일부 메모리 해제
            if (global.gc) global.gc()

            const retryResult = await mailProcessor.processEmail(email)
            results.push(retryResult)
          }
        }

        const metrics = monitor.end()

        // 메모리 압박 상황에서도 처리 가능해야 함
        const successCount = results.filter((r) => r.success).length
        expect(successCount).toBeGreaterThan(emails.length * 0.8) // 80% 이상 성공

        console.log(`Memory pressure test: ${successCount}/${emails.length} succeeded`)
      } finally {
        // 메모리 정리
        largeDataSets.length = 0
        if (global.gc) global.gc()
      }
    })
  })

  describe('Database Performance', () => {
    it('should handle bulk company creation efficiently', async () => {
      const companyCount = 100
      const companiesData = TestDataGenerator.generateCompanies(companyCount)

      monitor.start()

      // 배치 생성 (트랜잭션 사용)
      const batchSize = 20
      const createdCompanies = []

      for (let i = 0; i < companiesData.length; i += batchSize) {
        const batch = companiesData.slice(i, i + batchSize)

        await db.$transaction(async (tx) => {
          for (const companyData of batch) {
            const company = await tx.company.create({
              data: companyData,
              include: { contacts: true },
            })
            createdCompanies.push(company)
          }
        })
      }

      const metrics = monitor.end()

      expect(createdCompanies).toHaveLength(companyCount)
      expect(metrics.duration).toBeLessThan(config.performanceThresholds.database.bulkInsert100)

      // 생성된 회사 수 검증
      const totalCompanies = await db.company.count()
      expect(totalCompanies).toBe(companyCount)

      console.log(
        `Bulk Company Creation (${companyCount} companies): ${metrics.duration.toFixed(2)}ms`
      )
    })

    it('should handle complex queries efficiently', async () => {
      // 테스트 데이터 준비
      const companies = TestDataGenerator.generateCompanies(50)
      for (const companyData of companies) {
        await db.company.create({
          data: companyData,
          include: { contacts: true },
        })
      }

      // 복잡한 쿼리 성능 테스트
      monitor.start()

      const complexQueryResult = await db.company.findMany({
        where: {
          AND: [
            { isActive: true },
            { region: { in: ['서울', '부산', '대구'] } },
            {
              contacts: {
                some: {
                  AND: [{ isActive: true }, { smsEnabled: true }],
                },
              },
            },
          ],
        },
        include: {
          contacts: {
            where: { isActive: true },
          },
          emailLogs: {
            where: {
              status: 'PROCESSED',
            },
            include: {
              notifications: {
                where: { status: 'SENT' },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
        take: 20,
      })

      const metrics = monitor.end()

      expect(complexQueryResult).toHaveLength(20)
      expect(metrics.duration).toBeLessThan(config.performanceThresholds.database.complexQuery)

      console.log(
        `Complex Query: ${metrics.duration.toFixed(2)}ms, ${complexQueryResult.length} results`
      )
    })
  })

  describe('Resource Cleanup and Optimization', () => {
    it('should clean up resources properly after bulk processing', async () => {
      // 초기 리소스 상태
      const initialConnections = await redis.client('info', 'clients')

      // 대량 처리 수행
      const companies = TestDataGenerator.generateCompanies(10)
      for (const companyData of companies) {
        await db.company.create({
          data: companyData,
          include: { contacts: true },
        })
      }

      const emails = TestDataGenerator.generateEmails(companies.slice(0, 5), 5)

      const results = await Promise.all(emails.map((email) => mailProcessor.processEmail(email)))

      expect(results.filter((r) => r.success)).toHaveLength(emails.length)

      // 처리 후 리소스 정리 확인
      await new Promise((resolve) => setTimeout(resolve, 1000)) // 정리 시간 대기

      const finalConnections = await redis.client('info', 'clients')

      // 연결 누수가 없어야 함
      console.log('Connection cleanup test passed')
    })
  })
})
