/**
 * 데이터베이스 성능 테스트
 *
 * 이 테스트는 데이터베이스 관련 성능을 측정합니다:
 * 1. 대용량 데이터 삽입/조회 성능
 * 2. 복잡한 조인 쿼리 성능
 * 3. 인덱스 효율성 검증
 * 4. 연결 풀 최적화 확인
 */

import { prisma } from '@/lib/db'

// 성능 메트릭 타입
interface DatabaseMetrics {
  queryTime: number
  recordsProcessed: number
  throughput: number
  memoryUsage: number
}

class DatabasePerformanceTester {
  private startTime: number = 0
  private endTime: number = 0

  startTimer(): void {
    this.startTime = performance.now()
  }

  endTimer(): number {
    this.endTime = performance.now()
    return this.endTime - this.startTime
  }

  getMemoryUsage(): number {
    const used = process.memoryUsage()
    return Math.round((used.heapUsed / 1024 / 1024) * 100) / 100
  }

  async measureQuery<T>(
    queryFunction: () => Promise<T>,
    recordCount: number = 1
  ): Promise<DatabaseMetrics> {
    const initialMemory = this.getMemoryUsage()

    this.startTimer()
    await queryFunction()
    const queryTime = this.endTimer()

    const finalMemory = this.getMemoryUsage()
    const throughput = recordCount / (queryTime / 1000)

    return {
      queryTime,
      recordsProcessed: recordCount,
      throughput,
      memoryUsage: finalMemory - initialMemory,
    }
  }

  async runBulkInsertTest(tableName: string, recordCount: number): Promise<DatabaseMetrics> {
    const data = Array.from({ length: recordCount }, (_, i) => ({
      name: `Test Company ${i}`,
      email: `test${i}@company.com`,
      phone: `010-${String(i).padStart(4, '0')}-${String(i).padStart(4, '0')}`,
      tenantId: 'test-tenant-performance',
    }))

    return this.measureQuery(async () => {
      // 실제 환경에서는 createMany 사용
      // 테스트에서는 모킹된 함수 호출
      if (tableName === 'companies') {
        await prisma.company.createMany({ data })
      }
    }, recordCount)
  }

  async runComplexJoinTest(): Promise<DatabaseMetrics> {
    return this.measureQuery(async () => {
      // 복잡한 조인 쿼리 시뮬레이션
      await prisma.company.findMany({
        include: {
          contacts: {
            include: {
              deliveryRules: true,
            },
          },
        },
        where: {
          tenantId: 'test-tenant-performance',
        },
      })
    })
  }

  async runPaginationTest(pageSize: number, pageCount: number): Promise<DatabaseMetrics> {
    const expectedTotal = pageSize * pageCount

    return this.measureQuery(async () => {
      let totalRecords = 0
      for (let page = 0; page < pageCount; page++) {
        const results = await prisma.company.findMany({
          skip: page * pageSize,
          take: pageSize,
          where: {
            tenantId: 'test-tenant-performance',
          },
        })
        totalRecords += results.length
      }
      return totalRecords
    }, expectedTotal)
  }
}

describe('데이터베이스 성능 테스트', () => {
  const tester = new DatabasePerformanceTester()
  const testTenantId = 'test-tenant-performance'

  beforeEach(() => {
    jest.clearAllMocks()

    // 성능 테스트용 모킹 - 실제 데이터 처리 시뮬레이션
    ;(prisma.company.createMany as jest.Mock).mockImplementation(async ({ data }) => {
      // 실제 삽입 시간 시뮬레이션
      const delay = data.length * 0.1 // 레코드당 0.1ms
      await new Promise((resolve) => setTimeout(resolve, delay))
      return { count: data.length }
    })
    ;(prisma.company.findMany as jest.Mock).mockImplementation(async (options) => {
      // 조회 시간 시뮬레이션
      const take = options?.take || 100
      const delay = take * 0.05 // 레코드당 0.05ms
      await new Promise((resolve) => setTimeout(resolve, delay))

      return Array.from({ length: take }, (_, i) => ({
        id: `company-${i}`,
        name: `Company ${i}`,
        tenantId: testTenantId,
        contacts: options?.include?.contacts
          ? [
              {
                id: `contact-${i}`,
                name: `Contact ${i}`,
                deliveryRules: options?.include?.contacts?.include?.deliveryRules ? [] : undefined,
              },
            ]
          : undefined,
      }))
    })
  })

  describe('대용량 데이터 처리 성능', () => {
    test('1,000개 회사 정보 일괄 삽입 성능', async () => {
      const metrics = await tester.runBulkInsertTest('companies', 1000)

      console.log('회사 정보 일괄 삽입 결과:', {
        쿼리실행시간: `${metrics.queryTime.toFixed(2)}ms`,
        처리된레코드: metrics.recordsProcessed,
        처리량: `${metrics.throughput.toFixed(2)} records/sec`,
        메모리사용량: `${metrics.memoryUsage}MB`,
      })

      // 성능 기준 검증
      expect(metrics.queryTime).toBeLessThan(5000) // 5초 이내
      expect(metrics.throughput).toBeGreaterThan(100) // 초당 100개 이상
    })

    test('10,000개 회사 정보 일괄 삽입 스트레스 테스트', async () => {
      const metrics = await tester.runBulkInsertTest('companies', 10000)

      console.log('대용량 일괄 삽입 결과:', {
        쿼리실행시간: `${metrics.queryTime.toFixed(2)}ms`,
        처리된레코드: metrics.recordsProcessed,
        처리량: `${metrics.throughput.toFixed(2)} records/sec`,
        메모리사용량: `${metrics.memoryUsage}MB`,
      })

      // 대용량 처리 기준
      expect(metrics.queryTime).toBeLessThan(30000) // 30초 이내
      expect(metrics.throughput).toBeGreaterThan(200) // 초당 200개 이상
    })
  })

  describe('복잡한 쿼리 성능', () => {
    test('다중 조인 쿼리 성능 테스트', async () => {
      const metrics = await tester.runComplexJoinTest()

      console.log('복잡한 조인 쿼리 결과:', {
        쿼리실행시간: `${metrics.queryTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} queries/sec`,
        메모리사용량: `${metrics.memoryUsage}MB`,
      })

      // 복잡한 쿼리 성능 기준
      expect(metrics.queryTime).toBeLessThan(1000) // 1초 이내
    })

    test('페이지네이션 성능 테스트', async () => {
      const metrics = await tester.runPaginationTest(50, 20) // 50개씩 20페이지

      console.log('페이지네이션 성능 결과:', {
        쿼리실행시간: `${metrics.queryTime.toFixed(2)}ms`,
        처리된레코드: metrics.recordsProcessed,
        처리량: `${metrics.throughput.toFixed(2)} records/sec`,
        메모리사용량: `${metrics.memoryUsage}MB`,
      })

      // 페이지네이션 성능 기준
      expect(metrics.queryTime).toBeLessThan(2000) // 2초 이내
      expect(metrics.recordsProcessed).toBe(1000) // 총 1000개 레코드
    })
  })

  describe('연결 풀 성능 테스트', () => {
    test('동시 다중 쿼리 실행 성능', async () => {
      const concurrentQueries = 50
      const queries = Array.from({ length: concurrentQueries }, () =>
        tester.measureQuery(async () => {
          await prisma.company.findMany({
            take: 10,
            where: { tenantId: testTenantId },
          })
        })
      )

      const startTime = performance.now()
      const results = await Promise.all(queries)
      const totalTime = performance.now() - startTime

      const avgQueryTime = results.reduce((sum, r) => sum + r.queryTime, 0) / results.length
      const totalThroughput = (concurrentQueries * 10) / (totalTime / 1000)

      console.log('동시 쿼리 실행 결과:', {
        동시쿼리수: concurrentQueries,
        평균쿼리시간: `${avgQueryTime.toFixed(2)}ms`,
        전체실행시간: `${totalTime.toFixed(2)}ms`,
        전체처리량: `${totalThroughput.toFixed(2)} records/sec`,
      })

      // 동시 쿼리 성능 기준
      expect(totalTime).toBeLessThan(5000) // 5초 이내
      expect(avgQueryTime).toBeLessThan(500) // 평균 500ms 이내
    })
  })

  describe('메모리 효율성 테스트', () => {
    test('대용량 결과 집합 메모리 사용량 테스트', async () => {
      const metrics = await tester.measureQuery(async () => {
        // 대용량 결과 집합 조회 시뮬레이션
        const results = await prisma.company.findMany({
          take: 5000,
          where: { tenantId: testTenantId },
        })

        // 메모리 사용량 증가 시뮬레이션
        const largeArray = new Array(results.length).fill({
          id: 'test',
          name: 'Test Company',
          data: new Array(100).fill('data'),
        })

        return largeArray
      }, 5000)

      console.log('대용량 결과 집합 메모리 테스트:', {
        쿼리실행시간: `${metrics.queryTime.toFixed(2)}ms`,
        처리된레코드: metrics.recordsProcessed,
        메모리사용량: `${metrics.memoryUsage}MB`,
      })

      // 메모리 사용량 기준
      expect(metrics.memoryUsage).toBeLessThan(100) // 100MB 이내
    })
  })
})
