/**
 * E2E Test: Complete Workflow
 * 업체 등록부터 메일 수신, 알림 발송까지 전체 플로우 E2E 테스트
 */

import { test, expect, Page } from '@playwright/test'
import { faker } from '@faker-js/faker'

// 테스트용 이메일 시뮬레이터
interface MockEmail {
  messageId: string
  subject: string
  from: string
  to: string
  body: string
  attachments?: Array<{
    filename: string
    contentType: string
    size: number
  }>
  receivedAt: Date
}

// 로그인 헬퍼
async function login(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', 'admin@echomail.com')
  await page.fill('input[name="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
}

// 이메일 시뮬레이션 헬퍼
async function simulateEmailReceive(page: Page, email: MockEmail) {
  // 개발자 도구 또는 테스트 API를 통해 이메일 수신 시뮬레이션
  await page.evaluate((emailData) => {
    // WebSocket이나 Server-Sent Events로 실시간 이메일 수신 시뮬레이션
    window.dispatchEvent(new CustomEvent('email-received', {
      detail: emailData
    }))
  }, email)
}

test.describe('Complete Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test.describe('End-to-End: Company Registration to Notification', () => {
    test('should complete full workflow: registration → email → notification', async ({ page }) => {
      // === 1단계: 업체 등록 ===
      const companyData = {
        name: '워크플로우 테스트 주식회사',
        email: 'workflow@test.com',
        region: '서울',
        contactName: '김테스트',
        contactPhone: '010-9999-9999',
        contactEmail: 'kim@workflow.com',
        position: '매니저'
      }

      await page.goto('/companies')
      await page.click('button:has-text("새 업체 추가")')

      // 업체 정보 입력
      await page.fill('input[name="name"]', companyData.name)
      await page.fill('input[name="email"]', companyData.email)
      await page.selectOption('select[name="region"]', companyData.region)

      // 담당자 정보 입력
      await page.fill('input[name="contact.name"]', companyData.contactName)
      await page.fill('input[name="contact.phone"]', companyData.contactPhone)
      await page.fill('input[name="contact.email"]', companyData.contactEmail)
      await page.fill('input[name="contact.position"]', companyData.position)

      // 알림 설정 활성화
      await page.check('input[name="contact.smsEnabled"]')
      await page.check('input[name="contact.kakaoEnabled"]')

      // 저장
      await page.click('button:has-text("저장")')
      await expect(page.locator('.toast-success')).toContainText('업체가 성공적으로 등록되었습니다')

      // === 2단계: 납품 규칙 설정 ===
      await page.goto('/delivery-rules')

      // 서울 지역 규칙이 없으면 생성
      const seoulRule = page.locator('.rule-card:has-text("서울")')
      if (!(await seoulRule.isVisible())) {
        await page.click('button:has-text("새 규칙 추가")')
        await page.selectOption('select[name="region"]', '서울')
        await page.fill('input[name="morningCutoff"]', '11:00')
        await page.fill('input[name="afternoonCutoff"]', '15:00')
        await page.fill('input[name="morningDeliveryDays"]', '1')
        await page.fill('input[name="afternoonDeliveryDays"]', '2')
        await page.check('input[name="excludeWeekends"]')
        await page.check('input[name="excludeHolidays"]')
        await page.click('button:has-text("저장")')
        await expect(page.locator('.toast-success')).toContainText('납품 규칙이 생성되었습니다')
      }

      // === 3단계: 이메일 수신 시뮬레이션 ===
      const testEmail: MockEmail = {
        messageId: 'workflow-test-' + Date.now(),
        subject: `[${companyData.name}] 발주서 - ${new Date().toISOString().split('T')[0]}`,
        from: companyData.email,
        to: 'order@echomail.com',
        body: `
안녕하세요.
${companyData.name}입니다.

다음과 같이 발주 요청드립니다:

품목: 테스트 상품 A
수량: 100개
납기 희망일: ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}

첨부파일로 상세 발주서를 보내드립니다.
확인 후 연락 부탁드립니다.

감사합니다.
        `,
        attachments: [
          {
            filename: '발주서_워크플로우테스트_20240115.pdf',
            contentType: 'application/pdf',
            size: 1024 * 50 // 50KB
          }
        ],
        receivedAt: new Date()
      }

      // 실시간 모니터링 활성화
      await page.goto('/logs')
      await page.click('button[role="tab"]:has-text("실시간 모니터링")')
      await page.check('input[name="realTimeMonitoring"]')

      // WebSocket 연결 대기
      await expect(page.locator('.connection-status:has-text("연결됨")')).toBeVisible()

      // 이메일 수신 시뮬레이션
      await simulateEmailReceive(page, testEmail)

      // === 4단계: 이메일 처리 확인 ===
      // 이메일 로그에서 수신 확인
      await page.click('button[role="tab"]:has-text("이메일 로그")')

      // 새로운 이메일 로그 확인 (최대 30초 대기)
      await expect(page.locator(`tr:has-text("${testEmail.messageId}")`)).toBeVisible({ timeout: 30000 })

      // 처리 상태 확인
      const emailRow = page.locator(`tr:has-text("${testEmail.messageId}")`)
      await expect(emailRow.locator('.badge')).toContainText(/처리완료|매칭완료/)

      // 업체 매칭 확인
      await expect(emailRow).toContainText(companyData.name)

      // === 5단계: 알림 발송 확인 ===
      await page.click('button[role="tab"]:has-text("알림 로그")')

      // SMS 알림 발송 확인
      const smsNotification = page.locator(`tr:has-text("${companyData.contactPhone}"):has-text("SMS")`)
      await expect(smsNotification).toBeVisible({ timeout: 30000 })
      await expect(smsNotification.locator('.badge')).toContainText(/전송완료|전송중/)

      // 카카오톡 알림 발송 확인
      const kakaoNotification = page.locator(`tr:has-text("${companyData.contactPhone}"):has-text("카카오")`)
      await expect(kakaoNotification).toBeVisible({ timeout: 30000 })

      // === 6단계: 납기일 계산 확인 ===
      await page.goto('/delivery-rules')
      await page.click('button:has-text("납기일 계산")')

      // 계산 정보 입력
      await page.selectOption('select[name="region"]', '서울')
      await page.fill('input[name="orderDate"]', new Date().toISOString().split('T')[0])
      await page.selectOption('select[name="orderTime"]', '오전')

      await page.click('button:has-text("계산")')

      // 납기일 결과 확인
      await expect(page.locator('.delivery-result')).toBeVisible()
      await expect(page.locator('.delivery-result')).toContainText(/납기일/)
      await expect(page.locator('.delivery-result')).toContainText(/영업일/)

      // === 7단계: 통계 업데이트 확인 ===
      await page.goto('/')

      // 대시보드 통계 확인
      const emailsTodayElement = page.locator('[data-testid="emails-today"] .stat-value')
      const notificationsTodayElement = page.locator('[data-testid="notifications-today"] .stat-value')

      const emailsToday = parseInt(await emailsTodayElement.textContent() || '0')
      const notificationsToday = parseInt(await notificationsTodayElement.textContent() || '0')

      expect(emailsToday).toBeGreaterThan(0)
      expect(notificationsToday).toBeGreaterThan(0)

      // 최근 활동 확인
      await expect(page.locator('.recent-activity')).toContainText(companyData.name)
      await expect(page.locator('.recent-activity')).toContainText(/이메일 수신|알림 발송/)
    })

    test('should handle unregistered company workflow', async ({ page }) => {
      // === 1단계: 미등록 업체 이메일 수신 ===
      const unregisteredEmail: MockEmail = {
        messageId: 'unreg-workflow-' + Date.now(),
        subject: '[신규업체] 거래 문의 및 발주서',
        from: 'new@unregistered-company.com',
        to: 'order@echomail.com',
        body: `
안녕하세요.

저희는 신규업체 주식회사입니다.
처음으로 귀하와 거래를 희망합니다.

회사 정보:
- 회사명: 신규업체 주식회사
- 담당자: 이신규
- 연락처: 010-8888-8888
- 소재지: 경기도 성남시

발주 내역을 첨부하오니 검토 후 연락 부탁드립니다.

감사합니다.
        `,
        attachments: [
          {
            filename: '발주서_신규업체_20240115.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: 1024 * 30
          }
        ],
        receivedAt: new Date()
      }

      // 실시간 모니터링 활성화
      await page.goto('/logs')
      await page.click('button[role="tab"]:has-text("실시간 모니터링")')
      await page.check('input[name="realTimeMonitoring"]')

      // 이메일 수신 시뮬레이션
      await simulateEmailReceive(page, unregisteredEmail)

      // === 2단계: 미등록 업체 처리 ===
      await page.goto('/companies/unregistered')

      // 미등록 업체 목록에서 확인
      await expect(page.locator(`tr:has-text("new@unregistered-company.com")`)).toBeVisible({ timeout: 30000 })

      const unregisteredRow = page.locator(`tr:has-text("new@unregistered-company.com")`)

      // 추출된 정보 확인
      await expect(unregisteredRow).toContainText('신규업체 주식회사')
      await expect(unregisteredRow).toContainText('이신규')
      await expect(unregisteredRow).toContainText('010-8888-8888')

      // 상세 보기
      await unregisteredRow.click()

      // 상세 정보 확인
      await expect(page.locator('.unregistered-detail')).toBeVisible()
      await expect(page.locator('.extracted-info')).toContainText('신규업체 주식회사')
      await expect(page.locator('.confidence-score')).toContainText(/신뢰도|%/)

      // 추천 액션 확인
      const actions = page.locator('.suggested-actions')
      await expect(actions).toBeVisible()

      // === 3단계: 업체 승인 등록 ===
      await page.click('button:has-text("업체 등록 승인")')

      // 정보 검토 및 수정
      await expect(page.locator('input[name="name"]')).toHaveValue('신규업체 주식회사')
      await expect(page.locator('input[name="email"]')).toHaveValue('new@unregistered-company.com')

      // 지역 정보 입력 (자동 추출되지 않은 경우)
      await page.selectOption('select[name="region"]', '경기')

      // 담당자 정보 확인 및 보완
      await expect(page.locator('input[name="contact.name"]')).toHaveValue('이신규')
      await expect(page.locator('input[name="contact.phone"]')).toHaveValue('010-8888-8888')
      await page.fill('input[name="contact.position"]', '담당자')

      // 알림 설정
      await page.check('input[name="contact.smsEnabled"]')

      // 승인
      await page.click('button:has-text("승인하여 등록")')
      await expect(page.locator('.toast-success')).toContainText('업체가 성공적으로 등록되었습니다')

      // === 4단계: 이메일 상태 업데이트 확인 ===
      await page.goto('/logs')
      await page.click('button[role="tab"]:has-text("이메일 로그")')

      // 이메일 로그에서 상태 업데이트 확인
      const emailLogRow = page.locator(`tr:has-text("${unregisteredEmail.messageId}")`)
      await expect(emailLogRow.locator('.badge')).toContainText(/매칭완료|처리완료/)
      await expect(emailLogRow).toContainText('신규업체 주식회사')

      // === 5단계: 알림 발송 확인 ===
      await page.click('button[role="tab"]:has-text("알림 로그")')

      // 새로 등록된 업체에 알림 발송 확인
      const notification = page.locator(`tr:has-text("010-8888-8888"):has-text("SMS")`)
      await expect(notification).toBeVisible({ timeout: 30000 })
      await expect(notification.locator('.badge')).toContainText(/전송완료|전송중/)
    })

    test('should handle high volume email processing', async ({ page }) => {
      // === 1단계: 여러 업체 준비 ===
      const companies = [
        {
          name: '대량테스트1 주식회사',
          email: 'bulk1@test.com',
          phone: '010-1111-1111'
        },
        {
          name: '대량테스트2 주식회사',
          email: 'bulk2@test.com',
          phone: '010-2222-2222'
        },
        {
          name: '대량테스트3 주식회사',
          email: 'bulk3@test.com',
          phone: '010-3333-3333'
        }
      ]

      // 업체들을 빠르게 등록
      for (const company of companies) {
        await page.goto('/companies')
        await page.click('button:has-text("새 업체 추가")')

        await page.fill('input[name="name"]', company.name)
        await page.fill('input[name="email"]', company.email)
        await page.selectOption('select[name="region"]', '서울')
        await page.fill('input[name="contact.name"]', '담당자')
        await page.fill('input[name="contact.phone"]', company.phone)
        await page.check('input[name="contact.smsEnabled"]')

        await page.click('button:has-text("저장")')
        await expect(page.locator('.toast-success')).toBeVisible()
      }

      // === 2단계: 동시 이메일 수신 시뮬레이션 ===
      await page.goto('/logs')
      await page.click('button[role="tab"]:has-text("실시간 모니터링")')
      await page.check('input[name="realTimeMonitoring"]')

      // 여러 이메일 동시 발송
      const emails = companies.map((company, index) => ({
        messageId: `bulk-test-${index}-${Date.now()}`,
        subject: `[${company.name}] 대량 테스트 발주서`,
        from: company.email,
        to: 'order@echomail.com',
        body: `대량 처리 테스트 이메일 ${index + 1}`,
        receivedAt: new Date()
      }))

      // 동시 전송
      for (const email of emails) {
        await simulateEmailReceive(page, email)
      }

      // === 3단계: 처리 상태 모니터링 ===
      await page.click('button[role="tab"]:has-text("이메일 로그")')

      // 모든 이메일이 처리되었는지 확인 (최대 60초 대기)
      for (const email of emails) {
        await expect(page.locator(`tr:has-text("${email.messageId}")`)).toBeVisible({ timeout: 60000 })
      }

      // 처리 상태 확인
      const processedEmails = page.locator('tbody tr .badge:has-text("처리완료")')
      expect(await processedEmails.count()).toBe(emails.length)

      // === 4단계: 알림 발송 상태 확인 ===
      await page.click('button[role="tab"]:has-text("알림 로그")')

      // 각 업체별 알림 발송 확인
      for (const company of companies) {
        const notification = page.locator(`tr:has-text("${company.phone}")`)
        await expect(notification).toBeVisible({ timeout: 60000 })
      }

      // 총 알림 수 확인
      const totalNotifications = await page.locator('tbody tr').count()
      expect(totalNotifications).toBe(companies.length)

      // === 5단계: 성능 지표 확인 ===
      await page.goto('/')

      // 처리 성능 통계 확인
      const avgProcessingTime = page.locator('[data-testid="avg-processing-time"]')
      if (await avgProcessingTime.isVisible()) {
        const processingTime = parseFloat(await avgProcessingTime.textContent() || '0')
        expect(processingTime).toBeLessThan(10) // 10초 이하 평균 처리 시간
      }

      // 성공률 확인
      const successRate = page.locator('[data-testid="success-rate"]')
      if (await successRate.isVisible()) {
        const rate = parseFloat(await successRate.textContent() || '0')
        expect(rate).toBeGreaterThan(95) // 95% 이상 성공률
      }
    })
  })

  test.describe('Error Recovery and Resilience', () => {
    test('should recover from notification failures gracefully', async ({ page }) => {
      // === 1단계: 업체 등록 ===
      const companyData = {
        name: '복구테스트 주식회사',
        email: 'recovery@test.com',
        phone: '010-7777-7777'
      }

      await page.goto('/companies')
      await page.click('button:has-text("새 업체 추가")')

      await page.fill('input[name="name"]', companyData.name)
      await page.fill('input[name="email"]', companyData.email)
      await page.selectOption('select[name="region"]', '서울')
      await page.fill('input[name="contact.name"]', '복구담당자')
      await page.fill('input[name="contact.phone"]', companyData.phone)
      await page.check('input[name="contact.smsEnabled"]')
      await page.click('button:has-text("저장")')

      // === 2단계: 네트워크 장애 시뮬레이션 ===
      // SMS API 실패 응답 설정
      await page.route('**/api/notifications/sms', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'SMS_GATEWAY_ERROR',
            message: 'SMS gateway temporarily unavailable'
          })
        })
      })

      // === 3단계: 이메일 수신 및 알림 실패 ===
      const testEmail: MockEmail = {
        messageId: 'recovery-test-' + Date.now(),
        subject: '[복구테스트 주식회사] 발주서',
        from: companyData.email,
        to: 'order@echomail.com',
        body: '복구 테스트용 발주서입니다.',
        receivedAt: new Date()
      }

      await page.goto('/logs')
      await page.click('button[role="tab"]:has-text("실시간 모니터링")')
      await page.check('input[name="realTimeMonitoring"]')

      await simulateEmailReceive(page, testEmail)

      // === 4단계: 실패 상태 확인 ===
      await page.click('button[role="tab"]:has-text("알림 로그")')

      // 실패한 알림 확인
      const failedNotification = page.locator(`tr:has-text("${companyData.phone}")`)
      await expect(failedNotification).toBeVisible({ timeout: 30000 })
      await expect(failedNotification.locator('.badge')).toContainText(/실패|오류/)

      // 오류 메시지 확인
      await failedNotification.click()
      await expect(page.locator('.notification-detail')).toContainText('SMS gateway')

      // === 5단계: 수동 재시도 ===
      // 네트워크 복구 시뮬레이션
      await page.unroute('**/api/notifications/sms')
      await page.route('**/api/notifications/sms', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            messageId: 'recovery-sms-' + Date.now()
          })
        })
      })

      // 재시도 버튼 클릭
      await page.click('button:has-text("재시도")')

      // === 6단계: 복구 확인 ===
      // 성공 상태로 변경 확인
      await expect(failedNotification.locator('.badge')).toContainText(/성공|전송완료/, { timeout: 15000 })

      // 재시도 로그 확인
      const retryLog = page.locator('.retry-log')
      if (await retryLog.isVisible()) {
        await expect(retryLog).toContainText(/재시도|복구/)
      }

      // === 7단계: 관리자 알림 확인 ===
      await page.goto('/notifications/admin')

      // 시스템 오류 알림이 있었는지 확인
      const adminNotifications = page.locator('.admin-notification')
      if (await adminNotifications.count() > 0) {
        await expect(adminNotifications.first()).toContainText(/SMS|알림|오류/)
      }
    })

    test('should handle database connection issues', async ({ page }) => {
      // 데이터베이스 연결 오류 시뮬레이션
      await page.route('**/api/**', route => {
        if (Math.random() < 0.3) { // 30% 확률로 실패
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'DATABASE_CONNECTION_ERROR',
              message: 'Database temporarily unavailable'
            })
          })
        } else {
          route.continue()
        }
      })

      await page.goto('/companies')

      // 오류 상태 처리 확인
      const errorMessage = page.locator('.error-message')
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText(/데이터베이스|연결|오류/)

        // 재시도 버튼 확인
        const retryButton = page.locator('button:has-text("다시 시도")')
        await expect(retryButton).toBeVisible()

        // 재시도 클릭
        await retryButton.click()

        // 복구 확인 (여러 번 시도할 수 있음)
        await page.waitForTimeout(2000)
      }

      // 최종적으로 정상 로딩 확인
      await expect(page.locator('table')).toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('Business Continuity Scenarios', () => {
    test('should maintain service during peak hours simulation', async ({ page }) => {
      // 피크 시간대 대량 트래픽 시뮬레이션
      const peakLoadEmails = 20

      // 업체들 미리 등록
      const companies = Array.from({ length: 5 }, (_, i) => ({
        name: `피크테스트${i + 1} 주식회사`,
        email: `peak${i + 1}@test.com`,
        phone: `010-555-${String(i + 1).padStart(4, '0')}`
      }))

      // 빠른 업체 등록
      for (const company of companies) {
        await page.goto('/companies')
        await page.click('button:has-text("새 업체 추가")')
        await page.fill('input[name="name"]', company.name)
        await page.fill('input[name="email"]', company.email)
        await page.selectOption('select[name="region"]', '서울')
        await page.fill('input[name="contact.name"]', '담당자')
        await page.fill('input[name="contact.phone"]', company.phone)
        await page.check('input[name="contact.smsEnabled"]')
        await page.click('button:has-text("저장")')
        await page.waitForTimeout(500) // 빠른 등록
      }

      // 실시간 모니터링 시작
      await page.goto('/logs')
      await page.click('button[role="tab"]:has-text("실시간 모니터링")')
      await page.check('input[name="realTimeMonitoring"]')

      const startTime = Date.now()

      // 대량 이메일 동시 발송
      const emailPromises = Array.from({ length: peakLoadEmails }, (_, i) => {
        const company = companies[i % companies.length]
        return simulateEmailReceive(page, {
          messageId: `peak-load-${i}-${Date.now()}`,
          subject: `[${company.name}] 피크 로드 테스트 ${i + 1}`,
          from: company.email,
          to: 'order@echomail.com',
          body: `피크 시간대 테스트 이메일 ${i + 1}`,
          receivedAt: new Date()
        })
      })

      await Promise.all(emailPromises)

      // 처리 완료까지 시간 측정
      await page.click('button[role="tab"]:has-text("이메일 로그")')

      // 모든 이메일 처리 완료 대기 (최대 2분)
      await expect(page.locator('tbody tr')).toHaveCount(peakLoadEmails, { timeout: 120000 })

      const endTime = Date.now()
      const processingTime = (endTime - startTime) / 1000

      // 성능 기준 확인 (20개 이메일을 60초 내 처리)
      expect(processingTime).toBeLessThan(60)
      console.log(`Peak load processing time: ${processingTime}s for ${peakLoadEmails} emails`)

      // 모든 이메일 처리 성공 확인
      const successfulProcessing = await page.locator('tbody tr .badge:has-text("처리완료")').count()
      expect(successfulProcessing).toBe(peakLoadEmails)

      // 알림 발송 확인
      await page.click('button[role="tab"]:has-text("알림 로그")')
      await expect(page.locator('tbody tr')).toHaveCount(peakLoadEmails, { timeout: 30000 })
    })

    test('should handle system maintenance mode', async ({ page }) => {
      // 점검 모드 활성화
      await page.goto('/settings')
      await page.click('button[role="tab"]:has-text("시스템 관리")')

      await page.check('input[name="maintenanceMode"]')
      await page.fill('textarea[name="maintenanceMessage"]', '시스템 정기 점검 중입니다. 잠시 후 다시 이용해주세요.')
      await page.click('button:has-text("저장")')

      // 점검 페이지로 리디렉션 확인
      await expect(page.locator('.maintenance-page')).toBeVisible()
      await expect(page.locator('.maintenance-message')).toContainText('시스템 정기 점검 중')

      // 관리자 접근 가능 확인
      await page.goto('/admin/override')
      await expect(page.locator('h1')).toContainText('관리자 모드')

      // 점검 모드 해제
      await page.goto('/settings')
      await page.uncheck('input[name="maintenanceMode"]')
      await page.click('button:has-text("저장")')

      // 정상 서비스 복구 확인
      await page.goto('/')
      await expect(page.locator('h1')).toContainText('Echo Mail')
    })
  })

  test.describe('Data Integrity and Audit Trail', () => {
    test('should maintain complete audit trail', async ({ page }) => {
      const testCompany = {
        name: '감사추적 테스트 주식회사',
        email: 'audit@test.com',
        phone: '010-1234-1234'
      }

      // === 1단계: 업체 생성 감사 ===
      await page.goto('/companies')
      await page.click('button:has-text("새 업체 추가")')

      await page.fill('input[name="name"]', testCompany.name)
      await page.fill('input[name="email"]', testCompany.email)
      await page.selectOption('select[name="region"]', '서울')
      await page.fill('input[name="contact.name"]', '감사담당자')
      await page.fill('input[name="contact.phone"]', testCompany.phone)
      await page.click('button:has-text("저장")')

      // 감사 로그 확인
      await page.goto('/logs')
      await page.click('button[role="tab"]:has-text("감사 로그")')

      const createLog = page.locator('tr:has-text("업체 생성"):has-text("감사추적 테스트")')
      await expect(createLog).toBeVisible()
      await expect(createLog).toContainText(/admin@echomail.com|관리자/)

      // === 2단계: 업체 수정 감사 ===
      await page.goto('/companies')
      const companyRow = page.locator('tr:has-text("감사추적 테스트 주식회사")')
      await companyRow.locator('button[aria-label="편집"]').click()

      await page.fill('input[name="name"]', '감사추적 테스트 (수정됨) 주식회사')
      await page.click('button:has-text("저장")')

      // 수정 감사 로그 확인
      await page.goto('/logs')
      await page.click('button[role="tab"]:has-text("감사 로그")')

      const updateLog = page.locator('tr:has-text("업체 수정"):has-text("감사추적")')
      await expect(updateLog).toBeVisible()

      // 변경 사항 상세 확인
      await updateLog.click()
      const changeDetails = page.locator('.audit-detail')
      await expect(changeDetails).toContainText('name')
      await expect(changeDetails).toContainText('감사추적 테스트 주식회사')
      await expect(changeDetails).toContainText('감사추적 테스트 (수정됨) 주식회사')

      // === 3단계: 이메일 처리 감사 ===
      const testEmail: MockEmail = {
        messageId: 'audit-test-' + Date.now(),
        subject: '[감사추적 테스트 (수정됨) 주식회사] 발주서',
        from: testCompany.email,
        to: 'order@echomail.com',
        body: '감사 추적 테스트용 이메일입니다.',
        receivedAt: new Date()
      }

      await simulateEmailReceive(page, testEmail)

      // 이메일 처리 감사 로그 확인
      await page.click('button[role="tab"]:has-text("감사 로그")')

      const emailLog = page.locator('tr:has-text("이메일 처리"):has-text("audit-test")')
      await expect(emailLog).toBeVisible({ timeout: 30000 })

      // === 4단계: 알림 발송 감사 ===
      const notificationLog = page.locator('tr:has-text("알림 발송"):has-text("010-1234-1234")')
      await expect(notificationLog).toBeVisible({ timeout: 30000 })

      // === 5단계: 데이터 일관성 검증 ===
      // 업체 삭제 시도
      await page.goto('/companies')
      const modifiedCompanyRow = page.locator('tr:has-text("감사추적 테스트 (수정됨) 주식회사")')
      await modifiedCompanyRow.locator('button[aria-label="삭제"]').click()
      await page.click('button:has-text("삭제")')

      // 삭제 감사 로그 확인
      await page.goto('/logs')
      await page.click('button[role="tab"]:has-text("감사 로그")')

      const deleteLog = page.locator('tr:has-text("업체 삭제"):has-text("감사추적")')
      await expect(deleteLog).toBeVisible()

      // 관련 데이터 정리 확인
      await expect(deleteLog).toContainText('관련 데이터 2건 정리') // 이메일 로그, 알림 로그
    })

    test('should enforce data retention policies', async ({ page }) => {
      // 데이터 보존 정책 설정
      await page.goto('/settings')
      await page.click('button[role="tab"]:has-text("데이터 관리")')

      // 보존 기간 설정
      await page.selectOption('select[name="emailLogRetention"]', '90') // 90일
      await page.selectOption('select[name="notificationLogRetention"]', '90') // 90일
      await page.selectOption('select[name="auditLogRetention"]', '365') // 1년

      await page.click('button:has-text("저장")')

      // 자동 정리 작업 실행
      await page.click('button:has-text("데이터 정리 실행")')

      // 진행 상태 확인
      await expect(page.locator('.cleanup-progress')).toBeVisible()
      await expect(page.locator('.cleanup-progress')).not.toBeVisible({ timeout: 30000 })

      // 정리 결과 확인
      await expect(page.locator('.cleanup-result')).toBeVisible()
      await expect(page.locator('.cleanup-result')).toContainText(/정리 완료|보존 기간/)

      // 정리 감사 로그 생성 확인
      await page.goto('/logs')
      await page.click('button[role="tab"]:has-text("감사 로그")')

      const cleanupLog = page.locator('tr:has-text("데이터 정리")')
      await expect(cleanupLog).toBeVisible()
    })
  })
})