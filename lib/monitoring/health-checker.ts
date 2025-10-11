/**
 * 시스템 헬스 체커
 *
 * 이 모듈은 Echo Mail 시스템의 모든 컴포넌트 상태를 모니터링합니다:
 * 1. 데이터베이스 연결 상태
 * 2. Redis 연결 상태
 * 3. 외부 API 상태 (IMAP, SMS, Kakao)
 * 4. 파일 시스템 상태
 * 5. 메모리 및 CPU 상태
 */

import { EventEmitter } from 'events'
import { prisma } from '@/lib/db'
import Redis from 'ioredis'
import { logger } from '@/lib/logger'
import { metricsCollector } from './metrics-collector'
import fs from 'fs/promises'
import { ImapFlow } from 'imapflow'

// 헬스 체크 결과 타입
export interface HealthCheckResult {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  timestamp: number
  message?: string
  error?: string
  metadata?: Record<string, any>
}

// 전체 시스템 헬스 상태
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: number
  components: HealthCheckResult[]
  summary: {
    healthy: number
    degraded: number
    unhealthy: number
    total: number
  }
}

// 헬스 체커 설정
interface HealthCheckerConfig {
  interval: number // 체크 간격 (ms)
  timeout: number // 타임아웃 (ms)
  retries: number // 재시도 횟수
  enabled: boolean
}

// 개별 헬스 체크 함수 타입
type HealthCheckFunction = () => Promise<HealthCheckResult>

export class HealthChecker extends EventEmitter {
  private config: HealthCheckerConfig
  private checks: Map<string, HealthCheckFunction> = new Map()
  private results: Map<string, HealthCheckResult> = new Map()
  private isRunning = false
  private intervalId?: NodeJS.Timeout

  constructor(config: Partial<HealthCheckerConfig> = {}) {
    super()

    this.config = {
      interval: 30000, // 30초
      timeout: 10000, // 10초
      retries: 3,
      enabled: true,
      ...config,
    }

    this.setupDefaultChecks()
  }

  // 기본 헬스 체크 설정
  private setupDefaultChecks() {
    // 데이터베이스 연결 체크
    this.addCheck('database', this.checkDatabase.bind(this))

    // Redis 연결 체크
    this.addCheck('redis', this.checkRedis.bind(this))

    // 파일 시스템 체크
    this.addCheck('filesystem', this.checkFileSystem.bind(this))

    // 메모리 사용량 체크
    this.addCheck('memory', this.checkMemory.bind(this))

    // CPU 사용량 체크
    this.addCheck('cpu', this.checkCPU.bind(this))

    // 디스크 공간 체크
    this.addCheck('disk', this.checkDisk.bind(this))

    // IMAP 서버 연결 체크
    this.addCheck('imap', this.checkIMAP.bind(this))

    // 외부 API 체크
    this.addCheck('sms_api', this.checkSMSAPI.bind(this))
    this.addCheck('kakao_api', this.checkKakaoAPI.bind(this))
    this.addCheck('toss_api', this.checkTossAPI.bind(this))
  }

  // 헬스 체크 추가
  addCheck(name: string, checkFunction: HealthCheckFunction) {
    this.checks.set(name, checkFunction)
    logger.system.debug(`헬스 체크 추가: ${name}`)
  }

  // 헬스 체크 제거
  removeCheck(name: string) {
    this.checks.delete(name)
    this.results.delete(name)
    logger.system.debug(`헬스 체크 제거: ${name}`)
  }

  // 모니터링 시작
  start() {
    if (this.isRunning || !this.config.enabled) return

    this.isRunning = true
    logger.system.info('헬스 체크 시작')

    // 즉시 한 번 실행
    this.runAllChecks()

    // 정기적으로 실행
    this.intervalId = setInterval(() => {
      this.runAllChecks()
    }, this.config.interval)
  }

  // 모니터링 중지
  stop() {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    logger.system.info('헬스 체크 중지')
  }

  // 모든 헬스 체크 실행
  private async runAllChecks() {
    const promises = Array.from(this.checks.entries()).map(([name, checkFunction]) =>
      this.runSingleCheck(name, checkFunction)
    )

    await Promise.allSettled(promises)

    // 전체 시스템 상태 평가
    const systemHealth = this.getSystemHealth()
    this.emit('health', systemHealth)

    // 메트릭 기록
    this.recordHealthMetrics(systemHealth)
  }

  // 단일 헬스 체크 실행
  private async runSingleCheck(name: string, checkFunction: HealthCheckFunction): Promise<void> {
    let result: HealthCheckResult

    try {
      // 타임아웃과 함께 체크 실행
      result = await Promise.race([checkFunction(), this.createTimeoutPromise(name)])
    } catch (error) {
      result = {
        name,
        status: 'unhealthy',
        responseTime: this.config.timeout,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      }
    }

    this.results.set(name, result)
    this.emit('checkResult', result)

    // 상태 변화 시 로그 기록
    this.logStatusChange(name, result)
  }

  // 타임아웃 프로미스 생성
  private createTimeoutPromise(name: string): Promise<HealthCheckResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`헬스 체크 타임아웃: ${name}`))
      }, this.config.timeout)
    })
  }

  // 데이터베이스 연결 체크
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      // 간단한 쿼리 실행
      await prisma.$queryRaw`SELECT 1`

      const responseTime = Date.now() - startTime
      return {
        name: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        timestamp: Date.now(),
        message: 'Database connection successful',
      }
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Redis 연결 체크
  private async checkRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      // Redis 클라이언트 생성 (기존 연결 재사용)
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

      // PING 명령 실행
      const result = await redis.ping()
      await redis.disconnect()

      const responseTime = Date.now() - startTime
      return {
        name: 'redis',
        status: result === 'PONG' && responseTime < 500 ? 'healthy' : 'degraded',
        responseTime,
        timestamp: Date.now(),
        message: 'Redis connection successful',
      }
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // 파일 시스템 체크
  private async checkFileSystem(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      const testDir = './logs'
      const testFile = `${testDir}/health-check-${Date.now()}.tmp`

      // 디렉토리 존재 확인 및 생성
      try {
        await fs.access(testDir)
      } catch {
        await fs.mkdir(testDir, { recursive: true })
      }

      // 파일 쓰기 테스트
      await fs.writeFile(testFile, 'health-check')

      // 파일 읽기 테스트
      const content = await fs.readFile(testFile, 'utf-8')

      // 임시 파일 삭제
      await fs.unlink(testFile)

      const responseTime = Date.now() - startTime
      return {
        name: 'filesystem',
        status: content === 'health-check' ? 'healthy' : 'degraded',
        responseTime,
        timestamp: Date.now(),
        message: 'File system read/write successful',
      }
    } catch (error) {
      return {
        name: 'filesystem',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // 메모리 사용량 체크
  private async checkMemory(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      const memoryUsage = process.memoryUsage()
      const usedMemoryMB = memoryUsage.heapUsed / 1024 / 1024
      const totalMemoryMB = memoryUsage.heapTotal / 1024 / 1024
      const usagePercent = (usedMemoryMB / totalMemoryMB) * 100

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      let message = `Memory usage: ${usedMemoryMB.toFixed(2)}MB (${usagePercent.toFixed(1)}%)`

      if (usagePercent > 90) {
        status = 'unhealthy'
        message += ' - Critical memory usage'
      } else if (usagePercent > 80) {
        status = 'degraded'
        message += ' - High memory usage'
      }

      return {
        name: 'memory',
        status,
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        message,
        metadata: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers,
          usagePercent,
        },
      }
    } catch (error) {
      return {
        name: 'memory',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // CPU 사용량 체크
  private async checkCPU(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      // CPU 사용률 측정 (간단한 방법)
      const startCPU = process.cpuUsage()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const endCPU = process.cpuUsage(startCPU)

      const cpuPercent = ((endCPU.user + endCPU.system) / 1000 / 100) * 100

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      let message = `CPU usage: ${cpuPercent.toFixed(1)}%`

      if (cpuPercent > 90) {
        status = 'unhealthy'
        message += ' - Critical CPU usage'
      } else if (cpuPercent > 80) {
        status = 'degraded'
        message += ' - High CPU usage'
      }

      return {
        name: 'cpu',
        status,
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        message,
        metadata: {
          user: endCPU.user,
          system: endCPU.system,
          percent: cpuPercent,
        },
      }
    } catch (error) {
      return {
        name: 'cpu',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // 디스크 공간 체크
  private async checkDisk(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      const stats = await fs.stat('.')
      // 디스크 공간 정보는 Node.js에서 직접 제공하지 않으므로
      // 여기서는 간단한 파일 시스템 접근성만 체크
      return {
        name: 'disk',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        message: 'Disk access successful',
      }
    } catch (error) {
      return {
        name: 'disk',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // IMAP 서버 연결 체크
  private async checkIMAP(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
      return {
        name: 'imap',
        status: 'degraded',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        message: 'IMAP configuration not provided',
      }
    }

    try {
      const client = new ImapFlow({
        host: process.env.IMAP_HOST,
        port: parseInt(process.env.IMAP_PORT || '993'),
        secure: true,
        auth: {
          user: process.env.IMAP_USER,
          pass: process.env.IMAP_PASSWORD,
        },
      })

      await client.connect()
      await client.logout()

      return {
        name: 'imap',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        message: 'IMAP connection successful',
      }
    } catch (error) {
      return {
        name: 'imap',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // SMS API 체크
  private async checkSMSAPI(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    if (!process.env.SMS_API_KEY) {
      return {
        name: 'sms_api',
        status: 'degraded',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        message: 'SMS API key not configured',
      }
    }

    try {
      // SMS API 상태 확인 (실제 API 엔드포인트에 따라 수정 필요)
      const response = await fetch('https://api.sms-provider.com/health', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.SMS_API_KEY}`,
        },
      })

      return {
        name: 'sms_api',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        message: `SMS API status: ${response.status}`,
      }
    } catch (error) {
      return {
        name: 'sms_api',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Kakao API 체크
  private async checkKakaoAPI(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    if (!process.env.KAKAO_API_KEY) {
      return {
        name: 'kakao_api',
        status: 'degraded',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        message: 'Kakao API key not configured',
      }
    }

    try {
      // Kakao API 상태 확인
      const response = await fetch('https://kapi.kakao.com/v1/api/talk/profile', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.KAKAO_API_KEY}`,
        },
      })

      return {
        name: 'kakao_api',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        message: `Kakao API status: ${response.status}`,
      }
    } catch (error) {
      return {
        name: 'kakao_api',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Toss API 체크
  private async checkTossAPI(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    if (!process.env.TOSS_SECRET_KEY) {
      return {
        name: 'toss_api',
        status: 'degraded',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        message: 'Toss API key not configured',
      }
    }

    try {
      // Toss API 상태 확인 (실제 API 엔드포인트에 따라 수정 필요)
      const response = await fetch('https://api.tosspayments.com/v1/status', {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
        },
      })

      return {
        name: 'toss_api',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        message: `Toss API status: ${response.status}`,
      }
    } catch (error) {
      return {
        name: 'toss_api',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // 시스템 전체 헬스 상태 계산
  getSystemHealth(): SystemHealth {
    const results = Array.from(this.results.values())
    const healthy = results.filter((r) => r.status === 'healthy').length
    const degraded = results.filter((r) => r.status === 'degraded').length
    const unhealthy = results.filter((r) => r.status === 'unhealthy').length

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (unhealthy > 0) {
      overallStatus = 'unhealthy'
    } else if (degraded > 0) {
      overallStatus = 'degraded'
    }

    return {
      status: overallStatus,
      timestamp: Date.now(),
      components: results.sort((a, b) => a.name.localeCompare(b.name)),
      summary: {
        healthy,
        degraded,
        unhealthy,
        total: results.length,
      },
    }
  }

  // 특정 컴포넌트 상태 조회
  getComponentHealth(name: string): HealthCheckResult | undefined {
    return this.results.get(name)
  }

  // 상태 변화 로깅
  private logStatusChange(name: string, current: HealthCheckResult) {
    const previous = this.results.get(name)

    if (!previous || previous.status !== current.status) {
      const level =
        current.status === 'healthy' ? 'info' : current.status === 'degraded' ? 'warn' : 'error'

      logger.system[level](
        `헬스 체크 상태 변화: ${name} ${previous?.status || 'unknown'} → ${current.status}`,
        {
          component: name,
          previousStatus: previous?.status,
          currentStatus: current.status,
          responseTime: current.responseTime,
          error: current.error,
          message: current.message,
        }
      )
    }
  }

  // 헬스 메트릭 기록
  private recordHealthMetrics(systemHealth: SystemHealth) {
    // 전체 시스템 상태
    metricsCollector.setGauge('health_system_status', systemHealth.status === 'healthy' ? 1 : 0)

    // 컴포넌트별 상태
    systemHealth.components.forEach((component) => {
      const statusValue =
        component.status === 'healthy' ? 1 : component.status === 'degraded' ? 0.5 : 0

      metricsCollector.setGauge(`health_component_${component.name}`, statusValue, {
        component: component.name,
        status: component.status,
      })

      metricsCollector.recordHistogram(
        `health_response_time_${component.name}`,
        component.responseTime,
        {
          component: component.name,
        }
      )
    })

    // 요약 메트릭
    metricsCollector.setGauge('health_components_healthy', systemHealth.summary.healthy)
    metricsCollector.setGauge('health_components_degraded', systemHealth.summary.degraded)
    metricsCollector.setGauge('health_components_unhealthy', systemHealth.summary.unhealthy)
  }
}

// 싱글톤 인스턴스
export const healthChecker = new HealthChecker()

// 편의 함수
export const getSystemHealth = () => healthChecker.getSystemHealth()
export const getComponentHealth = (name: string) => healthChecker.getComponentHealth(name)
