/**
 * E2E Test: Admin Dashboard
 * 관리자 대시보드 E2E 테스트
 */

import { test, expect, Page } from '@playwright/test'
import { faker } from '@faker-js/faker'

// 테스트 데이터 생성 헬퍼
const generateCompanyData = () => ({
  name: faker.company.name() + ' 주식회사',
  email: faker.internet.email().toLowerCase(),
  region: faker.helpers.arrayElement(['서울', '부산', '대구', '인천', '광주', '대전', '울산']),
  contactName: faker.person.firstName() + faker.person.lastName(),
  contactPhone: `010-${faker.number.int({ min: 1000, max: 9999 })}-${faker.number.int({ min: 1000, max: 9999 })}`,
  contactEmail: faker.internet.email().toLowerCase(),
  position: faker.helpers.arrayElement(['대표', '매니저', '과장', '대리', '팀장'])
})

// 로그인 헬퍼
async function login(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', 'admin@echomail.com')
  await page.fill('input[name="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
  await expect(page.locator('h1')).toContainText('Echo Mail')
}

test.describe('Admin Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전 로그인
    await login(page)
  })

  test.describe('Dashboard Overview', () => {
    test('should display dashboard stats correctly', async ({ page }) => {
      await page.goto('/')

      // 대시보드 통계 카드 확인
      const statsCards = page.locator('.stats-card')
      await expect(statsCards).toHaveCount(4)

      // 각 통계 카드 내용 확인
      await expect(page.locator('[data-testid="total-companies"]')).toBeVisible()
      await expect(page.locator('[data-testid="active-companies"]')).toBeVisible()
      await expect(page.locator('[data-testid="emails-today"]')).toBeVisible()
      await expect(page.locator('[data-testid="notifications-today"]')).toBeVisible()

      // 차트 로딩 확인
      await expect(page.locator('[data-testid="email-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="notification-chart"]')).toBeVisible()
    })

    test('should refresh dashboard data', async ({ page }) => {
      await page.goto('/')

      // 새로고침 버튼 클릭
      const refreshButton = page.locator('button[aria-label="새로고침"]')
      await refreshButton.click()

      // 로딩 상태 확인
      await expect(page.locator('.loading-spinner')).toBeVisible()

      // 데이터 업데이트 완료 대기
      await expect(page.locator('.loading-spinner')).not.toBeVisible({ timeout: 5000 })

      // 업데이트 시간 표시 확인
      await expect(page.locator('[data-testid="last-updated"]')).toContainText(/방금|[0-9]+초 전/)
    })

    test('should navigate through main menu', async ({ page }) => {
      await page.goto('/')

      // 네비게이션 메뉴 테스트
      const menuItems = [
        { label: '대시보드', url: '/' },
        { label: '업체 관리', url: '/companies' },
        { label: '납품 규칙', url: '/delivery-rules' },
        { label: '로그 조회', url: '/logs' },
        { label: '설정', url: '/settings' }
      ]

      for (const item of menuItems) {
        await page.click(`nav a:has-text("${item.label}")`)
        await expect(page).toHaveURL(item.url)
        await expect(page.locator('h1, h2').first()).toBeVisible()
      }
    })
  })

  test.describe('Company Management', () => {
    test('should create a new company', async ({ page }) => {
      await page.goto('/companies')

      // 새 업체 추가 버튼 클릭
      await page.click('button:has-text("새 업체 추가")')

      // 업체 정보 입력
      const companyData = generateCompanyData()

      await page.fill('input[name="name"]', companyData.name)
      await page.fill('input[name="email"]', companyData.email)
      await page.selectOption('select[name="region"]', companyData.region)

      // 담당자 정보 입력
      await page.fill('input[name="contact.name"]', companyData.contactName)
      await page.fill('input[name="contact.phone"]', companyData.contactPhone)
      await page.fill('input[name="contact.email"]', companyData.contactEmail)
      await page.fill('input[name="contact.position"]', companyData.position)

      // SMS/카카오톡 설정
      await page.check('input[name="contact.smsEnabled"]')
      await page.check('input[name="contact.kakaoEnabled"]')

      // 저장
      await page.click('button:has-text("저장")')

      // 성공 메시지 확인
      await expect(page.locator('.toast-success')).toContainText('업체가 성공적으로 등록되었습니다')

      // 목록에서 새 업체 확인
      await expect(page.locator(`tr:has-text("${companyData.name}")`)).toBeVisible()
    })

    test('should search and filter companies', async ({ page }) => {
      await page.goto('/companies')

      // 검색 테스트
      await page.fill('input[placeholder="업체명 또는 이메일 검색"]', '테스트')
      await page.press('input[placeholder="업체명 또는 이메일 검색"]', 'Enter')

      // 검색 결과 확인
      await expect(page.locator('tbody tr')).toHaveCount(await page.locator('tbody tr:has-text("테스트")').count())

      // 필터 테스트 - 지역
      await page.selectOption('select[name="region"]', '서울')
      await expect(page.locator('tbody tr')).toHaveCount(await page.locator('tbody tr:has-text("서울")').count())

      // 필터 테스트 - 활성 상태
      await page.selectOption('select[name="isActive"]', 'true')
      const activeCompanies = page.locator('tbody tr').filter({ has: page.locator('.badge-success') })
      await expect(activeCompanies).toHaveCount(await activeCompanies.count())

      // 필터 초기화
      await page.click('button:has-text("필터 초기화")')
      await expect(page.locator('input[placeholder="업체명 또는 이메일 검색"]')).toHaveValue('')
    })

    test('should edit company information', async ({ page }) => {
      await page.goto('/companies')

      // 첫 번째 업체의 편집 버튼 클릭
      await page.locator('tbody tr').first().locator('button[aria-label="편집"]').click()

      // 정보 수정
      const newName = '수정된 업체명 주식회사'
      await page.fill('input[name="name"]', newName)
      await page.selectOption('select[name="region"]', '부산')

      // 저장
      await page.click('button:has-text("저장")')

      // 성공 메시지 확인
      await expect(page.locator('.toast-success')).toContainText('업체 정보가 수정되었습니다')

      // 수정된 정보 확인
      await expect(page.locator(`tr:has-text("${newName}")`)).toBeVisible()
      await expect(page.locator(`tr:has-text("${newName}")`)).toContainText('부산')
    })

    test('should delete company with confirmation', async ({ page }) => {
      await page.goto('/companies')

      // 삭제할 업체명 기억
      const companyName = await page.locator('tbody tr').last().locator('td').first().textContent()

      // 마지막 업체의 삭제 버튼 클릭
      await page.locator('tbody tr').last().locator('button[aria-label="삭제"]').click()

      // 확인 다이얼로그 처리
      await expect(page.locator('.alert-dialog')).toBeVisible()
      await expect(page.locator('.alert-dialog')).toContainText('정말 삭제하시겠습니까?')

      // 삭제 확인
      await page.click('button:has-text("삭제")')

      // 성공 메시지 확인
      await expect(page.locator('.toast-success')).toContainText('업체가 삭제되었습니다')

      // 목록에서 제거 확인
      await expect(page.locator(`tr:has-text("${companyName}")`)).not.toBeVisible()
    })

    test('should handle pagination', async ({ page }) => {
      await page.goto('/companies')

      // 페이지네이션 컨트롤 확인
      const pagination = page.locator('.pagination')
      await expect(pagination).toBeVisible()

      // 페이지당 항목 수 변경
      await page.selectOption('select[name="pageSize"]', '20')
      await expect(page.locator('tbody tr')).toHaveCount(await page.locator('tbody tr').count())

      // 다음 페이지로 이동
      if (await page.locator('button:has-text("다음")').isEnabled()) {
        await page.click('button:has-text("다음")')
        await expect(page).toHaveURL(/page=2/)
      }

      // 이전 페이지로 이동
      if (await page.locator('button:has-text("이전")').isEnabled()) {
        await page.click('button:has-text("이전")')
        await expect(page).toHaveURL(/page=1/)
      }
    })

    test('should bulk import companies from CSV', async ({ page }) => {
      await page.goto('/companies')

      // 가져오기 버튼 클릭
      await page.click('button:has-text("CSV 가져오기")')

      // 템플릿 다운로드
      const downloadPromise = page.waitForEvent('download')
      await page.click('a:has-text("템플릿 다운로드")')
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('company_template.csv')

      // CSV 파일 업로드 (테스트 파일 준비 필요)
      const csvContent = `name,email,region,contact_name,contact_phone,contact_email,position
테스트회사1,test1@company.com,서울,김철수,010-1111-1111,kim@test1.com,매니저
테스트회사2,test2@company.com,부산,이영희,010-2222-2222,lee@test2.com,대리
테스트회사3,test3@company.com,대구,박민수,010-3333-3333,park@test3.com,과장`

      // 파일 업로드 시뮬레이션
      await page.setInputFiles('input[type="file"]', {
        name: 'companies.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent)
      })

      // 미리보기 확인
      await expect(page.locator('.import-preview')).toBeVisible()
      await expect(page.locator('.import-preview tbody tr')).toHaveCount(3)

      // 가져오기 실행
      await page.click('button:has-text("가져오기 실행")')

      // 진행 상태 확인
      await expect(page.locator('.progress-bar')).toBeVisible()
      await expect(page.locator('.progress-bar')).not.toBeVisible({ timeout: 10000 })

      // 성공 메시지 확인
      await expect(page.locator('.toast-success')).toContainText('3개 업체가 성공적으로 등록되었습니다')
    })
  })

  test.describe('Delivery Rules Management', () => {
    test('should create delivery rule', async ({ page }) => {
      await page.goto('/delivery-rules')

      // 새 규칙 추가
      await page.click('button:has-text("새 규칙 추가")')

      // 규칙 정보 입력
      await page.selectOption('select[name="region"]', '서울')
      await page.fill('input[name="morningCutoff"]', '11:00')
      await page.fill('input[name="afternoonCutoff"]', '15:00')
      await page.fill('input[name="morningDeliveryDays"]', '1')
      await page.fill('input[name="afternoonDeliveryDays"]', '2')
      await page.check('input[name="excludeWeekends"]')
      await page.check('input[name="excludeHolidays"]')

      // 저장
      await page.click('button:has-text("저장")')

      // 성공 메시지 확인
      await expect(page.locator('.toast-success')).toContainText('납품 규칙이 생성되었습니다')

      // 목록에서 확인
      await expect(page.locator('.rule-card:has-text("서울")')).toBeVisible()
    })

    test('should calculate delivery date', async ({ page }) => {
      await page.goto('/delivery-rules')

      // 납기일 계산기 섹션으로 이동
      await page.click('button:has-text("납기일 계산")')

      // 정보 입력
      await page.selectOption('select[name="region"]', '서울')
      await page.fill('input[name="orderDate"]', '2024-01-15')
      await page.selectOption('select[name="orderTime"]', '오전')

      // 계산 실행
      await page.click('button:has-text("계산")')

      // 결과 확인
      await expect(page.locator('.delivery-result')).toBeVisible()
      await expect(page.locator('.delivery-result')).toContainText(/2024-01-1[67]/) // 1-2일 후

      // 상세 정보 확인
      await expect(page.locator('.delivery-detail')).toContainText(/영업일 기준/)
      await expect(page.locator('.delivery-detail')).toContainText(/주말 제외/)
    })

    test('should manage holidays', async ({ page }) => {
      await page.goto('/delivery-rules')

      // 공휴일 관리 탭으로 이동
      await page.click('button[role="tab"]:has-text("공휴일 관리")')

      // 새 공휴일 추가
      await page.click('button:has-text("공휴일 추가")')
      await page.fill('input[name="date"]', '2024-03-01')
      await page.fill('input[name="name"]', '삼일절')
      await page.check('input[name="isRecurring"]')
      await page.click('button:has-text("저장")')

      // 성공 메시지 확인
      await expect(page.locator('.toast-success')).toContainText('공휴일이 추가되었습니다')

      // 목록에서 확인
      await expect(page.locator('tr:has-text("삼일절")')).toBeVisible()
      await expect(page.locator('tr:has-text("삼일절")')).toContainText('매년 반복')

      // 공휴일 API 동기화
      await page.click('button:has-text("공휴일 API 동기화")')
      await expect(page.locator('.toast-success')).toContainText(/공휴일 정보가 업데이트되었습니다|이미 최신 상태입니다/)
    })
  })

  test.describe('Notification Logs', () => {
    test('should view notification history', async ({ page }) => {
      await page.goto('/logs')

      // 알림 로그 탭 선택
      await page.click('button[role="tab"]:has-text("알림 로그")')

      // 로그 테이블 확인
      await expect(page.locator('table.notification-logs')).toBeVisible()

      // 필터링 테스트 - 날짜
      await page.fill('input[name="startDate"]', '2024-01-01')
      await page.fill('input[name="endDate"]', '2024-01-31')
      await page.click('button:has-text("검색")')

      // 필터링 테스트 - 상태
      await page.selectOption('select[name="status"]', 'SENT')
      const sentLogs = page.locator('tbody tr').filter({ has: page.locator('.badge:has-text("전송완료")') })
      await expect(sentLogs).toHaveCount(await sentLogs.count())

      // 상세 정보 보기
      await page.locator('tbody tr').first().click()
      await expect(page.locator('.notification-detail')).toBeVisible()
      await expect(page.locator('.notification-detail')).toContainText(/메시지 ID|수신자|발송 시간/)
    })

    test('should export logs to CSV', async ({ page }) => {
      await page.goto('/logs')

      // 내보내기 버튼 클릭
      const downloadPromise = page.waitForEvent('download')
      await page.click('button:has-text("CSV 내보내기")')

      // 내보내기 옵션 선택
      await page.check('input[name="includeEmailLogs"]')
      await page.check('input[name="includeNotificationLogs"]')
      await page.fill('input[name="exportStartDate"]', '2024-01-01')
      await page.fill('input[name="exportEndDate"]', '2024-01-31')
      await page.click('button:has-text("내보내기")')

      // 다운로드 확인
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/logs_\d{8}_\d{6}\.csv/)
    })

    test('should display real-time notifications', async ({ page }) => {
      await page.goto('/logs')

      // 실시간 모니터링 활성화
      await page.check('input[name="realTimeMonitoring"]')

      // WebSocket 연결 상태 확인
      await expect(page.locator('.connection-status')).toContainText('연결됨')

      // 새 알림 시뮬레이션 (실제 환경에서는 실제 알림 발송)
      // 여기서는 UI 업데이트만 확인
      await page.waitForTimeout(2000)

      // 실시간 업데이트 표시 확인
      const realtimeIndicator = page.locator('.realtime-indicator')
      if (await realtimeIndicator.isVisible()) {
        await expect(realtimeIndicator).toHaveClass(/pulsing|blinking/)
      }
    })
  })

  test.describe('System Settings', () => {
    test('should configure email settings', async ({ page }) => {
      await page.goto('/settings')

      // 이메일 설정 탭
      await page.click('button[role="tab"]:has-text("이메일 설정")')

      // IMAP 설정 입력
      await page.fill('input[name="imapHost"]', 'imap.gmail.com')
      await page.fill('input[name="imapPort"]', '993')
      await page.fill('input[name="imapUser"]', 'test@echomail.com')
      await page.fill('input[name="imapPassword"]', 'password123')
      await page.check('input[name="imapTls"]')

      // 연결 테스트
      await page.click('button:has-text("연결 테스트")')
      await expect(page.locator('.test-result')).toBeVisible({ timeout: 10000 })

      // 저장
      await page.click('button:has-text("저장")')
      await expect(page.locator('.toast-success')).toContainText('이메일 설정이 저장되었습니다')
    })

    test('should configure SMS API settings', async ({ page }) => {
      await page.goto('/settings')

      // SMS 설정 탭
      await page.click('button[role="tab"]:has-text("SMS 설정")')

      // API 키 입력
      await page.fill('input[name="smsApiKey"]', 'test-api-key')
      await page.fill('input[name="smsApiSecret"]', 'test-api-secret')
      await page.fill('input[name="smsSender"]', '1588-1234')

      // 테스트 발송
      await page.fill('input[name="testPhone"]', '010-1234-5678')
      await page.click('button:has-text("테스트 발송")')

      // 테스트 결과 확인
      await expect(page.locator('.test-result')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('.test-result')).toContainText(/성공|실패/)

      // 저장
      await page.click('button:has-text("저장")')
      await expect(page.locator('.toast-success')).toContainText('SMS 설정이 저장되었습니다')
    })

    test('should manage notification templates', async ({ page }) => {
      await page.goto('/settings')

      // 템플릿 설정 탭
      await page.click('button[role="tab"]:has-text("템플릿 관리")')

      // 새 템플릿 추가
      await page.click('button:has-text("새 템플릿")')
      await page.fill('input[name="templateName"]', '긴급 발주 알림')
      await page.selectOption('select[name="templateType"]', 'SMS')
      await page.fill('textarea[name="templateContent"]', '[{{company_name}}] 긴급 발주가 도착했습니다. 즉시 확인 부탁드립니다.')

      // 변수 추가
      await page.click('button:has-text("변수 추가")')
      await page.fill('input[name="variable"]', 'company_name')

      // 저장
      await page.click('button:has-text("저장")')
      await expect(page.locator('.toast-success')).toContainText('템플릿이 생성되었습니다')

      // 템플릿 미리보기
      await page.click('button:has-text("미리보기")')
      await page.fill('input[name="company_name"]', '테스트회사')
      await expect(page.locator('.template-preview')).toContainText('[테스트회사] 긴급 발주가 도착했습니다')
    })
  })

  test.describe('Mobile Responsiveness', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // 모바일 뷰포트 설정
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')

      // 햄버거 메뉴 확인
      await expect(page.locator('.mobile-menu-button')).toBeVisible()

      // 메뉴 열기
      await page.click('.mobile-menu-button')
      await expect(page.locator('.mobile-nav')).toBeVisible()

      // 메뉴 항목 클릭
      await page.click('.mobile-nav a:has-text("업체 관리")')
      await expect(page).toHaveURL('/companies')

      // 테이블이 모바일 뷰로 전환되었는지 확인
      await expect(page.locator('.mobile-table')).toBeVisible()
      await expect(page.locator('.desktop-table')).not.toBeVisible()

      // 카드 레이아웃 확인
      await expect(page.locator('.company-card')).toHaveCount(await page.locator('.company-card').count())
    })

    test('should handle touch gestures', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/companies')

      // 스와이프로 삭제 (시뮬레이션)
      const firstCard = page.locator('.company-card').first()
      await firstCard.dispatchEvent('touchstart', { touches: [{ clientX: 300, clientY: 100 }] })
      await firstCard.dispatchEvent('touchmove', { touches: [{ clientX: 50, clientY: 100 }] })
      await firstCard.dispatchEvent('touchend')

      // 삭제 버튼 표시 확인
      await expect(firstCard.locator('.delete-action')).toBeVisible()
    })
  })

  test.describe('Performance and Loading States', () => {
    test('should handle slow network gracefully', async ({ page }) => {
      // 느린 네트워크 시뮬레이션
      await page.route('**/api/**', route => {
        setTimeout(() => route.continue(), 3000)
      })

      await page.goto('/companies')

      // 로딩 상태 표시 확인
      await expect(page.locator('.skeleton-loader')).toBeVisible()

      // 데이터 로딩 완료
      await expect(page.locator('.skeleton-loader')).not.toBeVisible({ timeout: 10000 })
      await expect(page.locator('tbody tr')).toHaveCount(await page.locator('tbody tr').count())
    })

    test('should handle API errors', async ({ page }) => {
      // API 오류 시뮬레이션
      await page.route('**/api/companies', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        })
      })

      await page.goto('/companies')

      // 오류 메시지 표시 확인
      await expect(page.locator('.error-message')).toBeVisible()
      await expect(page.locator('.error-message')).toContainText(/오류가 발생했습니다|서버 오류/)

      // 재시도 버튼 확인
      await expect(page.locator('button:has-text("다시 시도")')).toBeVisible()
    })

    test('should lazy load images and data', async ({ page }) => {
      await page.goto('/logs')

      // 초기 로드 항목 확인
      const initialRows = await page.locator('tbody tr').count()

      // 스크롤 다운
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

      // 추가 데이터 로드 대기
      await page.waitForTimeout(1000)

      // 더 많은 항목이 로드되었는지 확인
      const afterScrollRows = await page.locator('tbody tr').count()
      expect(afterScrollRows).toBeGreaterThanOrEqual(initialRows)
    })
  })

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/')

      // Tab 키로 네비게이션
      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toBeVisible()

      // Enter 키로 링크 클릭
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')

      // 포커스 트랩 확인 (모달)
      await page.goto('/companies')
      await page.click('button:has-text("새 업체 추가")')

      // 모달 내에서만 탭 이동
      const modal = page.locator('.modal')
      await expect(modal).toBeVisible()

      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toBeVisible()
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(focusedElement).toBeTruthy()
    })

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/')

      // ARIA 레이블 확인
      await expect(page.locator('[role="navigation"]')).toBeVisible()
      await expect(page.locator('[aria-label="주 메뉴"]')).toBeVisible()
      await expect(page.locator('button[aria-label="새로고침"]')).toBeVisible()

      // 스크린 리더 전용 텍스트
      const srOnly = page.locator('.sr-only')
      expect(await srOnly.count()).toBeGreaterThan(0)
    })

    test('should support high contrast mode', async ({ page }) => {
      await page.goto('/settings')

      // 고대비 모드 활성화
      await page.click('button:has-text("접근성 설정")')
      await page.check('input[name="highContrast"]')

      // 스타일 변경 확인
      const bodyClasses = await page.locator('body').getAttribute('class')
      expect(bodyClasses).toContain('high-contrast')

      // 색상 대비 확인
      const backgroundColor = await page.locator('body').evaluate(el =>
        window.getComputedStyle(el).backgroundColor
      )
      expect(backgroundColor).toMatch(/rgb\(0, 0, 0\)|rgb\(255, 255, 255\)/)
    })
  })
})