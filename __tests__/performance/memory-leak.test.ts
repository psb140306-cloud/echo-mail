/**
 * Performance Test: Memory Leak Detection
 * 메모리 누수 탐지 성능 테스트
 */

import { MailProcessor } from '@/lib/mail/mail-processor'
import { NotificationService } from '@/lib/notifications/notification-service'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { performance } from 'perf_hooks'
import * as v8 from 'v8'

// 메모리 프로파일링 헬퍼
class MemoryProfiler {
  private snapshots: Array<{
    timestamp: number
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
    rss: number
    iteration?: number
    operation?: string
  }> = []

  takeSnapshot(iteration?: number, operation?: string) {
    const memUsage = process.memoryUsage()
    const snapshot = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
      heapTotal: memUsage.heapTotal / 1024 / 1024,
      external: memUsage.external / 1024 / 1024,
      arrayBuffers: memUsage.arrayBuffers / 1024 / 1024,
      rss: memUsage.rss / 1024 / 1024,
      iteration,
      operation,
    }

    this.snapshots.push(snapshot)
    return snapshot
  }

  getMemoryTrend(): {
    slope: number
    correlation: number
    isIncreasing: boolean
    averageIncrease: number
  } {
    if (this.snapshots.length < 3) {
      return { slope: 0, correlation: 0, isIncreasing: false, averageIncrease: 0 }
    }

    // 선형 회귀를 사용하여 메모리 사용 추세 분석
    const n = this.snapshots.length
    const x = this.snapshots.map((_, i) => i)
    const y = this.snapshots.map((s) => s.heapUsed)

    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)

    // 상관계수 계산
    const meanX = sumX / n
    const meanY = sumY / n
    const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0)
    const denomX = Math.sqrt(x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0))
    const denomY = Math.sqrt(y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0))
    const correlation = numerator / (denomX * denomY)

    return {
      slope,
      correlation,
      isIncreasing: slope > 0.1, // 1회 반복당 0.1MB 이상 증가
      averageIncrease: slope,
    }
  }

  generateReport(): string {
    const trend = this.getMemoryTrend()
    const initial = this.snapshots[0]
    const final = this.snapshots[this.snapshots.length - 1]
    const totalIncrease = final.heapUsed - initial.heapUsed

    let report = '\n=== Memory Usage Report ===\n'
    report += `Initial Memory: ${initial.heapUsed.toFixed(2)} MB\n`
    report += `Final Memory: ${final.heapUsed.toFixed(2)} MB\n`
    report += `Total Increase: ${totalIncrease.toFixed(2)} MB\n`
    report += `Average per Iteration: ${trend.averageIncrease.toFixed(4)} MB\n`
    report += `Correlation: ${trend.correlation.toFixed(3)}\n`
    report += `Memory Leak Detected: ${trend.isIncreasing ? 'YES' : 'NO'}\n`

    if (this.snapshots.length > 5) {
      report += '\nMemory usage per iteration:\n'
      this.snapshots.forEach((snapshot, index) => {
        if (index % Math.ceil(this.snapshots.length / 10) === 0) {
          // 10개 정도만 표시
          report += `  Iteration ${snapshot.iteration || index}: ${snapshot.heapUsed.toFixed(2)} MB`
          if (snapshot.operation) {
            report += ` (${snapshot.operation})`
          }
          report += '\n'
        }
      })
    }

    return report
  }

  clear() {
    this.snapshots = []
  }
}

// 힙 덤프 분석기
class HeapAnalyzer {
  static async createHeapSnapshot(): Promise<any> {
    return new Promise((resolve) => {
      const heapSnapshot = v8.getHeapSnapshot()
      const chunks: Buffer[] = []

      heapSnapshot.on('data', (chunk) => {
        chunks.push(chunk)
      })

      heapSnapshot.on('end', () => {
        const heapData = Buffer.concat(chunks).toString()
        try {
          const heapObject = JSON.parse(heapData)
          resolve(heapObject)
        } catch (error) {
          resolve({ error: 'Failed to parse heap snapshot' })
        }
      })
    })
  }

  static compareHeapSnapshots(
    before: any,
    after: any
  ): {
    newObjects: number
    deletedObjects: number
    sizeDifference: number
  } {
    if (before.error || after.error) {
      return { newObjects: 0, deletedObjects: 0, sizeDifference: 0 }
    }

    // 간단한 객체 수 비교 (실제로는 더 복잡한 분석 필요)
    const beforeObjects = before.nodes?.length || 0
    const afterObjects = after.nodes?.length || 0

    return {
      newObjects: Math.max(0, afterObjects - beforeObjects),
      deletedObjects: Math.max(0, beforeObjects - afterObjects),
      sizeDifference: (after.meta?.total_size || 0) - (before.meta?.total_size || 0),
    }
  }
}

// 메모리 스트레스 테스터
class MemoryStressTester {
  private retainedObjects: any[] = []

  createMemoryPressure(sizeInMB: number) {
    const bufferSize = sizeInMB * 1024 * 1024
    const buffer = Buffer.alloc(bufferSize, 'memory-pressure-test')
    this.retainedObjects.push(buffer)
    return buffer
  }

  releaseMemoryPressure() {
    this.retainedObjects.length = 0
    if (global.gc) {
      global.gc()
    }
  }

  getRetainedMemory(): number {
    return (
      this.retainedObjects.reduce((total, obj) => {
        return total + (obj.length || 0)
      }, 0) /
      1024 /
      1024
    ) // MB
  }
}

describe('Memory Leak Detection Tests', () => {
  let mailProcessor: MailProcessor
  let notificationService: NotificationService
  let profiler: MemoryProfiler
  let stressTester: MemoryStressTester

  beforeAll(async () => {
    await db.$connect()
    await redis.connect()

    mailProcessor = new MailProcessor()
    notificationService = new NotificationService()
    profiler = new MemoryProfiler()
    stressTester = new MemoryStressTester()

    // 메모리 테스트 모드 활성화
    process.env.MEMORY_TEST_MODE = 'true'

    // 가비지 컬렉션 강제 활성화
    if (global.gc) {
      console.log('Garbage collection enabled for memory leak tests')
    } else {
      console.warn('Run with --expose-gc flag for accurate memory leak detection')
    }
  })

  afterAll(async () => {
    stressTester.releaseMemoryPressure()
    await db.$disconnect()
    await redis.disconnect()
    delete process.env.MEMORY_TEST_MODE

    console.log(profiler.generateReport())
  })

  beforeEach(() => {
    profiler.clear()
    if (global.gc) {
      global.gc()
    }
  })

  describe('Email Processing Memory Leaks', () => {
    it('should not leak memory during repeated email processing', async () => {
      // 테스트 회사 생성
      const company = await db.company.create({
        data: {
          name: '메모리누수테스트 회사',
          email: 'memory-leak@test.com',
          region: '서울',
          isActive: true,
          contacts: {
            create: {
              name: '담당자',
              phone: '010-9999-8888',
              isActive: true,
              smsEnabled: true,
              kakaoEnabled: false,
            },
          },
        },
      })

      const iterations = 50
      const emailsPerIteration = 5

      console.log(
        `Testing memory leaks over ${iterations} iterations (${emailsPerIteration} emails each)...`
      )

      // 기준선 측정
      if (global.gc) global.gc()
      profiler.takeSnapshot(0, 'baseline')

      for (let iteration = 1; iteration <= iterations; iteration++) {
        // 이메일 처리
        const emails = Array.from({ length: emailsPerIteration }, (_, emailIndex) => ({
          messageId: `memory-leak-test-${iteration}-${emailIndex}-${Date.now()}`,
          subject: `[메모리누수테스트 회사] 테스트 이메일 ${iteration}-${emailIndex}`,
          from: company.email,
          to: 'order@echomail.com',
          receivedAt: new Date(),
          body: `메모리 누수 테스트용 이메일 ${iteration}-${emailIndex}. `.repeat(100), // 더 큰 데이터
          attachments: [
            {
              filename: `test_${iteration}_${emailIndex}.pdf`,
              contentType: 'application/pdf',
              size: 1024 * 10, // 10KB
              content: Buffer.alloc(1024 * 10, `attachment-data-${iteration}-${emailIndex}`),
            },
          ],
        }))

        // 배치 처리
        for (const email of emails) {
          await mailProcessor.processEmail(email)
        }

        // 처리된 데이터 정리 (운영 환경에서의 정리 작업 시뮬레이션)
        if (iteration % 5 === 0) {
          await db.emailLog.deleteMany({
            where: {
              createdAt: {
                lt: new Date(Date.now() - 60000), // 1분 전 데이터 삭제
              },
            },
          })

          await db.notificationLog.deleteMany({
            where: {
              createdAt: {
                lt: new Date(Date.now() - 60000),
              },
            },
          })
        }

        // 메모리 스냅샷
        if (iteration % 5 === 0) {
          // 5번마다 측정
          if (global.gc) global.gc() // 가비지 컬렉션 강제 실행
          profiler.takeSnapshot(iteration, 'email-processing')
        }

        // 진행상황 출력
        if (iteration % 10 === 0) {
          const currentMemory = process.memoryUsage()
          console.log(
            `Iteration ${iteration}/${iterations}: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
          )
        }
      }

      // 최종 측정
      if (global.gc) global.gc()
      profiler.takeSnapshot(iterations, 'final')

      // 메모리 누수 분석
      const trend = profiler.getMemoryTrend()
      const snapshots = profiler['snapshots']
      const initialMemory = snapshots[0].heapUsed
      const finalMemory = snapshots[snapshots.length - 1].heapUsed
      const totalIncrease = finalMemory - initialMemory

      // 메모리 누수 검증
      expect(trend.isIncreasing).toBe(false) // 지속적인 증가 패턴이 없어야 함
      expect(totalIncrease).toBeLessThan(50) // 총 50MB 미만 증가
      expect(Math.abs(trend.correlation)).toBeLessThan(0.8) // 강한 상관관계 없어야 함

      console.log(`Memory leak test completed:`)
      console.log(`  Initial: ${initialMemory.toFixed(2)}MB`)
      console.log(`  Final: ${finalMemory.toFixed(2)}MB`)
      console.log(`  Total increase: ${totalIncrease.toFixed(2)}MB`)
      console.log(`  Average per iteration: ${trend.averageIncrease.toFixed(4)}MB`)
      console.log(`  Memory leak detected: ${trend.isIncreasing ? 'YES' : 'NO'}`)
    })

    it('should handle large attachments without memory leaks', async () => {
      const company = await db.company.create({
        data: {
          name: '대용량첨부파일 테스트회사',
          email: 'large-attachment@test.com',
          region: '서울',
          isActive: true,
          contacts: {
            create: {
              name: '담당자',
              phone: '010-8888-7777',
              isActive: true,
              smsEnabled: true,
              kakaoEnabled: false,
            },
          },
        },
      })

      const iterations = 20
      const attachmentSizeMB = 5 // 5MB 첨부파일

      console.log(
        `Testing large attachment memory handling (${attachmentSizeMB}MB × ${iterations} iterations)...`
      )

      profiler.takeSnapshot(0, 'baseline')

      for (let iteration = 1; iteration <= iterations; iteration++) {
        // 대용량 첨부파일 이메일 생성
        const largeAttachment = Buffer.alloc(
          attachmentSizeMB * 1024 * 1024,
          `large-data-${iteration}`
        )

        const email = {
          messageId: `large-attachment-${iteration}-${Date.now()}`,
          subject: `[대용량첨부파일 테스트회사] 대용량 파일 ${iteration}`,
          from: company.email,
          to: 'order@echomail.com',
          receivedAt: new Date(),
          body: `대용량 첨부파일 테스트 ${iteration}`,
          attachments: [
            {
              filename: `large_file_${iteration}.zip`,
              contentType: 'application/zip',
              size: largeAttachment.length,
              content: largeAttachment,
            },
          ],
        }

        // 이메일 처리
        const result = await mailProcessor.processEmail(email)
        expect(result.success).toBe(true)

        // 첨부파일 참조 해제 (실제 구현에서 중요)
        largeAttachment.fill(0) // 버퍼 내용 지우기

        // 주기적으로 가비지 컬렉션
        if (iteration % 5 === 0) {
          if (global.gc) global.gc()
          profiler.takeSnapshot(iteration, 'large-attachment')

          const currentMemory = process.memoryUsage()
          console.log(
            `Iteration ${iteration}: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
          )
        }

        // 메모리 사용량 확인 (과도한 증가 시 조기 종료)
        const currentMemory = process.memoryUsage()
        if (currentMemory.heapUsed > 500 * 1024 * 1024) {
          // 500MB 초과
          console.warn(
            `Memory usage too high: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
          )
          break
        }
      }

      if (global.gc) global.gc()
      profiler.takeSnapshot(iterations, 'final')

      // 메모리 누수 검증
      const trend = profiler.getMemoryTrend()
      expect(trend.averageIncrease).toBeLessThan(1.0) // 반복당 1MB 미만 증가

      const snapshots = profiler['snapshots']
      const finalMemory = snapshots[snapshots.length - 1].heapUsed
      expect(finalMemory).toBeLessThan(200) // 최종 메모리 200MB 미만

      console.log(`Large attachment test: final memory ${finalMemory.toFixed(2)}MB`)
    })
  })

  describe('Database Connection Memory Leaks', () => {
    it('should not leak database connections', async () => {
      const iterations = 30
      const operationsPerIteration = 10

      console.log(`Testing database connection memory leaks over ${iterations} iterations...`)

      profiler.takeSnapshot(0, 'baseline')

      for (let iteration = 1; iteration <= iterations; iteration++) {
        // 다양한 데이터베이스 작업
        const operations = []

        for (let op = 0; op < operationsPerIteration; op++) {
          operations.push(
            // 회사 생성
            db.company.create({
              data: {
                name: `DB테스트회사_${iteration}_${op}`,
                email: `db${iteration}_${op}@test.com`,
                region: '서울',
                isActive: true,
                contacts: {
                  create: {
                    name: `담당자_${iteration}_${op}`,
                    phone: `010-${String(iteration).padStart(4, '0')}-${String(op).padStart(4, '0')}`,
                    isActive: true,
                    smsEnabled: true,
                    kakaoEnabled: false,
                  },
                },
              },
            }),

            // 이메일 로그 생성
            db.emailLog.create({
              data: {
                messageId: `db-test-${iteration}-${op}`,
                subject: `DB 테스트 ${iteration}-${op}`,
                sender: `db${iteration}_${op}@test.com`,
                recipient: 'order@echomail.com',
                receivedAt: new Date(),
                hasAttachment: false,
                status: 'RECEIVED',
              },
            }),

            // 복잡한 쿼리
            db.company.findMany({
              where: { isActive: true },
              include: { contacts: true, emailLogs: true },
              take: 5,
            })
          )
        }

        // 모든 작업을 트랜잭션으로 실행
        await db.$transaction(async (tx) => {
          const results = await Promise.all(operations)
          return results
        })

        // 생성된 데이터 정리 (연결 누수 방지)
        if (iteration % 5 === 0) {
          await db.company.deleteMany({
            where: {
              email: {
                startsWith: `db${iteration - 4}_`,
              },
            },
          })

          await db.emailLog.deleteMany({
            where: {
              messageId: {
                startsWith: `db-test-${iteration - 4}-`,
              },
            },
          })
        }

        // 메모리 측정
        if (iteration % 5 === 0) {
          if (global.gc) global.gc()
          profiler.takeSnapshot(iteration, 'database-operations')
        }
      }

      if (global.gc) global.gc()
      profiler.takeSnapshot(iterations, 'final')

      // 연결 누수 검증
      const trend = profiler.getMemoryTrend()
      expect(trend.isIncreasing).toBe(false)
      expect(trend.averageIncrease).toBeLessThan(0.5) // 반복당 0.5MB 미만

      console.log(`Database connection test: ${trend.isIncreasing ? 'LEAK DETECTED' : 'NO LEAKS'}`)
    })
  })

  describe('Redis Connection Memory Leaks', () => {
    it('should not leak Redis connections or memory', async () => {
      const iterations = 40
      const operationsPerIteration = 20

      console.log(`Testing Redis memory leaks over ${iterations} iterations...`)

      profiler.takeSnapshot(0, 'baseline')

      for (let iteration = 1; iteration <= iterations; iteration++) {
        const redisOperations = []

        // 다양한 Redis 작업
        for (let op = 0; op < operationsPerIteration; op++) {
          const key = `redis-test:${iteration}:${op}`
          const value = JSON.stringify({
            data: `test-data-${iteration}-${op}`,
            timestamp: Date.now(),
            iteration,
            operation: op,
          })

          redisOperations.push(
            // 기본 작업들
            redis.set(key, value),
            redis.get(key),
            redis.expire(key, 60),
            redis.lpush(`${key}:list`, value),
            redis.hset(`${key}:hash`, 'field1', value),
            redis.sadd(`${key}:set`, value)
          )
        }

        // 병렬 실행
        await Promise.all(redisOperations)

        // 파이프라인 작업
        const pipeline = redis.pipeline()
        for (let op = 0; op < operationsPerIteration; op++) {
          const key = `pipeline-test:${iteration}:${op}`
          pipeline.set(key, `pipeline-value-${iteration}-${op}`)
          pipeline.expire(key, 30)
        }
        await pipeline.exec()

        // 주기적 정리
        if (iteration % 10 === 0) {
          const keysToDelete = await redis.keys(`redis-test:${iteration - 9}:*`)
          if (keysToDelete.length > 0) {
            await redis.del(...keysToDelete)
          }

          const pipelineKeysToDelete = await redis.keys(`pipeline-test:${iteration - 9}:*`)
          if (pipelineKeysToDelete.length > 0) {
            await redis.del(...pipelineKeysToDelete)
          }
        }

        // 메모리 측정
        if (iteration % 5 === 0) {
          if (global.gc) global.gc()
          profiler.takeSnapshot(iteration, 'redis-operations')

          // Redis 메모리 사용량도 확인
          const redisInfo = await redis.memory('usage', 'redis-test:sample-key')
          if (iteration % 10 === 0) {
            console.log(
              `Iteration ${iteration}: Node memory ${process.memoryUsage().heapUsed / 1024 / 1024}MB`
            )
          }
        }
      }

      // 최종 정리
      const allKeys = await redis.keys('redis-test:*')
      if (allKeys.length > 0) {
        await redis.del(...allKeys)
      }

      const allPipelineKeys = await redis.keys('pipeline-test:*')
      if (allPipelineKeys.length > 0) {
        await redis.del(...allPipelineKeys)
      }

      if (global.gc) global.gc()
      profiler.takeSnapshot(iterations, 'final')

      // 메모리 누수 검증
      const trend = profiler.getMemoryTrend()
      expect(trend.isIncreasing).toBe(false)
      expect(trend.averageIncrease).toBeLessThan(0.3) // Redis는 더 엄격한 기준

      console.log(`Redis connection test: ${trend.isIncreasing ? 'LEAK DETECTED' : 'NO LEAKS'}`)
    })
  })

  describe('Memory Pressure Testing', () => {
    it('should gracefully handle memory pressure', async () => {
      console.log('Testing behavior under memory pressure...')

      // 기준선
      if (global.gc) global.gc()
      profiler.takeSnapshot(0, 'baseline')

      // 점진적으로 메모리 압박 증가
      const pressureLevels = [50, 100, 200, 300] // MB

      for (const pressureMB of pressureLevels) {
        console.log(`Creating ${pressureMB}MB memory pressure...`)

        // 메모리 압박 생성
        stressTester.createMemoryPressure(pressureMB)
        profiler.takeSnapshot(pressureMB, `pressure-${pressureMB}MB`)

        // 압박 상황에서 일반 작업 수행
        const company = await db.company.create({
          data: {
            name: `메모리압박테스트회사_${pressureMB}`,
            email: `pressure${pressureMB}@test.com`,
            region: '서울',
            isActive: true,
            contacts: {
              create: {
                name: '압박테스트담당자',
                phone: `010-${String(pressureMB).padStart(4, '0')}-0000`,
                isActive: true,
                smsEnabled: true,
                kakaoEnabled: false,
              },
            },
          },
        })

        // 메모리 압박 상황에서 이메일 처리
        const email = {
          messageId: `pressure-test-${pressureMB}-${Date.now()}`,
          subject: `[메모리압박테스트회사_${pressureMB}] 압박 테스트`,
          from: `pressure${pressureMB}@test.com`,
          to: 'order@echomail.com',
          receivedAt: new Date(),
          body: '메모리 압박 상황에서의 이메일 처리 테스트',
          attachments: [],
        }

        try {
          const result = await mailProcessor.processEmail(email)
          expect(result.success).toBe(true)
        } catch (error) {
          if (error.message.includes('out of memory')) {
            console.log(`Out of memory at ${pressureMB}MB pressure - expected behavior`)
          } else {
            throw error
          }
        }

        // 현재 메모리 상태 확인
        const currentMemory = process.memoryUsage()
        console.log(`  Current memory: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)
        console.log(`  Retained by tester: ${stressTester.getRetainedMemory().toFixed(2)}MB`)

        // 메모리 사용량이 너무 높으면 조기 종료
        if (currentMemory.heapUsed > 1024 * 1024 * 1024) {
          // 1GB
          console.log('Memory usage too high, stopping pressure test')
          break
        }
      }

      // 메모리 압박 해제
      stressTester.releaseMemoryPressure()
      if (global.gc) global.gc()
      profiler.takeSnapshot(0, 'pressure-released')

      // 복구 확인
      await new Promise((resolve) => setTimeout(resolve, 1000)) // 복구 시간
      if (global.gc) global.gc()
      profiler.takeSnapshot(0, 'recovered')

      const snapshots = profiler['snapshots']
      const baseline = snapshots[0]
      const recovered = snapshots[snapshots.length - 1]

      // 메모리가 기준선 근처로 돌아왔는지 확인
      const recoveryDiff = recovered.heapUsed - baseline.heapUsed
      expect(recoveryDiff).toBeLessThan(30) // 30MB 이내 차이

      console.log(
        `Memory pressure test: baseline ${baseline.heapUsed.toFixed(2)}MB → recovered ${recovered.heapUsed.toFixed(2)}MB (diff: ${recoveryDiff.toFixed(2)}MB)`
      )
    })
  })

  describe('Heap Analysis', () => {
    it('should detect object retention patterns', async () => {
      console.log('Analyzing heap for object retention patterns...')

      // 초기 힙 스냅샷
      const beforeSnapshot = await HeapAnalyzer.createHeapSnapshot()

      // 많은 객체 생성 작업
      const objectCreationIterations = 10
      const objectsPerIteration = 100
      const retainedObjects = []

      for (let iteration = 0; iteration < objectCreationIterations; iteration++) {
        const batchObjects = []

        for (let i = 0; i < objectsPerIteration; i++) {
          // 다양한 타입의 객체 생성
          const testObject = {
            id: `heap-test-${iteration}-${i}`,
            data: Buffer.alloc(1024, `data-${iteration}-${i}`),
            timestamp: Date.now(),
            metadata: {
              iteration,
              index: i,
              type: 'heap-test-object',
            },
            largeString: 'x'.repeat(1000),
          }

          batchObjects.push(testObject)
        }

        // 일부 객체는 유지, 일부는 해제
        if (iteration % 2 === 0) {
          retainedObjects.push(...batchObjects.slice(0, objectsPerIteration / 2))
        }

        // 진행상황 기록
        profiler.takeSnapshot(iteration, `heap-objects-${iteration}`)
      }

      // 중간 힙 스냅샷
      const middleSnapshot = await HeapAnalyzer.createHeapSnapshot()

      // 일부 객체 해제
      retainedObjects.splice(0, retainedObjects.length / 2)
      if (global.gc) global.gc()

      // 최종 힙 스냅샷
      const afterSnapshot = await HeapAnalyzer.createHeapSnapshot()

      // 힙 분석
      const beforeAfterComparison = HeapAnalyzer.compareHeapSnapshots(beforeSnapshot, afterSnapshot)
      const middleAfterComparison = HeapAnalyzer.compareHeapSnapshots(middleSnapshot, afterSnapshot)

      console.log('Heap analysis results:')
      console.log(`  Objects created: ${beforeAfterComparison.newObjects}`)
      console.log(`  Objects deleted: ${beforeAfterComparison.deletedObjects}`)
      console.log(`  Size difference: ${beforeAfterComparison.sizeDifference} bytes`)
      console.log(`  Retained objects: ${retainedObjects.length}`)

      // 메모리 트렌드 분석
      const trend = profiler.getMemoryTrend()
      console.log(`  Memory trend slope: ${trend.slope.toFixed(4)}MB per iteration`)
      console.log(`  Strong correlation: ${Math.abs(trend.correlation) > 0.7 ? 'YES' : 'NO'}`)

      // 최종 정리
      retainedObjects.length = 0
      if (global.gc) global.gc()

      // 검증: 정리 후 메모리가 적절히 해제되었는지
      const finalMemory = process.memoryUsage()
      profiler.takeSnapshot(objectCreationIterations, 'heap-cleaned')

      const cleanupSnapshot = profiler['snapshots']
      const memoryAfterCleanup = cleanupSnapshot[cleanupSnapshot.length - 1].heapUsed
      const memoryBeforeTest = cleanupSnapshot[0].heapUsed
      const netIncrease = memoryAfterCleanup - memoryBeforeTest

      expect(netIncrease).toBeLessThan(20) // 20MB 미만 순 증가

      console.log(
        `Heap cleanup: ${memoryBeforeTest.toFixed(2)}MB → ${memoryAfterCleanup.toFixed(2)}MB (net: ${netIncrease.toFixed(2)}MB)`
      )
    })
  })
})
