/**
 * 메트릭 수집 및 모니터링 시스템
 *
 * 이 모듈은 Echo Mail 시스템의 모든 주요 메트릭을 수집하고 분석합니다:
 * 1. 애플리케이션 성능 메트릭
 * 2. 비즈니스 메트릭
 * 3. 시스템 리소스 메트릭
 * 4. 에러 및 로그 메트릭
 * 5. 사용자 경험 메트릭
 */

import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'
import os from 'os'
import { logger } from '@/lib/logger'

// 메트릭 타입 정의
interface Metric {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
  unit?: string
}

interface PerformanceMetric extends Metric {
  duration: number
  success: boolean
  errorCode?: string
}

interface BusinessMetric extends Metric {
  tenantId?: string
  userId?: string
  category: 'email' | 'notification' | 'subscription' | 'usage'
}

interface SystemMetric extends Metric {
  type: 'cpu' | 'memory' | 'disk' | 'network'
  hostname: string
}

interface AlertRule {
  name: string
  condition: (metric: Metric) => boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  threshold: number
  duration: number
  action: (metric: Metric) => void
}

// 메트릭 수집기 클래스
export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map()
  private timers: Map<string, number> = new Map()
  private counters: Map<string, number> = new Map()
  private gauges: Map<string, number> = new Map()
  private histograms: Map<string, number[]> = new Map()
  private alertRules: AlertRule[] = []
  private isCollecting = false

  constructor() {
    super()
    this.setupDefaultAlerts()
  }

  // 메트릭 수집 시작
  startCollection() {
    if (this.isCollecting) return

    this.isCollecting = true
    logger.system.info('메트릭 수집 시작')

    // 시스템 메트릭 수집 (1분마다)
    setInterval(() => {
      this.collectSystemMetrics()
    }, 60000)

    // 메트릭 정리 (10분마다)
    setInterval(() => {
      this.cleanupOldMetrics()
    }, 600000)

    // 알림 규칙 검사 (30초마다)
    setInterval(() => {
      this.evaluateAlerts()
    }, 30000)
  }

  // 메트릭 수집 중지
  stopCollection() {
    this.isCollecting = false
    logger.system.info('메트릭 수집 중지')
  }

  // 카운터 메트릭 증가
  incrementCounter(name: string, value = 1, tags?: Record<string, string>) {
    const current = this.counters.get(name) || 0
    this.counters.set(name, current + value)

    this.recordMetric({
      name,
      value: current + value,
      timestamp: Date.now(),
      tags,
      unit: 'count',
    })
  }

  // 게이지 메트릭 설정
  setGauge(name: string, value: number, tags?: Record<string, string>) {
    this.gauges.set(name, value)

    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
      unit: 'gauge',
    })
  }

  // 히스토그램 메트릭 기록
  recordHistogram(name: string, value: number, tags?: Record<string, string>) {
    const values = this.histograms.get(name) || []
    values.push(value)
    this.histograms.set(name, values)

    // 최근 1000개 값만 유지
    if (values.length > 1000) {
      values.shift()
    }

    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
      unit: 'histogram',
    })
  }

  // 타이머 시작
  startTimer(name: string): string {
    const timerId = `${name}_${Date.now()}_${Math.random()}`
    this.timers.set(timerId, performance.now())
    return timerId
  }

  // 타이머 종료 및 측정
  endTimer(timerId: string, tags?: Record<string, string>): number {
    const startTime = this.timers.get(timerId)
    if (!startTime) {
      logger.system.warn(`타이머를 찾을 수 없음: ${timerId}`)
      return 0
    }

    const duration = performance.now() - startTime
    this.timers.delete(timerId)

    const name = timerId.split('_')[0]
    this.recordHistogram(`${name}_duration`, duration, tags)

    return duration
  }

  // 성능 메트릭 기록
  recordPerformance(
    name: string,
    duration: number,
    success: boolean,
    errorCode?: string,
    tags?: Record<string, string>
  ) {
    const metric: PerformanceMetric = {
      name: `performance_${name}`,
      value: duration,
      duration,
      success,
      errorCode,
      timestamp: Date.now(),
      tags,
      unit: 'ms',
    }

    this.recordMetric(metric)

    // 추가 메트릭
    this.incrementCounter(`${name}_total`, 1, tags)
    if (success) {
      this.incrementCounter(`${name}_success`, 1, tags)
    } else {
      this.incrementCounter(`${name}_error`, 1, { ...tags, error_code: errorCode })
    }
  }

  // 비즈니스 메트릭 기록
  recordBusiness(
    category: BusinessMetric['category'],
    name: string,
    value: number,
    tenantId?: string,
    userId?: string,
    tags?: Record<string, string>
  ) {
    const metric: BusinessMetric = {
      name: `business_${category}_${name}`,
      value,
      category,
      tenantId,
      userId,
      timestamp: Date.now(),
      tags: {
        ...tags,
        tenant_id: tenantId || 'unknown',
        user_id: userId || 'unknown',
      },
      unit: 'count',
    }

    this.recordMetric(metric)
  }

  // 시스템 메트릭 수집
  private collectSystemMetrics() {
    const hostname = os.hostname()

    // CPU 사용률
    const cpus = os.cpus()
    const cpuUsage =
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
        const idle = cpu.times.idle
        return acc + (1 - idle / total) * 100
      }, 0) / cpus.length

    this.recordSystemMetric('cpu', 'usage_percent', cpuUsage, hostname)

    // 메모리 사용률
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const memoryUsagePercent = (usedMemory / totalMemory) * 100

    this.recordSystemMetric('memory', 'total_bytes', totalMemory, hostname)
    this.recordSystemMetric('memory', 'used_bytes', usedMemory, hostname)
    this.recordSystemMetric('memory', 'usage_percent', memoryUsagePercent, hostname)

    // 프로세스 메모리
    const processMemory = process.memoryUsage()
    this.recordSystemMetric('process', 'heap_used_bytes', processMemory.heapUsed, hostname)
    this.recordSystemMetric('process', 'heap_total_bytes', processMemory.heapTotal, hostname)
    this.recordSystemMetric('process', 'external_bytes', processMemory.external, hostname)

    // 로드 평균 (Unix 시스템만)
    try {
      const loadavg = os.loadavg()
      this.recordSystemMetric('system', 'load_1m', loadavg[0], hostname)
      this.recordSystemMetric('system', 'load_5m', loadavg[1], hostname)
      this.recordSystemMetric('system', 'load_15m', loadavg[2], hostname)
    } catch (error) {
      // Windows에서는 지원하지 않음
    }

    // 가동 시간
    this.recordSystemMetric('system', 'uptime_seconds', os.uptime(), hostname)
    this.recordSystemMetric('process', 'uptime_seconds', process.uptime(), hostname)
  }

  // 시스템 메트릭 기록 헬퍼
  private recordSystemMetric(
    type: SystemMetric['type'],
    name: string,
    value: number,
    hostname: string
  ) {
    const metric: SystemMetric = {
      name: `system_${type}_${name}`,
      value,
      type,
      hostname,
      timestamp: Date.now(),
      tags: {
        hostname,
        type,
      },
    }

    this.recordMetric(metric)
  }

  // 메트릭 기록
  private recordMetric(metric: Metric) {
    const metrics = this.metrics.get(metric.name) || []
    metrics.push(metric)
    this.metrics.set(metric.name, metrics)

    // 최근 1시간 데이터만 유지
    const oneHourAgo = Date.now() - 3600000
    const recentMetrics = metrics.filter((m) => m.timestamp > oneHourAgo)
    this.metrics.set(metric.name, recentMetrics)

    // 이벤트 발생
    this.emit('metric', metric)
  }

  // 메트릭 조회
  getMetrics(name?: string, since?: number): Metric[] {
    if (name) {
      const metrics = this.metrics.get(name) || []
      if (since) {
        return metrics.filter((m) => m.timestamp >= since)
      }
      return metrics
    }

    const allMetrics: Metric[] = []
    for (const metrics of this.metrics.values()) {
      if (since) {
        allMetrics.push(...metrics.filter((m) => m.timestamp >= since))
      } else {
        allMetrics.push(...metrics)
      }
    }

    return allMetrics.sort((a, b) => a.timestamp - b.timestamp)
  }

  // 메트릭 통계
  getMetricStats(
    name: string,
    since?: number
  ): {
    count: number
    min: number
    max: number
    avg: number
    sum: number
    latest: number
  } | null {
    const metrics = this.getMetrics(name, since)
    if (metrics.length === 0) return null

    const values = metrics.map((m) => m.value)
    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      sum: values.reduce((a, b) => a + b, 0),
      latest: values[values.length - 1],
    }
  }

  // 알림 규칙 추가
  addAlertRule(rule: AlertRule) {
    this.alertRules.push(rule)
    logger.system.info(`알림 규칙 추가: ${rule.name}`)
  }

  // 기본 알림 규칙 설정
  private setupDefaultAlerts() {
    // CPU 사용률 경고
    this.addAlertRule({
      name: 'high_cpu_usage',
      condition: (metric) => metric.name === 'system_cpu_usage_percent' && metric.value > 80,
      severity: 'high',
      threshold: 80,
      duration: 300000, // 5분
      action: (metric) => {
        logger.system.warn(`높은 CPU 사용률 감지: ${metric.value}%`)
        this.emit('alert', {
          type: 'high_cpu_usage',
          severity: 'high',
          message: `CPU 사용률이 ${metric.value}%입니다`,
          metric,
        })
      },
    })

    // 메모리 사용률 경고
    this.addAlertRule({
      name: 'high_memory_usage',
      condition: (metric) => metric.name === 'system_memory_usage_percent' && metric.value > 85,
      severity: 'high',
      threshold: 85,
      duration: 300000,
      action: (metric) => {
        logger.system.warn(`높은 메모리 사용률 감지: ${metric.value}%`)
        this.emit('alert', {
          type: 'high_memory_usage',
          severity: 'high',
          message: `메모리 사용률이 ${metric.value}%입니다`,
          metric,
        })
      },
    })

    // 에러율 경고
    this.addAlertRule({
      name: 'high_error_rate',
      condition: (metric) => {
        if (!metric.name.endsWith('_error')) return false

        const errorCount = metric.value
        const totalMetricName = metric.name.replace('_error', '_total')
        const totalMetrics = this.getMetrics(totalMetricName, Date.now() - 300000)

        if (totalMetrics.length === 0) return false

        const totalCount = totalMetrics[totalMetrics.length - 1]?.value || 0
        const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0

        return errorRate > 10 // 10% 에러율
      },
      severity: 'critical',
      threshold: 10,
      duration: 180000, // 3분
      action: (metric) => {
        logger.system.error(`높은 에러율 감지: ${metric.name}`)
        this.emit('alert', {
          type: 'high_error_rate',
          severity: 'critical',
          message: `높은 에러율이 감지되었습니다: ${metric.name}`,
          metric,
        })
      },
    })
  }

  // 알림 규칙 평가
  private evaluateAlerts() {
    const recentMetrics = this.getMetrics(undefined, Date.now() - 300000) // 최근 5분

    for (const rule of this.alertRules) {
      const matchingMetrics = recentMetrics.filter(rule.condition)

      if (matchingMetrics.length > 0) {
        const latestMetric = matchingMetrics[matchingMetrics.length - 1]
        rule.action(latestMetric)
      }
    }
  }

  // 오래된 메트릭 정리
  private cleanupOldMetrics() {
    const sixHoursAgo = Date.now() - 21600000 // 6시간 전

    for (const [name, metrics] of this.metrics.entries()) {
      const recentMetrics = metrics.filter((m) => m.timestamp > sixHoursAgo)
      this.metrics.set(name, recentMetrics)
    }

    logger.system.debug('오래된 메트릭 정리 완료')
  }

  // 메트릭 요약 정보
  getSummary() {
    const metricCount = Array.from(this.metrics.values()).reduce(
      (sum, metrics) => sum + metrics.length,
      0
    )

    return {
      totalMetrics: metricCount,
      metricTypes: this.metrics.size,
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
      activeTimers: this.timers.size,
      alertRules: this.alertRules.length,
      isCollecting: this.isCollecting,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    }
  }
}

// 싱글톤 인스턴스
export const metricsCollector = new MetricsCollector()

// 편의 함수들
export const incrementCounter = (name: string, value?: number, tags?: Record<string, string>) =>
  metricsCollector.incrementCounter(name, value, tags)

export const setGauge = (name: string, value: number, tags?: Record<string, string>) =>
  metricsCollector.setGauge(name, value, tags)

export const recordHistogram = (name: string, value: number, tags?: Record<string, string>) =>
  metricsCollector.recordHistogram(name, value, tags)

export const startTimer = (name: string) => metricsCollector.startTimer(name)

export const endTimer = (timerId: string, tags?: Record<string, string>) =>
  metricsCollector.endTimer(timerId, tags)

export const recordPerformance = (
  name: string,
  duration: number,
  success: boolean,
  errorCode?: string,
  tags?: Record<string, string>
) => metricsCollector.recordPerformance(name, duration, success, errorCode, tags)

export const recordBusiness = (
  category: BusinessMetric['category'],
  name: string,
  value: number,
  tenantId?: string,
  userId?: string,
  tags?: Record<string, string>
) => metricsCollector.recordBusiness(category, name, value, tenantId, userId, tags)
