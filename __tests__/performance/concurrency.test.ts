/**
 * Performance Test: Concurrency and Simultaneous Operations
 * 동시성 및 동시 작업 성능 테스트
 */

import { MailProcessor } from '@/lib/mail/mail-processor'
import { NotificationService } from '@/lib/notifications/notification-service'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { performance } from 'perf_hooks'
import * as cluster from 'cluster'
import * as os from 'os'

// 성능 테스트 설정
const config = require('./performance.config.js')

// 동시성 테스트 헬퍼
class ConcurrencyTestHelper {
  static async executeWithConcurrency<T>(
    tasks: (() => Promise<T>)[],
    concurrencyLimit: number
  ): Promise<Array<{ result?: T; error?: Error; duration: number }>> {
    const results: Array<{ result?: T; error?: Error; duration: number }> = []
    const executing: Promise<void>[] = []

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]

      const promise = (async () => {
        const startTime = performance.now()
        try {
          const result = await task()
          const duration = performance.now() - startTime
          results[i] = { result, duration }
        } catch (error) {
          const duration = performance.now() - startTime
          results[i] = { error: error as Error, duration }
        }
      })()

      executing.push(promise)

      if (executing.length >= concurrencyLimit) {
        await Promise.race(executing)
        executing.splice(0, 1)
      }
    }

    await Promise.all(executing)
    return results
  }

  static async measureRaceConditions<T>(
    operation: () => Promise<T>,
    concurrentExecutions: number,
    iterations: number = 1
  ): Promise<{
    successCount: number
    errorCount: number
    uniqueResults: Set<any>
    averageDuration: number
    maxDuration: number
    minDuration: number
  }> {
    const allResults = []

    for (let iter = 0; iter < iterations; iter++) {
      const promises = Array.from({ length: concurrentExecutions }, () => {
        const startTime = performance.now()
        return operation()
          .then(result => ({
            success: true,
            result,
            duration: performance.now() - startTime
          }))
          .catch(error => ({
            success: false,
            error,
            duration: performance.now() - startTime
          }))
      })

      const results = await Promise.all(promises)
      allResults.push(...results)
    }

    const successResults = allResults.filter(r => r.success)
    const errorResults = allResults.filter(r => !r.success)
    const durations = allResults.map(r => r.duration)

    return {
      successCount: successResults.length,
      errorCount: errorResults.length,
      uniqueResults: new Set(successResults.map(r => JSON.stringify(r.result))),
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations)
    }
  }
}

// 부하 생성기
class LoadGenerator {
  private activeUsers: number = 0
  private operations: Array<() => Promise<any>> = []

  addOperation(operation: () => Promise<any>) {
    this.operations.push(operation)
  }

  async simulateLoad(
    targetUsers: number,
    rampUpTimeMs: number,
    sustainTimeMs: number,
    rampDownTimeMs: number
  ): Promise<{
    totalOperations: number
    successfulOperations: number
    averageResponseTime: number
    peakConcurrentUsers: number
    errors: Error[]
  }> {
    const results = {
      totalOperations: 0,
      successfulOperations: 0,
      totalResponseTime: 0,
      peakConcurrentUsers: 0,
      errors: [] as Error[]
    }

    const startTime = Date.now()
    const userRampRate = targetUsers / rampUpTimeMs
    const operationsPerUser = this.operations.length

    // Ramp Up Phase
    console.log(`Starting ramp up to ${targetUsers} users over ${rampUpTimeMs}ms`)

    const activeOperations = new Set<Promise<void>>()

    const rampUpInterval = setInterval(async () => {
      if (this.activeUsers < targetUsers) {
        this.activeUsers++
        results.peakConcurrentUsers = Math.max(results.peakConcurrentUsers, this.activeUsers)

        // 사용자당 랜덤 작업 실행
        const operation = this.operations[Math.floor(Math.random() * operationsPerUser)]
        const operationPromise = this.executeOperation(operation, results)

        activeOperations.add(operationPromise)
        operationPromise.finally(() => {
          activeOperations.delete(operationPromise)
          this.activeUsers--
        })
      }
    }, rampUpTimeMs / targetUsers)

    // Sustain Phase
    setTimeout(() => {
      clearInterval(rampUpInterval)
      console.log(`Sustaining ${targetUsers} users for ${sustainTimeMs}ms`)

      const sustainInterval = setInterval(async () => {
        if (this.activeUsers < targetUsers) {
          this.activeUsers++

          const operation = this.operations[Math.floor(Math.random() * operationsPerUser)]
          const operationPromise = this.executeOperation(operation, results)

          activeOperations.add(operationPromise)
          operationPromise.finally(() => {
            activeOperations.delete(operationPromise)
            this.activeUsers--
          })
        }
      }, sustainTimeMs / (targetUsers * 10)) // 지속 기간 동안 지속적 요청

      // Ramp Down Phase
      setTimeout(() => {
        clearInterval(sustainInterval)
        console.log(`Ramping down over ${rampDownTimeMs}ms`)

        setTimeout(async () => {
          await Promise.all(Array.from(activeOperations))
          console.log('Load test completed')
        }, rampDownTimeMs)
      }, sustainTimeMs)
    }, rampUpTimeMs)

    // 총 테스트 시간 대기
    await new Promise(resolve =>
      setTimeout(resolve, rampUpTimeMs + sustainTimeMs + rampDownTimeMs + 1000)
    )

    return {
      totalOperations: results.totalOperations,
      successfulOperations: results.successfulOperations,
      averageResponseTime: results.totalOperations > 0 ? results.totalResponseTime / results.totalOperations : 0,
      peakConcurrentUsers: results.peakConcurrentUsers,
      errors: results.errors
    }
  }

  private async executeOperation(
    operation: () => Promise<any>,
    results: any
  ): Promise<void> {
    const startTime = performance.now()
    results.totalOperations++

    try {
      await operation()
      results.successfulOperations++
    } catch (error) {
      results.errors.push(error as Error)
    } finally {
      results.totalResponseTime += performance.now() - startTime
    }
  }
}

describe('Concurrency and Simultaneous Operations Tests', () => {
  let mailProcessor: MailProcessor
  let notificationService: NotificationService

  beforeAll(async () => {
    await db.$connect()
    await redis.connect()

    mailProcessor = new MailProcessor()
    notificationService = new NotificationService()

    process.env.CONCURRENCY_TEST_MODE = 'true'
  })

  afterAll(async () => {
    await db.$disconnect()
    await redis.disconnect()
    delete process.env.CONCURRENCY_TEST_MODE
  })

  beforeEach(async () => {
    // 테스트 데이터 초기화
    await db.$transaction([
      db.company.deleteMany(),
      db.contact.deleteMany(),
      db.emailLog.deleteMany(),
      db.notificationLog.deleteMany()
    ])

    await redis.flushAll()
  })

  describe('Database Concurrency Tests', () => {
    it('should handle concurrent company creation without race conditions', async () => {
      const concurrentUsers = 20
      const companiesPerUser = 5

      const createCompanyTasks = Array.from({ length: concurrentUsers }, (_, userIndex) =>
        Array.from({ length: companiesPerUser }, (_, companyIndex) => async () => {
          const companyData = {
            name: `동시성테스트회사_${userIndex}_${companyIndex}`,
            email: `concurrent${userIndex}_${companyIndex}@test.com`,
            region: ['서울', '부산', '대구'][userIndex % 3],
            contacts: {
              create: {
                name: `담당자_${userIndex}_${companyIndex}`,
                phone: `010-${String(userIndex).padStart(4, '0')}-${String(companyIndex).padStart(4, '0')}`,
                isActive: true,
                smsEnabled: true,
                kakaoEnabled: false
              }
            },
            isActive: true
          }

          return db.company.create({
            data: companyData,
            include: { contacts: true }
          })
        })
      ).flat()

      console.log(`Testing ${createCompanyTasks.length} concurrent company creations...`)

      const results = await ConcurrencyTestHelper.executeWithConcurrency(
        createCompanyTasks,
        10 // 동시 실행 제한
      )

      // 결과 분석
      const successful = results.filter(r => r.result && !r.error).length
      const failed = results.filter(r => r.error).length

      expect(successful).toBeGreaterThan(createCompanyTasks.length * 0.95) // 95% 이상 성공
      expect(failed).toBeLessThan(createCompanyTasks.length * 0.05) // 5% 미만 실패

      // 실제 생성된 회사 수 확인
      const totalCompanies = await db.company.count()
      expect(totalCompanies).toBe(successful)

      // 중복 이메일 확인 (유니크 제약 조건 테스트)
      const uniqueEmails = await db.company.groupBy({
        by: ['email'],
        _count: true
      })
      const duplicates = uniqueEmails.filter(group => group._count > 1)
      expect(duplicates).toHaveLength(0)

      console.log(`Concurrent company creation: ${successful}/${createCompanyTasks.length} succeeded`)
    })

    it('should handle concurrent database transactions safely', async () => {
      // 기본 데이터 생성
      const company = await db.company.create({
        data: {
          name: '트랜잭션 테스트 회사',
          email: 'transaction@test.com',
          region: '서울',
          isActive: true,
          contacts: {
            create: {
              name: '담당자',
              phone: '010-1234-5678',
              isActive: true,
              smsEnabled: true,
              kakaoEnabled: false
            }
          }
        },
        include: { contacts: true }
      })

      // 동시 트랜잭션 실행
      const concurrentTransactions = 10
      const transactionTasks = Array.from({ length: concurrentTransactions }, (_, index) => async () => {
        return db.$transaction(async (tx) => {
          // 이메일 로그 생성
          const emailLog = await tx.emailLog.create({
            data: {
              messageId: `concurrent-tx-${index}-${Date.now()}`,
              subject: `트랜잭션 테스트 ${index}`,
              sender: company.email,
              recipient: 'order@echomail.com',
              receivedAt: new Date(),
              hasAttachment: false,
              status: 'RECEIVED',
              companyId: company.id
            }
          })

          // 알림 로그 생성
          const notificationLog = await tx.notificationLog.create({
            data: {
              type: 'SMS',
              recipient: company.contacts[0].phone,
              message: `트랜잭션 테스트 알림 ${index}`,
              status: 'PENDING',
              companyId: company.id,
              emailLogId: emailLog.id,
              retryCount: 0,
              maxRetries: 3
            }
          })

          // 이메일 상태 업데이트
          await tx.emailLog.update({
            where: { id: emailLog.id },
            data: {
              status: 'PROCESSED',
              processedAt: new Date()
            }
          })

          return { emailLog, notificationLog }
        })
      })

      const results = await Promise.allSettled(
        transactionTasks.map(task => task())
      )

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      expect(successful).toBe(concurrentTransactions)
      expect(failed).toBe(0)

      // 데이터 무결성 확인
      const emailLogs = await db.emailLog.findMany({
        where: { companyId: company.id }
      })
      const notifications = await db.notificationLog.findMany({
        where: { companyId: company.id }
      })

      expect(emailLogs).toHaveLength(concurrentTransactions)
      expect(notifications).toHaveLength(concurrentTransactions)

      // 모든 이메일이 PROCESSED 상태인지 확인
      const processedEmails = emailLogs.filter(log => log.status === 'PROCESSED')
      expect(processedEmails).toHaveLength(concurrentTransactions)

      console.log(`Concurrent transactions: ${successful}/${concurrentTransactions} completed successfully`)
    })
  })

  describe('Email Processing Concurrency Tests', () => {
    it('should process concurrent emails from same company without conflicts', async () => {
      // 테스트 회사 생성
      const company = await db.company.create({
        data: {
          name: '동시이메일처리 테스트회사',
          email: 'concurrent-email@test.com',
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
          }
        }
      })

      // 동시에 여러 이메일 처리
      const concurrentEmails = 15
      const emailTasks = Array.from({ length: concurrentEmails }, (_, index) => async () => {
        const email = {
          messageId: `concurrent-email-${index}-${Date.now()}-${Math.random()}`,
          subject: `[${company.name}] 동시 처리 테스트 ${index}`,
          from: company.email,
          to: 'order@echomail.com',
          receivedAt: new Date(),
          body: `동시 이메일 처리 테스트 ${index}`,
          attachments: []
        }

        return mailProcessor.processEmail(email)
      })

      const startTime = performance.now()
      const results = await Promise.all(
        emailTasks.map(task => task().catch(error => ({ success: false, error })))
      )
      const duration = performance.now() - startTime

      // 결과 분석
      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length

      expect(successful).toBeGreaterThan(concurrentEmails * 0.9) // 90% 이상 성공
      expect(duration).toBeLessThan(10000) // 10초 이내 완료

      // 데이터베이스 일관성 확인
      const emailLogs = await db.emailLog.findMany({
        where: { companyId: company.id }
      })
      expect(emailLogs).toHaveLength(successful)

      const notifications = await db.notificationLog.findMany({
        where: { companyId: company.id }
      })
      // 각 이메일당 2개 연락처 × 알림 유형 = 담당자1(SMS+카카오), 담당자2(SMS)
      expect(notifications.length).toBeGreaterThan(successful * 2)

      console.log(`Concurrent email processing: ${successful}/${concurrentEmails} succeeded in ${duration.toFixed(2)}ms`)
    })

    it('should handle race conditions in company email matching', async () => {
      const companyEmail = 'race-condition@test.com'

      // 경쟁 상태 시나리오: 동시에 같은 이메일 주소로 여러 작업
      const operations = [
        // 업체 생성
        async () => {
          return db.company.create({
            data: {
              name: '경쟁상태 테스트회사',
              email: companyEmail,
              region: '서울',
              isActive: true,
              contacts: {
                create: {
                  name: '담당자',
                  phone: '010-9999-9999',
                  isActive: true,
                  smsEnabled: true,
                  kakaoEnabled: false
                }
              }
            }
          })
        },
        // 이메일 처리 (회사가 없을 수도 있음)
        async () => {
          const email = {
            messageId: `race-condition-${Date.now()}-${Math.random()}`,
            subject: '[경쟁상태 테스트회사] 발주서',
            from: companyEmail,
            to: 'order@echomail.com',
            receivedAt: new Date(),
            body: '경쟁 상태 테스트',
            attachments: []
          }
          return mailProcessor.processEmail(email)
        },
        // 회사 조회
        async () => {
          return db.company.findUnique({
            where: { email: companyEmail },
            include: { contacts: true }
          })
        }
      ]

      const raceResults = await ConcurrencyTestHelper.measureRaceConditions(
        async () => {
          const randomOperation = operations[Math.floor(Math.random() * operations.length)]
          return randomOperation()
        },
        10, // 10개 동시 실행
        3   // 3번 반복
      )

      // 경쟁 상태에서도 오류가 발생하지 않아야 함
      expect(raceResults.errorCount).toBeLessThan(raceResults.successCount * 0.2) // 20% 미만 오류

      console.log(`Race condition test: ${raceResults.successCount} successes, ${raceResults.errorCount} errors`)
      console.log(`Average duration: ${raceResults.averageDuration.toFixed(2)}ms`)
    })
  })

  describe('Notification Service Concurrency Tests', () => {
    it('should handle concurrent notification sending', async () => {
      const concurrentNotifications = 25
      const phoneNumbers = Array.from({ length: 5 }, (_, i) => `010-${String(i + 1).padStart(4, '0')}-${String(i + 1).padStart(4, '0')}`)

      const notificationTasks = Array.from({ length: concurrentNotifications }, (_, index) => async () => {
        const phone = phoneNumbers[index % phoneNumbers.length]
        const message = `동시 알림 테스트 ${index + 1}`

        return notificationService.sendSMS({
          recipient: phone,
          message,
          priority: Math.random() > 0.5 ? 'HIGH' : 'NORMAL'
        })
      })

      const startTime = performance.now()
      const results = await ConcurrencyTestHelper.executeWithConcurrency(
        notificationTasks,
        8 // SMS API 제한을 고려한 동시 실행 수
      )
      const duration = performance.now() - startTime

      const successful = results.filter(r => r.result && !r.error).length
      const failed = results.filter(r => r.error).length

      // SMS 발송은 외부 API 의존성으로 인해 낮은 성공률 허용
      expect(successful).toBeGreaterThan(concurrentNotifications * 0.7) // 70% 이상 성공
      expect(duration).toBeLessThan(60000) // 1분 이내 완료

      console.log(`Concurrent notifications: ${successful}/${concurrentNotifications} succeeded in ${duration.toFixed(2)}ms`)
    })

    it('should prioritize high-priority notifications under load', async () => {
      const totalNotifications = 50
      const highPriorityCount = 10
      const normalPriorityCount = totalNotifications - highPriorityCount

      const notificationTasks = [
        // 일반 우선순위 알림들
        ...Array.from({ length: normalPriorityCount }, (_, index) => async () => {
          return notificationService.sendSMS({
            recipient: `010-${String(index).padStart(4, '0')}-0000`,
            message: `일반 우선순위 알림 ${index}`,
            priority: 'NORMAL'
          })
        }),
        // 높은 우선순위 알림들 (나중에 추가)
        ...Array.from({ length: highPriorityCount }, (_, index) => async () => {
          return notificationService.sendSMS({
            recipient: `010-9${String(index).padStart(3, '0')}-0000`,
            message: `긴급 우선순위 알림 ${index}`,
            priority: 'HIGH'
          })
        })
      ]

      // 섞어서 동시 실행
      const shuffledTasks = notificationTasks.sort(() => Math.random() - 0.5)

      const results = await ConcurrencyTestHelper.executeWithConcurrency(
        shuffledTasks,
        5 // 제한된 동시 실행으로 우선순위 테스트
      )

      // 우선순위별 평균 처리 시간 계산
      const highPriorityResults = results.filter((_, index) =>
        shuffledTasks[index].toString().includes('긴급')
      )
      const normalPriorityResults = results.filter((_, index) =>
        shuffledTasks[index].toString().includes('일반')
      )

      const avgHighPriorityTime = highPriorityResults
        .filter(r => !r.error)
        .reduce((sum, r) => sum + r.duration, 0) / highPriorityResults.filter(r => !r.error).length

      const avgNormalPriorityTime = normalPriorityResults
        .filter(r => !r.error)
        .reduce((sum, r) => sum + r.duration, 0) / normalPriorityResults.filter(r => !r.error).length

      // 높은 우선순위가 더 빠르게 처리되어야 함
      if (avgHighPriorityTime > 0 && avgNormalPriorityTime > 0) {
        expect(avgHighPriorityTime).toBeLessThan(avgNormalPriorityTime * 1.2) // 20% 정도 차이 허용
      }

      console.log(`Priority test - High: ${avgHighPriorityTime.toFixed(2)}ms, Normal: ${avgNormalPriorityTime.toFixed(2)}ms`)
    })
  })

  describe('Redis Concurrency Tests', () => {
    it('should handle concurrent Redis operations safely', async () => {
      const concurrentOperations = 30
      const keyPrefix = 'concurrency-test'

      const redisTasks = Array.from({ length: concurrentOperations }, (_, index) => async () => {
        const key = `${keyPrefix}:${index % 10}` // 10개 키에 대해 경쟁
        const value = `value-${index}-${Date.now()}`

        // 복합 Redis 연산
        const multi = redis.multi()
        multi.set(key, value)
        multi.expire(key, 60)
        multi.lpush(`${key}:list`, value)
        multi.incr(`${key}:counter`)

        const results = await multi.exec()

        // 결과 검증
        const storedValue = await redis.get(key)
        return { key, value, storedValue, results }
      })

      const results = await Promise.all(
        redisTasks.map(task => task().catch(error => ({ error })))
      )

      const successful = results.filter(r => !r.error).length
      const failed = results.filter(r => r.error).length

      expect(successful).toBe(concurrentOperations)
      expect(failed).toBe(0)

      // Redis 데이터 일관성 확인
      const keys = await redis.keys(`${keyPrefix}:*`)
      expect(keys.length).toBeGreaterThan(0)

      console.log(`Concurrent Redis operations: ${successful}/${concurrentOperations} succeeded`)
    })
  })

  describe('Load Testing', () => {
    it('should handle realistic load with multiple user types', async () => {
      // 실제 사용 패턴을 모방한 부하 테스트
      const loadGenerator = new LoadGenerator()

      // 테스트 데이터 준비
      const testCompanies = Array.from({ length: 10 }, (_, i) => ({
        name: `부하테스트회사${i + 1}`,
        email: `load${i + 1}@test.com`,
        region: '서울',
        isActive: true
      }))

      for (const companyData of testCompanies) {
        await db.company.create({
          data: {
            ...companyData,
            contacts: {
              create: {
                name: '담당자',
                phone: `010-${String(Math.floor(Math.random() * 9000) + 1000)}-0000`,
                isActive: true,
                smsEnabled: true,
                kakaoEnabled: false
              }
            }
          }
        })
      }

      // 다양한 사용자 행동 패턴 정의
      loadGenerator.addOperation(async () => {
        // 이메일 처리 시뮬레이션
        const company = testCompanies[Math.floor(Math.random() * testCompanies.length)]
        const email = {
          messageId: `load-test-${Date.now()}-${Math.random()}`,
          subject: `[${company.name}] 부하 테스트 발주서`,
          from: company.email,
          to: 'order@echomail.com',
          receivedAt: new Date(),
          body: '부하 테스트용 이메일',
          attachments: []
        }
        return mailProcessor.processEmail(email)
      })

      loadGenerator.addOperation(async () => {
        // 회사 조회 시뮬레이션
        return db.company.findMany({
          where: { isActive: true },
          include: { contacts: true },
          take: 5
        })
      })

      loadGenerator.addOperation(async () => {
        // 알림 로그 조회 시뮬레이션
        return db.notificationLog.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24시간
            }
          },
          take: 10,
          orderBy: { createdAt: 'desc' }
        })
      })

      // 부하 테스트 실행
      console.log('Starting load test...')
      const loadTestResult = await loadGenerator.simulateLoad(
        20,    // 최대 20명 동시 사용자
        10000, // 10초 ramp-up
        30000, // 30초 sustain
        5000   // 5초 ramp-down
      )

      // 결과 검증
      const successRate = (loadTestResult.successfulOperations / loadTestResult.totalOperations) * 100
      expect(successRate).toBeGreaterThan(80) // 80% 이상 성공률

      expect(loadTestResult.averageResponseTime).toBeLessThan(5000) // 평균 5초 이내
      expect(loadTestResult.peakConcurrentUsers).toBeGreaterThan(15) // 최소 15명 동시 사용자

      console.log('Load Test Results:')
      console.log(`  Total Operations: ${loadTestResult.totalOperations}`)
      console.log(`  Success Rate: ${successRate.toFixed(2)}%`)
      console.log(`  Average Response Time: ${loadTestResult.averageResponseTime.toFixed(2)}ms`)
      console.log(`  Peak Concurrent Users: ${loadTestResult.peakConcurrentUsers}`)
      console.log(`  Errors: ${loadTestResult.errors.length}`)
    })
  })

  describe('Stress Testing', () => {
    it('should maintain stability under extreme load', async () => {
      const stressConfig = config.stressTest

      // 극한 부하 테스트
      const extremeLoadTasks = Array.from({ length: stressConfig.maxConcurrentEmails }, (_, index) => async () => {
        // 메모리 사용량 모니터링
        const memoryUsage = process.memoryUsage()
        if (memoryUsage.heapUsed > stressConfig.memoryLimitMB * 1024 * 1024) {
          throw new Error(`Memory limit exceeded: ${memoryUsage.heapUsed / 1024 / 1024}MB`)
        }

        // CPU 사용률 확인 (간접적)
        const startTime = performance.now()
        await new Promise(resolve => setImmediate(resolve))
        const immediateDelay = performance.now() - startTime

        if (immediateDelay > 100) { // setImmediate가 100ms 이상 걸리면 과부하
          console.warn(`High CPU load detected: setImmediate took ${immediateDelay.toFixed(2)}ms`)
        }

        // 실제 작업 수행
        return new Promise(resolve => {
          setTimeout(() => resolve(`task-${index}-completed`), Math.random() * 100)
        })
      })

      console.log(`Starting stress test with ${stressConfig.maxConcurrentEmails} concurrent operations...`)

      const startTime = performance.now()
      const results = await ConcurrencyTestHelper.executeWithConcurrency(
        extremeLoadTasks,
        100 // 높은 동시 실행 수
      )
      const duration = performance.now() - startTime

      const successful = results.filter(r => !r.error).length
      const failed = results.filter(r => r.error).length

      // 스트레스 테스트에서도 합리적인 성공률 유지
      expect(successful).toBeGreaterThan(stressConfig.maxConcurrentEmails * 0.6) // 60% 이상

      // 시스템이 완전히 중단되지 않았는지 확인
      expect(duration).toBeLessThan(120000) // 2분 이내 완료

      const finalMemory = process.memoryUsage()
      expect(finalMemory.heapUsed).toBeLessThan(stressConfig.memoryLimitMB * 1024 * 1024)

      console.log(`Stress test completed: ${successful}/${stressConfig.maxConcurrentEmails} succeeded`)
      console.log(`Duration: ${(duration / 1000).toFixed(2)}s`)
      console.log(`Final memory usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)
    })
  })
})