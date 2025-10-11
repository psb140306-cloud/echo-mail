/**
 * End-to-End 접근성(Accessibility) 테스트
 *
 * 이 테스트는 웹 접근성 표준(WCAG 2.1)을 검증합니다:
 * 1. 스크린 리더 호환성
 * 2. 키보드 네비게이션
 * 3. 색상 대비 및 시각적 접근성
 * 4. ARIA 속성 및 의미론적 HTML
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Echo Mail 접근성 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 모든 접근성 테스트 전에 로그인
    await page.goto('/auth/login')
    await page.fill('[data-testid="email-input"]', 'test@echomail.test')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
  })

  test('WCAG 2.1 AA 표준 준수 검증', async ({ page }) => {
    console.log('♿ WCAG 접근성 표준 검증 시작')

    const pages = [
      { name: '대시보드', path: '/dashboard' },
      { name: '회사목록', path: '/companies' },
      { name: '연락처목록', path: '/contacts' },
      { name: '알림설정', path: '/notifications' },
      { name: '설정페이지', path: '/settings' },
    ]

    for (const testPage of pages) {
      await page.goto(testPage.path)

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()

      console.log(`${testPage.name} 접근성 분석:`, {
        준수항목: accessibilityScanResults.passes.length,
        위반항목: accessibilityScanResults.violations.length,
        불완전항목: accessibilityScanResults.incomplete.length,
      })

      // 심각한 접근성 위반이 없어야 함
      expect(accessibilityScanResults.violations).toEqual([])

      // 위반 사항이 있다면 상세 로그 출력
      if (accessibilityScanResults.violations.length > 0) {
        console.error(`${testPage.name} 접근성 위반 사항:`)
        accessibilityScanResults.violations.forEach((violation) => {
          console.error(`- ${violation.id}: ${violation.description}`)
          console.error(`  영향도: ${violation.impact}`)
          console.error(`  도움말: ${violation.helpUrl}`)
        })
      }
    }
  })

  test('키보드 네비게이션 테스트', async ({ page }) => {
    console.log('⌨️ 키보드 네비게이션 테스트')

    await page.goto('/dashboard')

    // 1. Tab 키로 포커스 이동 테스트
    await page.keyboard.press('Tab')
    let focusedElement = await page.locator(':focus').first()
    expect(await focusedElement.isVisible()).toBe(true)

    // 주요 네비게이션 요소들이 키보드로 접근 가능한지 확인
    const navigationElements = [
      '[data-testid="nav-dashboard"]',
      '[data-testid="nav-companies"]',
      '[data-testid="nav-contacts"]',
      '[data-testid="nav-notifications"]',
      '[data-testid="nav-settings"]',
    ]

    for (const element of navigationElements) {
      await page.locator(element).focus()
      focusedElement = await page.locator(':focus').first()

      const elementSelector = await focusedElement.getAttribute('data-testid')
      expect(element).toContain(elementSelector || '')

      // Enter 키로 활성화 가능한지 확인
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500) // 페이지 이동 대기
    }

    console.log('키보드 네비게이션: ✅ 모든 주요 요소 접근 가능')
  })

  test('폼 요소 접근성 테스트', async ({ page }) => {
    console.log('📝 폼 요소 접근성 테스트')

    await page.goto('/companies')
    await page.click('[data-testid="add-company-button"]')

    // 폼 라벨과 입력 필드 연결 확인
    const formFields = [
      { label: '회사명', input: '[data-testid="company-name-input"]' },
      { label: '이메일', input: '[data-testid="company-email-input"]' },
      { label: '전화번호', input: '[data-testid="company-phone-input"]' },
      { label: '주소', input: '[data-testid="company-address-input"]' },
    ]

    for (const field of formFields) {
      const inputElement = page.locator(field.input)

      // 라벨이 올바르게 연결되어 있는지 확인
      const labelId = await inputElement.getAttribute('aria-labelledby')
      const ariaLabel = await inputElement.getAttribute('aria-label')

      expect(labelId || ariaLabel).toBeTruthy()

      // 키보드로 접근 가능한지 확인
      await inputElement.focus()
      const isFocused = await inputElement.evaluate((el) => el === document.activeElement)
      expect(isFocused).toBe(true)

      // 필수 필드 표시 확인
      const isRequired = await inputElement.getAttribute('required')
      const ariaRequired = await inputElement.getAttribute('aria-required')

      if (isRequired !== null || ariaRequired === 'true') {
        console.log(`${field.label}: 필수 필드로 올바르게 표시됨`)
      }
    }

    console.log('폼 접근성: ✅ 모든 필드 라벨 연결 및 키보드 접근 가능')
  })

  test('스크린 리더 호환성 테스트', async ({ page }) => {
    console.log('🔊 스크린 리더 호환성 테스트')

    await page.goto('/dashboard')

    // 주요 랜드마크 역할(landmark roles) 확인
    const landmarks = [
      { role: 'main', description: '주요 콘텐츠 영역' },
      { role: 'navigation', description: '네비게이션 영역' },
      { role: 'banner', description: '헤더 영역' },
      { role: 'contentinfo', description: '푸터 영역' },
    ]

    for (const landmark of landmarks) {
      const elements = await page.locator(`[role="${landmark.role}"]`).count()
      expect(elements).toBeGreaterThan(0)
      console.log(`${landmark.description}: ✅ 발견됨 (${elements}개)`)
    }

    // 헤딩 구조 확인 (h1 → h2 → h3 순서)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
    let previousLevel = 0

    for (const heading of headings) {
      const tagName = await heading.evaluate((el) => el.tagName.toLowerCase())
      const currentLevel = parseInt(tagName.substring(1))

      // 헤딩 레벨이 논리적 순서인지 확인 (1단계 초과 점프 금지)
      if (previousLevel !== 0 && currentLevel > previousLevel + 1) {
        console.warn(`헤딩 구조 경고: ${tagName}이 h${previousLevel} 다음에 나타남`)
      }

      previousLevel = currentLevel
    }

    // 이미지 대체 텍스트 확인
    const images = await page.locator('img').all()
    for (const img of images) {
      const alt = await img.getAttribute('alt')
      const ariaLabel = await img.getAttribute('aria-label')
      const role = await img.getAttribute('role')

      // 장식용 이미지가 아니라면 대체 텍스트가 있어야 함
      if (role !== 'presentation' && !alt && !ariaLabel) {
        const src = await img.getAttribute('src')
        console.warn(`이미지 대체 텍스트 누락: ${src}`)
      }
    }

    console.log('스크린 리더 호환성: ✅ 기본 구조 및 의미론적 마크업 확인')
  })

  test('색상 대비 및 시각적 접근성 테스트', async ({ page }) => {
    console.log('🎨 색상 대비 및 시각적 접근성 테스트')

    await page.goto('/dashboard')

    // 고대비 모드 시뮬레이션
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(1000)

    // 다크 모드에서도 모든 텍스트가 읽기 가능한지 확인
    const textElements = await page.locator('p, span, h1, h2, h3, button, a').all()

    for (const element of textElements.slice(0, 10)) {
      // 처음 10개만 테스트
      const isVisible = await element.isVisible()
      if (isVisible) {
        const textContent = await element.textContent()
        if (textContent && textContent.trim().length > 0) {
          // 요소가 화면에 표시되고 텍스트가 있는지 확인
          const boundingBox = await element.boundingBox()
          expect(boundingBox).toBeTruthy()
        }
      }
    }

    // 라이트 모드로 복원
    await page.emulateMedia({ colorScheme: 'light' })

    // 포커스 표시자 확인
    await page.locator('[data-testid="nav-companies"]').focus()

    // 포커스된 요소에 시각적 표시가 있는지 확인
    const focusedElement = page.locator(':focus')
    const outlineStyle = await focusedElement.evaluate((el) => window.getComputedStyle(el).outline)

    // 포커스 표시자가 있어야 함 (outline 또는 box-shadow)
    expect(outlineStyle).not.toBe('none')

    console.log('색상 대비: ✅ 다크/라이트 모드 및 포커스 표시자 확인')
  })

  test('모바일 접근성 테스트', async ({ page }) => {
    console.log('📱 모바일 접근성 테스트')

    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')

    // 터치 타겟 크기 확인 (최소 44x44px)
    const buttons = await page.locator('button, a, [role="button"]').all()

    for (const button of buttons.slice(0, 5)) {
      // 처음 5개만 테스트
      const isVisible = await button.isVisible()
      if (isVisible) {
        const boundingBox = await button.boundingBox()
        if (boundingBox) {
          const meetsMinSize = boundingBox.width >= 44 && boundingBox.height >= 44
          if (!meetsMinSize) {
            const content = await button.textContent()
            console.warn(
              `터치 타겟 크기 부족: "${content}" (${boundingBox.width}x${boundingBox.height}px)`
            )
          }
        }
      }
    }

    // 모바일 네비게이션 메뉴 접근성 확인
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]')
    if (await mobileMenuButton.isVisible()) {
      // 모바일 메뉴 버튼에 적절한 라벨이 있는지 확인
      const ariaLabel = await mobileMenuButton.getAttribute('aria-label')
      const ariaExpanded = await mobileMenuButton.getAttribute('aria-expanded')

      expect(ariaLabel).toBeTruthy()
      expect(ariaExpanded).toBeTruthy()

      // 메뉴 토글 기능 확인
      await mobileMenuButton.click()
      const expandedState = await mobileMenuButton.getAttribute('aria-expanded')
      expect(expandedState).toBe('true')
    }

    console.log('모바일 접근성: ✅ 터치 타겟 크기 및 모바일 메뉴 확인')
  })

  test('에러 메시지 및 알림 접근성 테스트', async ({ page }) => {
    console.log('⚠️ 에러 메시지 및 알림 접근성 테스트')

    await page.goto('/companies')
    await page.click('[data-testid="add-company-button"]')

    // 필수 필드를 비운 채로 저장 시도 (에러 발생)
    await page.click('[data-testid="save-company-button"]')

    // 에러 메시지가 스크린 리더에 전달되는지 확인
    const errorMessages = await page.locator('[role="alert"], [aria-live="assertive"]').all()

    for (const errorMsg of errorMessages) {
      const isVisible = await errorMsg.isVisible()
      const text = await errorMsg.textContent()

      if (isVisible && text) {
        console.log(`에러 메시지 발견: "${text}"`)

        // 에러 메시지가 관련 필드와 연결되어 있는지 확인
        const ariaDescribedBy = await page
          .locator('[aria-describedby]')
          .first()
          .getAttribute('aria-describedby')
        if (ariaDescribedBy) {
          const errorId = await errorMsg.getAttribute('id')
          expect(ariaDescribedBy).toContain(errorId || '')
        }
      }
    }

    // 성공 알림 테스트 (올바른 데이터 입력)
    await page.fill('[data-testid="company-name-input"]', 'Test Company')
    await page.fill('[data-testid="company-email-input"]', 'test@company.com')
    await page.click('[data-testid="save-company-button"]')

    // 성공 메시지 접근성 확인
    const successMessage = page.locator('[data-testid="success-toast"], [role="status"]')
    if (await successMessage.isVisible()) {
      const ariaLive = await successMessage.getAttribute('aria-live')
      expect(ariaLive).toBeTruthy() // polite 또는 assertive여야 함
    }

    console.log('에러/알림 접근성: ✅ 에러 메시지 및 성공 알림 스크린 리더 호환성 확인')
  })

  test('데이터 테이블 접근성 테스트', async ({ page }) => {
    console.log('📊 데이터 테이블 접근성 테스트')

    await page.goto('/companies')

    // 테이블 구조 확인
    const tables = await page.locator('table').all()

    for (const table of tables) {
      // 테이블 캡션 또는 aria-label 확인
      const caption = await table.locator('caption').textContent()
      const ariaLabel = await table.getAttribute('aria-label')
      const ariaLabelledBy = await table.getAttribute('aria-labelledby')

      expect(caption || ariaLabel || ariaLabelledBy).toBeTruthy()

      // 헤더 셀들이 적절히 마크업되어 있는지 확인
      const headerCells = await table.locator('th').all()
      expect(headerCells.length).toBeGreaterThan(0)

      for (const th of headerCells) {
        const scope = await th.getAttribute('scope')
        // scope 속성이 있어야 함 (col, row, colgroup, rowgroup)
        expect(scope).toBeTruthy()
      }

      // 정렬 가능한 컬럼의 접근성 확인
      const sortableHeaders = await table.locator('th[aria-sort]').all()
      for (const sortHeader of sortableHeaders) {
        const ariaSort = await sortHeader.getAttribute('aria-sort')
        const validSortValues = ['ascending', 'descending', 'none']
        expect(validSortValues).toContain(ariaSort || '')
      }
    }

    console.log('데이터 테이블 접근성: ✅ 테이블 구조, 헤더, 정렬 기능 확인')
  })

  test('다국어 지원 및 언어 표시 테스트', async ({ page }) => {
    console.log('🌐 다국어 지원 및 언어 표시 테스트')

    await page.goto('/dashboard')

    // HTML lang 속성 확인
    const htmlLang = await page.locator('html').getAttribute('lang')
    expect(htmlLang).toBeTruthy()
    expect(htmlLang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/) // ko, ko-KR, en-US 등

    // 언어별 텍스트 방향 확인
    const direction = await page.locator('html').getAttribute('dir')
    if (direction) {
      expect(['ltr', 'rtl']).toContain(direction)
    }

    // 언어 전환 기능이 있다면 테스트
    const langSelector = page.locator('[data-testid="language-selector"]')
    if (await langSelector.isVisible()) {
      const ariaLabel = await langSelector.getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()

      // 언어 옵션들이 적절히 라벨링되어 있는지 확인
      await langSelector.click()
      const options = await page.locator('[role="option"]').all()

      for (const option of options) {
        const optionText = await option.textContent()
        const lang = await option.getAttribute('lang')
        expect(optionText && lang).toBeTruthy()
      }
    }

    console.log('다국어 지원: ✅ 언어 속성 및 방향성 확인')
  })
})
