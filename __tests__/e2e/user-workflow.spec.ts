/**
 * End-to-End 테스트 - 사용자 워크플로우
 *
 * 이 테스트는 실제 브라우저 환경에서 전체 사용자 워크플로우를 검증합니다:
 * 1. 회원가입 → 로그인 → 대시보드 접근
 * 2. 회사/연락처 등록 → 알림 설정
 * 3. 이메일 수신 → 알림 발송 전체 플로우
 * 4. 결제 플로우 검증
 */

import { test, expect, Page } from '@playwright/test'

// 테스트용 사용자 데이터
const testUser = {
  email: 'test@echomail.test',
  password: 'TestPassword123!',
  companyName: 'Echo Mail Test Company',
  subdomain: 'testcompany',
}

const testCompany = {
  name: 'Client Company A',
  email: 'client@company-a.com',
  phone: '02-1234-5678',
  address: '서울시 강남구 테헤란로 123',
}

const testContact = {
  name: '김담당',
  email: 'manager@company-a.com',
  phone: '010-1234-5678',
  department: '마케팅부',
  position: '팀장',
}

// 페이지 헬퍼 클래스
class EchoMailPage {
  constructor(public page: Page) {}

  // 로그인 페이지
  async navigateToLogin() {
    await this.page.goto('/auth/login')
    await expect(this.page).toHaveTitle(/로그인/)
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email-input"]', email)
    await this.page.fill('[data-testid="password-input"]', password)
    await this.page.click('[data-testid="login-button"]')
  }

  // 회원가입 페이지
  async navigateToSignup() {
    await this.page.goto('/auth/signup')
    await expect(this.page).toHaveTitle(/회원가입/)
  }

  async signup(userData: typeof testUser) {
    await this.page.fill('[data-testid="email-input"]', userData.email)
    await this.page.fill('[data-testid="password-input"]', userData.password)
    await this.page.fill('[data-testid="company-name-input"]', userData.companyName)
    await this.page.fill('[data-testid="subdomain-input"]', userData.subdomain)
    await this.page.click('[data-testid="signup-button"]')
  }

  // 대시보드
  async navigateToDashboard() {
    await this.page.goto('/dashboard')
    await expect(this.page.locator('[data-testid="dashboard-title"]')).toBeVisible()
  }

  async getDashboardStats() {
    const stats = {
      totalCompanies: await this.page.locator('[data-testid="total-companies"]').textContent(),
      totalContacts: await this.page.locator('[data-testid="total-contacts"]').textContent(),
      thisMonthEmails: await this.page.locator('[data-testid="month-emails"]').textContent(),
      thisMonthNotifications: await this.page
        .locator('[data-testid="month-notifications"]')
        .textContent(),
    }
    return stats
  }

  // 회사 관리
  async navigateToCompanies() {
    await this.page.goto('/companies')
    await expect(this.page.locator('[data-testid="companies-title"]')).toBeVisible()
  }

  async addCompany(companyData: typeof testCompany) {
    await this.page.click('[data-testid="add-company-button"]')
    await this.page.fill('[data-testid="company-name-input"]', companyData.name)
    await this.page.fill('[data-testid="company-email-input"]', companyData.email)
    await this.page.fill('[data-testid="company-phone-input"]', companyData.phone)
    await this.page.fill('[data-testid="company-address-input"]', companyData.address)
    await this.page.click('[data-testid="save-company-button"]')

    // 성공 토스트 메시지 확인
    await expect(this.page.locator('[data-testid="success-toast"]')).toBeVisible()
  }

  async getCompanyList() {
    await this.page.waitForSelector('[data-testid="company-row"]')
    const companies = await this.page.locator('[data-testid="company-row"]').all()
    return companies.length
  }

  // 연락처 관리
  async navigateToContacts() {
    await this.page.goto('/contacts')
    await expect(this.page.locator('[data-testid="contacts-title"]')).toBeVisible()
  }

  async addContact(contactData: typeof testContact) {
    await this.page.click('[data-testid="add-contact-button"]')
    await this.page.fill('[data-testid="contact-name-input"]', contactData.name)
    await this.page.fill('[data-testid="contact-email-input"]', contactData.email)
    await this.page.fill('[data-testid="contact-phone-input"]', contactData.phone)
    await this.page.fill('[data-testid="contact-department-input"]', contactData.department)
    await this.page.fill('[data-testid="contact-position-input"]', contactData.position)

    // 회사 선택
    await this.page.click('[data-testid="company-select"]')
    await this.page.click(`[data-testid="company-option-${testCompany.name}"]`)

    await this.page.click('[data-testid="save-contact-button"]')

    // 성공 토스트 메시지 확인
    await expect(this.page.locator('[data-testid="success-toast"]')).toBeVisible()
  }

  // 알림 설정
  async navigateToNotifications() {
    await this.page.goto('/notifications')
    await expect(this.page.locator('[data-testid="notifications-title"]')).toBeVisible()
  }

  async setupNotificationRule(contact: string, smsEnabled: boolean, kakaoEnabled: boolean) {
    await this.page.click('[data-testid="add-rule-button"]')

    // 연락처 선택
    await this.page.click('[data-testid="contact-select"]')
    await this.page.click(`[data-testid="contact-option-${contact}"]`)

    // SMS 알림 설정
    if (smsEnabled) {
      await this.page.check('[data-testid="sms-enabled-checkbox"]')
    }

    // 카카오톡 알림 설정
    if (kakaoEnabled) {
      await this.page.check('[data-testid="kakao-enabled-checkbox"]')
    }

    await this.page.click('[data-testid="save-rule-button"]')
    await expect(this.page.locator('[data-testid="success-toast"]')).toBeVisible()
  }

  // 결제 페이지
  async navigateToSubscription() {
    await this.page.goto('/subscription')
    await expect(this.page.locator('[data-testid="subscription-title"]')).toBeVisible()
  }

  async upgradeToBusinessPlan() {
    await this.page.click('[data-testid="business-plan-button"]')
    await this.page.click('[data-testid="upgrade-now-button"]')

    // 결제 정보 입력 (테스트용)
    await this.page.fill('[data-testid="card-number-input"]', '4111111111111111')
    await this.page.fill('[data-testid="expiry-input"]', '12/25')
    await this.page.fill('[data-testid="cvc-input"]', '123')
    await this.page.fill('[data-testid="cardholder-input"]', '홍길동')

    await this.page.click('[data-testid="pay-button"]')

    // 결제 완료 확인
    await expect(this.page.locator('[data-testid="payment-success"]')).toBeVisible()
  }

  // 이메일 시뮬레이션
  async simulateEmailReceived(fromEmail: string, subject: string) {
    // 개발자 도구를 통한 이메일 수신 시뮬레이션
    await this.page.goto('/admin/email-simulator')
    await this.page.fill('[data-testid="from-email-input"]', fromEmail)
    await this.page.fill('[data-testid="subject-input"]', subject)
    await this.page.click('[data-testid="simulate-button"]')

    // 처리 완료 확인
    await expect(this.page.locator('[data-testid="processing-complete"]')).toBeVisible()
  }

  // 알림 발송 확인
  async checkNotificationsSent() {
    await this.page.goto('/notifications/history')
    await expect(this.page.locator('[data-testid="notification-row"]').first()).toBeVisible()

    const notifications = await this.page.locator('[data-testid="notification-row"]').all()
    return notifications.length
  }
}

test.describe('Echo Mail 전체 워크플로우 E2E 테스트', () => {
  let echoMail: EchoMailPage

  test.beforeEach(async ({ page }) => {
    echoMail = new EchoMailPage(page)
  })

  test('1. 사용자 회원가입 및 초기 설정 플로우', async ({ page }) => {
    // 1-1. 회원가입
    await echoMail.navigateToSignup()
    await echoMail.signup(testUser)

    // 회원가입 후 로그인 페이지로 리디렉션 확인
    await expect(page).toHaveURL(/\/auth\/login/)

    // 1-2. 로그인
    await echoMail.login(testUser.email, testUser.password)

    // 로그인 후 대시보드로 리디렉션 확인
    await expect(page).toHaveURL(/\/dashboard/)

    // 1-3. 대시보드 초기 상태 확인
    const initialStats = await echoMail.getDashboardStats()
    expect(initialStats.totalCompanies).toBe('0')
    expect(initialStats.totalContacts).toBe('0')
  })

  test('2. 회사 및 연락처 등록 플로우', async ({ page }) => {
    // 사전 조건: 로그인
    await echoMail.navigateToLogin()
    await echoMail.login(testUser.email, testUser.password)

    // 2-1. 회사 등록
    await echoMail.navigateToCompanies()
    await echoMail.addCompany(testCompany)

    // 회사 목록에서 등록 확인
    const companyCount = await echoMail.getCompanyList()
    expect(companyCount).toBe(1)

    // 2-2. 연락처 등록
    await echoMail.navigateToContacts()
    await echoMail.addContact(testContact)

    // 2-3. 대시보드에서 통계 업데이트 확인
    await echoMail.navigateToDashboard()
    const updatedStats = await echoMail.getDashboardStats()
    expect(updatedStats.totalCompanies).toBe('1')
    expect(updatedStats.totalContacts).toBe('1')
  })

  test('3. 알림 설정 및 규칙 관리 플로우', async ({ page }) => {
    // 사전 조건: 로그인 및 데이터 준비
    await echoMail.navigateToLogin()
    await echoMail.login(testUser.email, testUser.password)

    // 3-1. 알림 규칙 설정
    await echoMail.navigateToNotifications()
    await echoMail.setupNotificationRule(testContact.name, true, true)

    // 알림 규칙이 생성되었는지 확인
    await expect(page.locator('[data-testid="notification-rule-row"]')).toBeVisible()
  })

  test('4. 이메일 수신 및 알림 발송 전체 플로우', async ({ page }) => {
    // 사전 조건: 로그인 및 설정 완료
    await echoMail.navigateToLogin()
    await echoMail.login(testUser.email, testUser.password)

    // 4-1. 이메일 수신 시뮬레이션
    await echoMail.simulateEmailReceived(testCompany.email, '[긴급] 시스템 점검 공지')

    // 4-2. 알림 발송 확인
    const notificationCount = await echoMail.checkNotificationsSent()
    expect(notificationCount).toBeGreaterThan(0)

    // 4-3. 대시보드에서 이메일/알림 통계 업데이트 확인
    await echoMail.navigateToDashboard()
    const finalStats = await echoMail.getDashboardStats()
    expect(parseInt(finalStats.thisMonthEmails || '0')).toBeGreaterThan(0)
    expect(parseInt(finalStats.thisMonthNotifications || '0')).toBeGreaterThan(0)
  })

  test('5. 결제 및 플랜 업그레이드 플로우', async ({ page }) => {
    // 사전 조건: 로그인
    await echoMail.navigateToLogin()
    await echoMail.login(testUser.email, testUser.password)

    // 5-1. 현재 플랜 확인
    await echoMail.navigateToSubscription()
    await expect(page.locator('[data-testid="current-plan"]')).toContainText('STARTER')

    // 5-2. 비즈니스 플랜으로 업그레이드
    await echoMail.upgradeToBusinessPlan()

    // 5-3. 플랜 변경 확인
    await expect(page.locator('[data-testid="current-plan"]')).toContainText('BUSINESS')
  })

  test('6. 모바일 반응형 UI 테스트', async ({ page }) => {
    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 375, height: 667 })

    await echoMail.navigateToLogin()
    await echoMail.login(testUser.email, testUser.password)

    // 6-1. 모바일 네비게이션 확인
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible()
    await page.click('[data-testid="mobile-menu-button"]')
    await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible()

    // 6-2. 모바일에서 회사 목록 확인
    await echoMail.navigateToCompanies()
    await expect(page.locator('[data-testid="mobile-company-card"]')).toBeVisible()

    // 6-3. 모바일에서 연락처 목록 확인
    await echoMail.navigateToContacts()
    await expect(page.locator('[data-testid="mobile-contact-card"]')).toBeVisible()
  })

  test('7. 다크 모드 테스트', async ({ page }) => {
    await echoMail.navigateToLogin()
    await echoMail.login(testUser.email, testUser.password)

    // 7-1. 다크 모드 토글
    await page.click('[data-testid="theme-toggle"]')

    // 7-2. 다크 모드 적용 확인
    await expect(page.locator('html')).toHaveClass(/dark/)

    // 7-3. 다크 모드에서 페이지 네비게이션 확인
    await echoMail.navigateToCompanies()
    await expect(page.locator('[data-testid="companies-container"]')).toHaveClass(
      /dark:bg-gray-900/
    )

    // 7-4. 라이트 모드로 복원
    await page.click('[data-testid="theme-toggle"]')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('8. 에러 상황 및 복구 플로우', async ({ page }) => {
    await echoMail.navigateToLogin()
    await echoMail.login(testUser.email, testUser.password)

    // 8-1. 네트워크 에러 시뮬레이션
    await page.route('**/api/companies', (route) => route.abort())

    await echoMail.navigateToCompanies()
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()

    // 8-2. 에러 복구 (재시도)
    await page.unroute('**/api/companies')
    await page.click('[data-testid="retry-button"]')
    await expect(page.locator('[data-testid="companies-list"]')).toBeVisible()
  })
})
