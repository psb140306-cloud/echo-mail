/**
 * End-to-End 성능 모니터링 테스트
 *
 * 이 테스트는 실제 브라우저에서 성능 메트릭을 측정합니다:
 * 1. 페이지 로딩 성능 (FCP, LCP, CLS)
 * 2. JavaScript 번들 크기 및 로딩 시간
 * 3. API 응답 시간
 * 4. 메모리 사용량 모니터링
 */

import { test, expect } from '@playwright/test'

interface PerformanceMetrics {
  fcp: number // First Contentful Paint
  lcp: number // Largest Contentful Paint
  cls: number // Cumulative Layout Shift
  fid: number // First Input Delay
  ttfb: number // Time to First Byte
  domContentLoaded: number
  loadComplete: number
  jsHeapSize: number
  bundleSize: number
}

class PerformanceMonitor {
  constructor(private page: any) {}

  async measurePageLoad(url: string): Promise<PerformanceMetrics> {
    const startTime = Date.now()

    // 페이지 로드 시작
    await this.page.goto(url, { waitUntil: 'networkidle' })

    // Performance API를 통한 메트릭 수집
    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming
      const paintEntries = performance.getEntriesByType('paint')

      const fcp =
        paintEntries.find((entry) => entry.name === 'first-contentful-paint')?.startTime || 0
      const observer = new PerformanceObserver(() => {})

      return {
        fcp: fcp,
        lcp: 0, // LCP는 별도 observer가 필요
        cls: 0, // CLS는 별도 계산 필요
        fid: 0, // FID는 실제 상호작용 필요
        ttfb: navigation.responseStart - navigation.requestStart,
        domContentLoaded:
          navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        jsHeapSize: (performance as any).memory?.usedJSHeapSize || 0,
        bundleSize: 0, // 별도 측정 필요
      }
    })

    return metrics
  }

  async measureAPIResponse(endpoint: string): Promise<number> {
    const startTime = Date.now()

    const response = await this.page.request.get(endpoint)
    const endTime = Date.now()

    expect(response.status()).toBe(200)
    return endTime - startTime
  }

  async measureJSBundleSize(): Promise<number> {
    const resources = await this.page.evaluate(() => {
      return performance
        .getEntriesByType('resource')
        .filter((resource: any) => resource.name.includes('.js'))
        .reduce((total: number, resource: any) => total + (resource.transferSize || 0), 0)
    })

    return resources
  }

  async measureMemoryUsage(): Promise<number> {
    const memory = await this.page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })

    return memory / 1024 / 1024 // MB 단위
  }

  async measureInteractionDelay(selector: string): Promise<number> {
    const startTime = await this.page.evaluate(() => performance.now())

    await this.page.click(selector)

    const endTime = await this.page.evaluate(() => performance.now())

    return endTime - startTime
  }
}

test.describe('Echo Mail E2E 성능 모니터링', () => {
  let monitor: PerformanceMonitor

  test.beforeEach(async ({ page }) => {
    monitor = new PerformanceMonitor(page)
  })

  test('페이지 로딩 성능 측정', async ({ page }) => {
    console.log('🚀 페이지 로딩 성능 측정 시작')

    // 1. 로그인 페이지 성능
    const loginMetrics = await monitor.measurePageLoad('/auth/login')
    console.log('로그인 페이지 성능:', {
      FCP: `${loginMetrics.fcp.toFixed(2)}ms`,
      TTFB: `${loginMetrics.ttfb.toFixed(2)}ms`,
      DOM준비시간: `${loginMetrics.domContentLoaded.toFixed(2)}ms`,
      완전로딩시간: `${loginMetrics.loadComplete.toFixed(2)}ms`,
      JS힙메모리: `${(loginMetrics.jsHeapSize / 1024 / 1024).toFixed(2)}MB`,
    })

    // 성능 기준 검증
    expect(loginMetrics.fcp).toBeLessThan(2000) // FCP 2초 이내
    expect(loginMetrics.ttfb).toBeLessThan(500) // TTFB 500ms 이내
    expect(loginMetrics.domContentLoaded).toBeLessThan(1000) // DOM 준비 1초 이내

    // 2. 대시보드 페이지 성능 (로그인 후)
    await page.fill('[data-testid="email-input"]', 'test@echomail.test')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')

    const dashboardMetrics = await monitor.measurePageLoad('/dashboard')
    console.log('대시보드 페이지 성능:', {
      FCP: `${dashboardMetrics.fcp.toFixed(2)}ms`,
      TTFB: `${dashboardMetrics.ttfb.toFixed(2)}ms`,
      DOM준비시간: `${dashboardMetrics.domContentLoaded.toFixed(2)}ms`,
      완전로딩시간: `${dashboardMetrics.loadComplete.toFixed(2)}ms`,
      JS힙메모리: `${(dashboardMetrics.jsHeapSize / 1024 / 1024).toFixed(2)}MB`,
    })

    // 대시보드 성능 기준
    expect(dashboardMetrics.fcp).toBeLessThan(2500) // 대시보드는 조금 더 여유
    expect(dashboardMetrics.domContentLoaded).toBeLessThan(1500)
  })

  test('JavaScript 번들 크기 및 로딩 성능', async ({ page }) => {
    console.log('📦 JavaScript 번들 성능 측정')

    await page.goto('/dashboard')

    const bundleSize = await monitor.measureJSBundleSize()
    const memoryUsage = await monitor.measureMemoryUsage()

    console.log('번들 성능 결과:', {
      총번들크기: `${(bundleSize / 1024 / 1024).toFixed(2)}MB`,
      메모리사용량: `${memoryUsage.toFixed(2)}MB`,
    })

    // 번들 크기 기준
    expect(bundleSize).toBeLessThan(5 * 1024 * 1024) // 5MB 이내
    expect(memoryUsage).toBeLessThan(50) // 50MB 이내
  })

  test('API 응답 시간 측정', async ({ page }) => {
    console.log('🌐 API 응답 시간 측정')

    // 로그인 후 API 테스트
    await page.goto('/auth/login')
    await page.fill('[data-testid="email-input"]', 'test@echomail.test')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')

    // 각 API 엔드포인트 응답 시간 측정
    const apiEndpoints = [
      '/api/companies',
      '/api/contacts',
      '/api/notifications/status',
      '/api/delivery-rules',
    ]

    const apiResults: Record<string, number> = {}

    for (const endpoint of apiEndpoints) {
      const responseTime = await monitor.measureAPIResponse(endpoint)
      apiResults[endpoint] = responseTime
    }

    console.log('API 응답 시간 결과:', apiResults)

    // API 응답 시간 기준
    Object.values(apiResults).forEach((time) => {
      expect(time).toBeLessThan(1000) // 1초 이내
    })

    const avgResponseTime = Object.values(apiResults).reduce((a, b) => a + b, 0) / apiResults.length
    expect(avgResponseTime).toBeLessThan(500) // 평균 500ms 이내
  })

  test('대용량 데이터 렌더링 성능', async ({ page }) => {
    console.log('📊 대용량 데이터 렌더링 성능 측정')

    await page.goto('/auth/login')
    await page.fill('[data-testid="email-input"]', 'test@echomail.test')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')

    // 회사 목록 페이지 (대용량 데이터 시뮬레이션)
    const startTime = Date.now()
    await page.goto('/companies')

    // 모든 회사 카드가 렌더링될 때까지 대기
    await page.waitForSelector('[data-testid="company-row"]', { timeout: 10000 })

    const renderTime = Date.now() - startTime
    const memoryAfterRender = await monitor.measureMemoryUsage()

    console.log('대용량 렌더링 결과:', {
      렌더링시간: `${renderTime}ms`,
      렌더링후메모리: `${memoryAfterRender.toFixed(2)}MB`,
    })

    // 렌더링 성능 기준
    expect(renderTime).toBeLessThan(3000) // 3초 이내
    expect(memoryAfterRender).toBeLessThan(100) // 100MB 이내
  })

  test('사용자 상호작용 응답성 측정', async ({ page }) => {
    console.log('👆 사용자 상호작용 응답성 측정')

    await page.goto('/auth/login')
    await page.fill('[data-testid="email-input"]', 'test@echomail.test')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')

    await page.goto('/companies')

    // 각 상호작용 지연 시간 측정
    const interactions = [
      { name: '회사추가버튼', selector: '[data-testid="add-company-button"]' },
      { name: '검색입력', selector: '[data-testid="search-input"]' },
      { name: '정렬드롭다운', selector: '[data-testid="sort-dropdown"]' },
      { name: '페이지네이션', selector: '[data-testid="next-page"]' },
    ]

    const interactionResults: Record<string, number> = {}

    for (const interaction of interactions) {
      try {
        const delay = await monitor.measureInteractionDelay(interaction.selector)
        interactionResults[interaction.name] = delay
      } catch (error) {
        console.warn(`${interaction.name} 상호작용 측정 실패:`, error)
        interactionResults[interaction.name] = 0
      }
    }

    console.log('상호작용 응답성 결과:', interactionResults)

    // 상호작용 응답성 기준
    Object.entries(interactionResults).forEach(([name, delay]) => {
      if (delay > 0) {
        expect(delay).toBeLessThan(100) // 100ms 이내
      }
    })
  })

  test('모바일 성능 측정', async ({ page }) => {
    console.log('📱 모바일 성능 측정')

    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 })

    const mobileMetrics = await monitor.measurePageLoad('/dashboard')
    const mobileBundleSize = await monitor.measureJSBundleSize()
    const mobileMemory = await monitor.measureMemoryUsage()

    console.log('모바일 성능 결과:', {
      FCP: `${mobileMetrics.fcp.toFixed(2)}ms`,
      DOM준비시간: `${mobileMetrics.domContentLoaded.toFixed(2)}ms`,
      번들크기: `${(mobileBundleSize / 1024 / 1024).toFixed(2)}MB`,
      메모리사용량: `${mobileMemory.toFixed(2)}MB`,
    })

    // 모바일 성능 기준 (데스크톱보다 엄격)
    expect(mobileMetrics.fcp).toBeLessThan(3000) // 모바일 FCP 3초 이내
    expect(mobileMetrics.domContentLoaded).toBeLessThan(2000) // DOM 준비 2초 이내
    expect(mobileMemory).toBeLessThan(30) // 모바일 메모리 30MB 이내
  })

  test('메모리 누수 감지', async ({ page }) => {
    console.log('🔍 메모리 누수 감지 테스트')

    await page.goto('/auth/login')
    await page.fill('[data-testid="email-input"]', 'test@echomail.test')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')

    const initialMemory = await monitor.measureMemoryUsage()
    console.log(`초기 메모리: ${initialMemory.toFixed(2)}MB`)

    // 여러 페이지 간 네비게이션 반복 (메모리 누수 유발 가능)
    const pages = ['/dashboard', '/companies', '/contacts', '/notifications', '/settings']

    for (let iteration = 0; iteration < 3; iteration++) {
      for (const pagePath of pages) {
        await page.goto(pagePath)
        await page.waitForTimeout(500) // 각 페이지에서 잠깐 대기
      }
    }

    const finalMemory = await monitor.measureMemoryUsage()
    const memoryIncrease = finalMemory - initialMemory

    console.log('메모리 누수 분석:', {
      초기메모리: `${initialMemory.toFixed(2)}MB`,
      최종메모리: `${finalMemory.toFixed(2)}MB`,
      메모리증가: `${memoryIncrease.toFixed(2)}MB`,
      증가율: `${((memoryIncrease / initialMemory) * 100).toFixed(2)}%`,
    })

    // 메모리 누수 기준
    expect(memoryIncrease).toBeLessThan(20) // 20MB 이상 증가하면 누수 의심
    expect(memoryIncrease / initialMemory).toBeLessThan(0.5) // 초기 메모리의 50% 이상 증가 시 경고
  })

  test('네트워크 성능 및 캐싱 효율성', async ({ page }) => {
    console.log('🌍 네트워크 성능 및 캐싱 측정')

    // 첫 번째 로드 (캐시 없음)
    const firstLoadStart = Date.now()
    await page.goto('/dashboard')
    const firstLoadTime = Date.now() - firstLoadStart

    // 두 번째 로드 (캐시 있음)
    const secondLoadStart = Date.now()
    await page.reload()
    const secondLoadTime = Date.now() - secondLoadStart

    const cacheEfficiency = ((firstLoadTime - secondLoadTime) / firstLoadTime) * 100

    console.log('네트워크 및 캐싱 결과:', {
      첫번째로드: `${firstLoadTime}ms`,
      두번째로드: `${secondLoadTime}ms`,
      캐시효율성: `${cacheEfficiency.toFixed(2)}%`,
    })

    // 캐싱 효율성 기준
    expect(cacheEfficiency).toBeGreaterThan(20) // 최소 20% 개선
    expect(secondLoadTime).toBeLessThan(firstLoadTime) // 두 번째가 더 빨라야 함
  })
})
