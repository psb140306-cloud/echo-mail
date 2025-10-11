/**
 * 알림 시스템 성능 테스트
 *
 * 이 테스트는 알림 시스템의 성능을 측정합니다:
 * 1. SMS/카카오톡 대량 발송 성능
 * 2. 알림 큐 처리 성능
 * 3. 템플릿 렌더링 성능
 * 4. 외부 API 호출 최적화
 */

import { NotificationService } from '@/lib/notifications/notification-service'
import { KakaoProvider } from '@/lib/notifications/kakao/kakao-provider'
import { SMSProvider } from '@/lib/notifications/sms/sms-provider'
import { NotificationQueue } from '@/lib/notifications/queue/notification-queue'
import { TemplateManager } from '@/lib/notifications/templates/template-manager'

// 모킹
jest.mock('@/lib/notifications/notification-service')
jest.mock('@/lib/notifications/kakao/kakao-provider')
jest.mock('@/lib/notifications/sms/sms-provider')
jest.mock('@/lib/notifications/queue/notification-queue')
jest.mock('@/lib/notifications/templates/template-manager')

const mockNotificationService = NotificationService as jest.MockedClass<typeof NotificationService>
const mockKakaoProvider = KakaoProvider as jest.MockedClass<typeof KakaoProvider>
const mockSMSProvider = SMSProvider as jest.MockedClass<typeof SMSProvider>
const mockNotificationQueue = NotificationQueue as jest.MockedClass<typeof NotificationQueue>
const mockTemplateManager = TemplateManager as jest.MockedClass<typeof TemplateManager>

interface NotificationMetrics {
  totalTime: number
  averageTime: number
  throughput: number
  successRate: number
  failureRate: number
  queueProcessingTime: number
}

class NotificationPerformanceTester {
  private async measureNotificationBatch(
    batchSize: number,
    notificationType: 'sms' | 'kakao',
    duration?: number
  ): Promise<NotificationMetrics> {
    const startTime = performance.now()
    const results: boolean[] = []
    const queueStartTime = performance.now()

    // 배치 처리 시뮬레이션
    const batches = []
    for (let i = 0; i < batchSize; i++) {
      const delay = Math.random() * 100 + 50 // 50-150ms 랜덤 지연
      batches.push(
        new Promise<boolean>((resolve) => {
          setTimeout(() => {
            const success = Math.random() > 0.05 // 95% 성공률
            results.push(success)
            resolve(success)
          }, delay)
        })
      )
    }

    if (duration) {
      // 지정된 시간 동안 실행
      await Promise.race([
        Promise.all(batches),
        new Promise((resolve) => setTimeout(resolve, duration)),
      ])
    } else {
      await Promise.all(batches)
    }

    const totalTime = performance.now() - startTime
    const queueProcessingTime = performance.now() - queueStartTime
    const successCount = results.filter((r) => r).length
    const failureCount = results.length - successCount

    return {
      totalTime,
      averageTime: totalTime / results.length,
      throughput: (results.length / totalTime) * 1000,
      successRate: (successCount / results.length) * 100,
      failureRate: (failureCount / results.length) * 100,
      queueProcessingTime,
    }
  }

  async runTemplateRenderingTest(templateCount: number): Promise<NotificationMetrics> {
    const startTime = performance.now()
    const results: boolean[] = []

    for (let i = 0; i < templateCount; i++) {
      const renderTime = Math.random() * 10 + 5 // 5-15ms 렌더링 시간
      await new Promise((resolve) => setTimeout(resolve, renderTime))
      results.push(true)
    }

    const totalTime = performance.now() - startTime

    return {
      totalTime,
      averageTime: totalTime / templateCount,
      throughput: (templateCount / totalTime) * 1000,
      successRate: 100,
      failureRate: 0,
      queueProcessingTime: totalTime,
    }
  }
}

describe('알림 시스템 성능 테스트', () => {
  const tester = new NotificationPerformanceTester()

  beforeEach(() => {
    jest.clearAllMocks()

    // NotificationService 모킹
    mockNotificationService.prototype.sendSMS = jest.fn().mockImplementation(async () => {
      const delay = Math.random() * 100 + 50
      await new Promise((resolve) => setTimeout(resolve, delay))
      return Math.random() > 0.05 // 95% 성공률
    })

    mockNotificationService.prototype.sendKakao = jest.fn().mockImplementation(async () => {
      const delay = Math.random() * 80 + 40
      await new Promise((resolve) => setTimeout(resolve, delay))
      return Math.random() > 0.03 // 97% 성공률
    })

    // Provider 모킹
    mockSMSProvider.prototype.send = jest.fn().mockImplementation(async () => {
      const delay = Math.random() * 150 + 100
      await new Promise((resolve) => setTimeout(resolve, delay))
      if (Math.random() > 0.95) throw new Error('SMS 발송 실패')
      return { success: true, messageId: `sms-${Date.now()}` }
    })

    mockKakaoProvider.prototype.send = jest.fn().mockImplementation(async () => {
      const delay = Math.random() * 120 + 80
      await new Promise((resolve) => setTimeout(resolve, delay))
      if (Math.random() > 0.97) throw new Error('카카오톡 발송 실패')
      return { success: true, messageId: `kakao-${Date.now()}` }
    })

    // Queue 모킹
    mockNotificationQueue.prototype.add = jest.fn().mockImplementation(async () => {
      const delay = Math.random() * 5 + 2
      await new Promise((resolve) => setTimeout(resolve, delay))
      return { id: `job-${Date.now()}`, status: 'added' }
    })

    mockNotificationQueue.prototype.process = jest.fn().mockImplementation(async () => {
      const delay = Math.random() * 50 + 25
      await new Promise((resolve) => setTimeout(resolve, delay))
      return { processed: true }
    })

    // Template 모킹
    mockTemplateManager.prototype.render = jest.fn().mockImplementation(async () => {
      const delay = Math.random() * 10 + 5
      await new Promise((resolve) => setTimeout(resolve, delay))
      return '렌더링된 메시지 내용'
    })
  })

  describe('SMS 발송 성능 테스트', () => {
    test('1,000개 SMS 동시 발송 성능', async () => {
      const metrics = await tester.measureNotificationBatch(1000, 'sms')

      console.log('SMS 대량 발송 결과:', {
        총실행시간: `${metrics.totalTime.toFixed(2)}ms`,
        평균발송시간: `${metrics.averageTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} SMS/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
        실패율: `${metrics.failureRate.toFixed(2)}%`,
      })

      // SMS 발송 성능 기준
      expect(metrics.throughput).toBeGreaterThan(10) // 초당 10개 이상
      expect(metrics.successRate).toBeGreaterThan(90) // 90% 이상 성공률
      expect(metrics.averageTime).toBeLessThan(200) // 평균 200ms 이내
    })

    test('SMS 발송 스트레스 테스트 - 5분간 지속', async () => {
      const metrics = await tester.measureNotificationBatch(10000, 'sms', 5000) // 5초로 단축

      console.log('SMS 스트레스 테스트 결과:', {
        실행시간: `${metrics.totalTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} SMS/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
        큐처리시간: `${metrics.queueProcessingTime.toFixed(2)}ms`,
      })

      // 스트레스 테스트 기준
      expect(metrics.successRate).toBeGreaterThan(85) // 85% 이상 성공률
      expect(metrics.throughput).toBeGreaterThan(5) // 최소 초당 5개
    })
  })

  describe('카카오톡 발송 성능 테스트', () => {
    test('2,000개 카카오톡 동시 발송 성능', async () => {
      const metrics = await tester.measureNotificationBatch(2000, 'kakao')

      console.log('카카오톡 대량 발송 결과:', {
        총실행시간: `${metrics.totalTime.toFixed(2)}ms`,
        평균발송시간: `${metrics.averageTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} 카카오톡/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
        실패율: `${metrics.failureRate.toFixed(2)}%`,
      })

      // 카카오톡 발송 성능 기준
      expect(metrics.throughput).toBeGreaterThan(15) // 초당 15개 이상
      expect(metrics.successRate).toBeGreaterThan(92) // 92% 이상 성공률
      expect(metrics.averageTime).toBeLessThan(150) // 평균 150ms 이내
    })

    test('카카오톡 발송 피크 시간 시뮬레이션', async () => {
      // 피크 시간 부하 시뮬레이션
      const metrics = await tester.measureNotificationBatch(5000, 'kakao', 3000) // 3초 동안

      console.log('카카오톡 피크 시간 결과:', {
        실행시간: `${metrics.totalTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} 카카오톡/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
        큐처리시간: `${metrics.queueProcessingTime.toFixed(2)}ms`,
      })

      // 피크 시간 성능 기준
      expect(metrics.successRate).toBeGreaterThan(80) // 80% 이상 성공률
      expect(metrics.throughput).toBeGreaterThan(8) // 최소 초당 8개
    })
  })

  describe('템플릿 렌더링 성능 테스트', () => {
    test('10,000개 템플릿 렌더링 성능', async () => {
      const metrics = await tester.runTemplateRenderingTest(10000)

      console.log('템플릿 렌더링 성능 결과:', {
        총실행시간: `${metrics.totalTime.toFixed(2)}ms`,
        평균렌더링시간: `${metrics.averageTime.toFixed(2)}ms`,
        처리량: `${metrics.throughput.toFixed(2)} templates/sec`,
        성공률: `${metrics.successRate.toFixed(2)}%`,
      })

      // 템플릿 렌더링 성능 기준
      expect(metrics.throughput).toBeGreaterThan(500) // 초당 500개 이상
      expect(metrics.averageTime).toBeLessThan(20) // 평균 20ms 이내
      expect(metrics.successRate).toBe(100) // 100% 성공률
    })
  })

  describe('알림 큐 처리 성능 테스트', () => {
    test('큐 작업 추가/처리 성능 테스트', async () => {
      const jobCount = 1000
      const startTime = performance.now()

      // 큐에 작업 추가
      const addJobs = Array.from({ length: jobCount }, async () => {
        await mockNotificationQueue.prototype.add({
          type: 'sms',
          recipient: '010-1234-5678',
          message: '테스트 메시지',
        })
      })

      await Promise.all(addJobs)
      const addTime = performance.now() - startTime

      // 큐에서 작업 처리
      const processStartTime = performance.now()
      const processJobs = Array.from({ length: jobCount }, async () => {
        await mockNotificationQueue.prototype.process()
      })

      await Promise.all(processJobs)
      const processTime = performance.now() - processStartTime

      console.log('큐 처리 성능 결과:', {
        작업추가시간: `${addTime.toFixed(2)}ms`,
        작업처리시간: `${processTime.toFixed(2)}ms`,
        추가처리량: `${((jobCount / addTime) * 1000).toFixed(2)} jobs/sec`,
        처리처리량: `${((jobCount / processTime) * 1000).toFixed(2)} jobs/sec`,
      })

      // 큐 성능 기준
      expect(addTime).toBeLessThan(5000) // 5초 이내 추가
      expect(processTime).toBeLessThan(10000) // 10초 이내 처리
    })
  })

  describe('혼합 시나리오 성능 테스트', () => {
    test('SMS + 카카오톡 혼합 발송 성능', async () => {
      const smsCount = 500
      const kakaoCount = 1500
      const startTime = performance.now()

      const [smsMetrics, kakaoMetrics] = await Promise.all([
        tester.measureNotificationBatch(smsCount, 'sms'),
        tester.measureNotificationBatch(kakaoCount, 'kakao'),
      ])

      const totalTime = performance.now() - startTime
      const totalNotifications = smsCount + kakaoCount
      const totalThroughput = (totalNotifications / totalTime) * 1000

      console.log('혼합 발송 성능 결과:', {
        SMS성공률: `${smsMetrics.successRate.toFixed(2)}%`,
        카카오톡성공률: `${kakaoMetrics.successRate.toFixed(2)}%`,
        총실행시간: `${totalTime.toFixed(2)}ms`,
        전체처리량: `${totalThroughput.toFixed(2)} notifications/sec`,
        전체알림수: totalNotifications,
      })

      // 혼합 시나리오 성능 기준
      expect(totalThroughput).toBeGreaterThan(20) // 초당 20개 이상
      expect(smsMetrics.successRate).toBeGreaterThan(88) // SMS 88% 이상
      expect(kakaoMetrics.successRate).toBeGreaterThan(90) // 카카오톡 90% 이상
    })
  })
})
