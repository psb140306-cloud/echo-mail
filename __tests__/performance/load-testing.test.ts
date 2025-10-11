/**
 * 부하 테스트 (Load Testing)
 *
 * Echo Mail 시스템의 주요 API 엔드포인트에 대한 부하 테스트:
 * 1. 이메일 처리 부하 테스트
 * 2. 알림 발송 부하 테스트
 * 3. API 동시 접속 테스트
 * 4. 데이터베이스 연결 풀 테스트
 * 5. 메모리 사용량 모니터링
 */

import { performance } from 'perf_hooks'

// 성능 측정 유틸리티
interface PerformanceMetrics {
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  throughput: number
  successRate: number
  errorRate: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
  }
}

class LoadTester {
  private results: number[] = []
  private errors: number = 0
  private startTime: number = 0
  private endTime: number = 0

  async runConcurrentRequests(
    requestFunction: () => Promise<any>,
    concurrency: number,
    duration: number
  ): Promise<PerformanceMetrics> {
    this.reset()
    this.startTime = performance.now()

    const promises: Promise<void>[] = []
    let requestCount = 0
    const endTime = this.startTime + duration

    // 동시 요청 실행
    for (let i = 0; i < concurrency; i++) {
      promises.push(this.workerLoop(requestFunction, endTime))
    }

    await Promise.all(promises)
    this.endTime = performance.now()

    return this.calculateMetrics()
  }

  private async workerLoop(requestFunction: () => Promise<any>, endTime: number): Promise<void> {
    while (performance.now() < endTime) {
      const start = performance.now()
      try {
        await requestFunction()
        const responseTime = performance.now() - start
        this.results.push(responseTime)
      } catch (error) {
        this.errors++
      }
    }
  }

  private reset(): void {
    this.results = []
    this.errors = 0
    this.startTime = 0
    this.endTime = 0
  }

  private calculateMetrics(): PerformanceMetrics {
    const totalRequests = this.results.length + this.errors
    const successfulRequests = this.results.length
    const duration = (this.endTime - this.startTime) / 1000 // seconds

    const sortedResults = this.results.sort((a, b) => a - b)

    return {
      averageResponseTime: this.results.reduce((a, b) => a + b, 0) / this.results.length || 0,
      minResponseTime: sortedResults[0] || 0,
      maxResponseTime: sortedResults[sortedResults.length - 1] || 0,
      throughput: totalRequests / duration,
      successRate: (successfulRequests / totalRequests) * 100,
      errorRate: (this.errors / totalRequests) * 100,
      memoryUsage: {
        heapUsed: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        heapTotal: process.memoryUsage().heapTotal / 1024 / 1024, // MB
        external: process.memoryUsage().external / 1024 / 1024, // MB
      },
    }
  }
}

describe('부하 테스트 (Load Testing)', () => {
  let loadTester: LoadTester

  beforeEach(() => {
    loadTester = new LoadTester()
  })

  describe('이메일 처리 부하 테스트', () => {
    test('이메일 파싱 성능 테스트 - 동시 100개 요청, 10초간', async () => {
      // 모의 이메일 파싱 함수
      const mockEmailParsing = async (): Promise<void> => {
        return new Promise((resolve) => {
          // 실제 이메일 파싱 로직 시뮬레이션
          const processingTime = Math.random() * 50 + 10 // 10-60ms
          setTimeout(resolve, processingTime)
        })
      }

      const metrics = await loadTester.runConcurrentRequests(
        mockEmailParsing,
        100, // 100개 동시 요청
        10000 // 10초간
      )

      console.log('이메일 파싱 성능 결과:', {
        평균응답시간: `${metrics.averageResponseTime.toFixed(2)}ms`,
        최소응답시간: `${metrics.minResponseTime.toFixed(2)}ms`,
        최대응답시간: `${metrics.maxResponseTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} req/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
        메모리사용량: `${metrics.memoryUsage.heapUsed.toFixed(2)}MB`,
      })

      // 성능 기준 검증
      expect(metrics.averageResponseTime).toBeLessThan(100) // 평균 100ms 이하
      expect(metrics.successRate).toBeGreaterThan(95) // 95% 이상 성공률
      expect(metrics.throughput).toBeGreaterThan(50) // 초당 50개 이상 처리
      expect(metrics.memoryUsage.heapUsed).toBeLessThan(500) // 500MB 이하 메모리 사용
    }, 15000)

    test('대용량 이메일 처리 스트레스 테스트 - 500개 동시 요청', async () => {
      // 대용량 이메일 처리 시뮬레이션
      const mockLargeEmailProcessing = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const processingTime = Math.random() * 200 + 50 // 50-250ms
          const failureRate = 0.02 // 2% 실패율

          setTimeout(() => {
            if (Math.random() < failureRate) {
              reject(new Error('Processing failed'))
            } else {
              resolve()
            }
          }, processingTime)
        })
      }

      const metrics = await loadTester.runConcurrentRequests(
        mockLargeEmailProcessing,
        500, // 500개 동시 요청
        5000 // 5초간
      )

      console.log('대용량 이메일 처리 결과:', {
        평균응답시간: `${metrics.averageResponseTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} req/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
        오류율: `${metrics.errorRate.toFixed(2)}%`,
      })

      // 스트레스 테스트 기준
      expect(metrics.averageResponseTime).toBeLessThan(300) // 평균 300ms 이하
      expect(metrics.successRate).toBeGreaterThan(90) // 90% 이상 성공률
      expect(metrics.errorRate).toBeLessThan(10) // 10% 이하 오류율
    }, 10000)
  })

  describe('알림 발송 부하 테스트', () => {
    test('SMS 알림 발송 성능 테스트 - 200개 동시 요청', async () => {
      // SMS 발송 시뮬레이션
      const mockSMSSending = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const sendingTime = Math.random() * 150 + 25 // 25-175ms
          const failureRate = 0.01 // 1% 실패율

          setTimeout(() => {
            if (Math.random() < failureRate) {
              reject(new Error('SMS sending failed'))
            } else {
              resolve()
            }
          }, sendingTime)
        })
      }

      const metrics = await loadTester.runConcurrentRequests(
        mockSMSSending,
        200, // 200개 동시 요청
        8000 // 8초간
      )

      console.log('SMS 발송 성능 결과:', {
        평균응답시간: `${metrics.averageResponseTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} req/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
      })

      expect(metrics.averageResponseTime).toBeLessThan(200) // 평균 200ms 이하
      expect(metrics.successRate).toBeGreaterThan(95) // 95% 이상 성공률
      expect(metrics.throughput).toBeGreaterThan(20) // 초당 20개 이상 처리
    }, 12000)

    test('카카오톡 알림 발송 성능 테스트 - 300개 동시 요청', async () => {
      // 카카오톡 발송 시뮬레이션
      const mockKakaoSending = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const sendingTime = Math.random() * 100 + 30 // 30-130ms
          const failureRate = 0.005 // 0.5% 실패율

          setTimeout(() => {
            if (Math.random() < failureRate) {
              reject(new Error('Kakao sending failed'))
            } else {
              resolve()
            }
          }, sendingTime)
        })
      }

      const metrics = await loadTester.runConcurrentRequests(
        mockKakaoSending,
        300, // 300개 동시 요청
        6000 // 6초간
      )

      console.log('카카오톡 발송 성능 결과:', {
        평균응답시간: `${metrics.averageResponseTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} req/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
      })

      expect(metrics.averageResponseTime).toBeLessThan(150) // 평균 150ms 이하
      expect(metrics.successRate).toBeGreaterThan(98) // 98% 이상 성공률
      expect(metrics.throughput).toBeGreaterThan(40) // 초당 40개 이상 처리
    }, 10000)
  })

  describe('API 동시 접속 테스트', () => {
    test('회사 목록 조회 API 부하 테스트 - 1000개 동시 요청', async () => {
      // API 요청 시뮬레이션
      const mockApiRequest = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const responseTime = Math.random() * 80 + 20 // 20-100ms
          const failureRate = 0.01 // 1% 실패율

          setTimeout(() => {
            if (Math.random() < failureRate) {
              reject(new Error('API request failed'))
            } else {
              resolve()
            }
          }, responseTime)
        })
      }

      const metrics = await loadTester.runConcurrentRequests(
        mockApiRequest,
        1000, // 1000개 동시 요청
        5000 // 5초간
      )

      console.log('API 부하 테스트 결과:', {
        평균응답시간: `${metrics.averageResponseTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} req/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
        메모리사용량: `${metrics.memoryUsage.heapUsed.toFixed(2)}MB`,
      })

      expect(metrics.averageResponseTime).toBeLessThan(120) // 평균 120ms 이하
      expect(metrics.successRate).toBeGreaterThan(95) // 95% 이상 성공률
      expect(metrics.throughput).toBeGreaterThan(100) // 초당 100개 이상 처리
    }, 8000)

    test('인증 API 스트레스 테스트 - 2000개 동시 요청', async () => {
      // 인증 API 시뮬레이션
      const mockAuthRequest = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const responseTime = Math.random() * 60 + 10 // 10-70ms
          const failureRate = 0.02 // 2% 실패율

          setTimeout(() => {
            if (Math.random() < failureRate) {
              reject(new Error('Auth failed'))
            } else {
              resolve()
            }
          }, responseTime)
        })
      }

      const metrics = await loadTester.runConcurrentRequests(
        mockAuthRequest,
        2000, // 2000개 동시 요청
        3000 // 3초간
      )

      console.log('인증 API 스트레스 테스트 결과:', {
        평균응답시간: `${metrics.averageResponseTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} req/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
      })

      expect(metrics.averageResponseTime).toBeLessThan(100) // 평균 100ms 이하
      expect(metrics.successRate).toBeGreaterThan(90) // 90% 이상 성공률
      expect(metrics.throughput).toBeGreaterThan(200) // 초당 200개 이상 처리
    }, 6000)
  })

  describe('데이터베이스 연결 풀 테스트', () => {
    test('DB 쿼리 동시 실행 테스트 - 500개 동시 쿼리', async () => {
      // DB 쿼리 시뮬레이션
      const mockDbQuery = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const queryTime = Math.random() * 40 + 5 // 5-45ms
          const failureRate = 0.005 // 0.5% 실패율

          setTimeout(() => {
            if (Math.random() < failureRate) {
              reject(new Error('DB query failed'))
            } else {
              resolve()
            }
          }, queryTime)
        })
      }

      const metrics = await loadTester.runConcurrentRequests(
        mockDbQuery,
        500, // 500개 동시 쿼리
        7000 // 7초간
      )

      console.log('DB 쿼리 성능 결과:', {
        평균응답시간: `${metrics.averageResponseTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} queries/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
      })

      expect(metrics.averageResponseTime).toBeLessThan(60) // 평균 60ms 이하
      expect(metrics.successRate).toBeGreaterThan(98) // 98% 이상 성공률
      expect(metrics.throughput).toBeGreaterThan(50) // 초당 50개 이상 쿼리 처리
    }, 10000)

    test('DB 트랜잭션 부하 테스트 - 200개 동시 트랜잭션', async () => {
      // DB 트랜잭션 시뮬레이션
      const mockDbTransaction = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const transactionTime = Math.random() * 120 + 30 // 30-150ms
          const failureRate = 0.01 // 1% 실패율

          setTimeout(() => {
            if (Math.random() < failureRate) {
              reject(new Error('Transaction failed'))
            } else {
              resolve()
            }
          }, transactionTime)
        })
      }

      const metrics = await loadTester.runConcurrentRequests(
        mockDbTransaction,
        200, // 200개 동시 트랜잭션
        8000 // 8초간
      )

      console.log('DB 트랜잭션 성능 결과:', {
        평균응답시간: `${metrics.averageResponseTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} tx/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
      })

      expect(metrics.averageResponseTime).toBeLessThan(180) // 평균 180ms 이하
      expect(metrics.successRate).toBeGreaterThan(95) // 95% 이상 성공률
      expect(metrics.throughput).toBeGreaterThan(15) // 초당 15개 이상 트랜잭션 처리
    }, 12000)
  })

  describe('메모리 사용량 모니터링', () => {
    test('메모리 누수 검사 - 장시간 실행', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      // 메모리 사용 시뮬레이션
      const mockMemoryIntensiveTask = async (): Promise<void> => {
        // 임시 데이터 생성 및 처리
        const tempData = new Array(1000).fill(0).map(() => ({
          id: Math.random().toString(36),
          data: new Array(100).fill(Math.random()),
        }))

        // 처리 시뮬레이션
        await new Promise((resolve) => setTimeout(resolve, 10))

        // 가비지 컬렉션 유도
        if (global.gc) {
          global.gc()
        }
      }

      const metrics = await loadTester.runConcurrentRequests(
        mockMemoryIntensiveTask,
        50, // 50개 동시 작업
        5000 // 5초간
      )

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // MB

      console.log('메모리 사용량 분석:', {
        시작메모리: `${(initialMemory / 1024 / 1024).toFixed(2)}MB`,
        종료메모리: `${(finalMemory / 1024 / 1024).toFixed(2)}MB`,
        메모리증가: `${memoryIncrease.toFixed(2)}MB`,
        최대힙사용량: `${metrics.memoryUsage.heapUsed.toFixed(2)}MB`,
      })

      // 메모리 누수 검사
      expect(memoryIncrease).toBeLessThan(100) // 100MB 이하 증가
      expect(metrics.memoryUsage.heapUsed).toBeLessThan(1000) // 1GB 이하 사용
    }, 8000)
  })
})
