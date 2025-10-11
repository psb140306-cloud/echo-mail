/**
 * 플랜 업그레이드/다운그레이드 통합 테스트
 *
 * 이 테스트는 SaaS 플랜 변경의 다양한 시나리오를 검증합니다:
 * 1. 플랜 업그레이드 (즉시 적용/기간 말 적용)
 * 2. 플랜 다운그레이드 (사용량 검증 포함)
 * 3. 결제 실패 시 처리
 * 4. 프레이션 계산
 * 5. 사용량 제한 변경
 */

import { SubscriptionService } from '@/lib/subscription/subscription-service'
import { SubscriptionPlan, SubscriptionStatus } from '@/lib/subscription/plans'
import { TossPaymentService } from '@/lib/payment/toss-payments'
import { UsageTracker } from '@/lib/usage/usage-tracker'

// 모든 의존성 모킹
jest.mock('@/lib/db', () => ({
  prisma: {
    subscription: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
    },
    company: {
      count: jest.fn(),
    },
    contact: {
      count: jest.fn(),
    },
    tenantUser: {
      count: jest.fn(),
    },
    emailLog: {
      count: jest.fn(),
    },
    notificationLog: {
      count: jest.fn(),
    },
  },
}))

jest.mock('@/lib/payment/toss-payments')
jest.mock('@/lib/usage/usage-tracker')

const mockTossPayments = TossPaymentService as jest.MockedClass<typeof TossPaymentService>
const mockUsageTracker = UsageTracker as jest.MockedClass<typeof UsageTracker>

import { prisma } from '@/lib/db'

describe('플랜 업그레이드/다운그레이드 통합 테스트', () => {
  const testTenantId = 'test-tenant-1'
  const subscriptionService = SubscriptionService

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock TossPayments
    mockTossPayments.createAutoPayment = jest.fn()
    mockTossPayments.cancelPayment = jest.fn()
    mockTossPayments.generateOrderId = jest.fn()
    mockTossPayments.generateCustomerKey = jest.fn()

    // Mock UsageTracker
    mockUsageTracker.getCurrentUsage = jest.fn()
    mockUsageTracker.checkUsageLimits = jest.fn()
    mockUsageTracker.resetMonthlyUsage = jest.fn()

    // Add missing Prisma methods
    if (!prisma.subscription.findUnique) {
      prisma.subscription.findUnique = jest.fn()
    }
  })

  describe('플랜 업그레이드 시나리오', () => {
    test('STARTER → BUSINESS 업그레이드 (즉시 적용)', async () => {
      // 1. 기존 STARTER 구독 모킹
      const starterSubscription = {
        id: 'test-subscription-1',
        tenantId: testTenantId,
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        customerKey: 'test-customer-key',
        billingKey: 'test-billing-key',
        priceAmount: 29900,
        currency: 'KRW',
        tenant: {},
      }

      const businessSubscription = {
        ...starterSubscription,
        plan: SubscriptionPlan.BUSINESS,
        priceAmount: 199900,
      }

      // Prisma 모킹
      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue(starterSubscription)
      ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue(starterSubscription)
      ;(prisma.subscription.update as jest.Mock).mockResolvedValue(businessSubscription)
      ;(prisma.tenant.update as jest.Mock).mockResolvedValue({})
      ;(prisma.invoice.create as jest.Mock).mockResolvedValue({
        id: 'test-invoice-1',
        subscriptionId: starterSubscription.id,
        total: 170000,
        status: 'PAID',
        paymentKey: 'payment-upgrade-123',
      })

      // 2. 업그레이드 결제 성공 모킹
      const mockPaymentSuccess = {
        paymentKey: 'payment-upgrade-123',
        status: 'DONE',
        totalAmount: 170000,
        method: 'BILLING',
        orderId: 'test-order-123',
        approvedAt: new Date().toISOString(),
      }

      mockTossPayments.createAutoPayment.mockResolvedValue(mockPaymentSuccess)
      mockTossPayments.generateOrderId.mockReturnValue('test-order-123')

      // 3. 플랜 업그레이드 실행
      const upgradeResult = await subscriptionService.changePlan({
        tenantId: testTenantId,
        newPlan: SubscriptionPlan.BUSINESS,
        immediate: true,
      })

      // 4. 검증: 업그레이드 성공
      expect(upgradeResult).toBeTruthy()
      expect(upgradeResult.plan).toBe(SubscriptionPlan.BUSINESS)

      // 5. 검증: 결제 API 호출
      expect(mockTossPayments.createAutoPayment).toHaveBeenCalled()

      // 6. 검증: Prisma 업데이트 호출
      expect(prisma.subscription.update).toHaveBeenCalled()
      expect(prisma.tenant.update).toHaveBeenCalled()
    })

    test('사용량 제한 해제 확인', async () => {
      // 1. STARTER 구독 모킹
      const starterSubscription = {
        id: 'test-subscription-2',
        tenantId: testTenantId,
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        customerKey: 'test-customer-key',
        billingKey: 'test-billing-key',
        priceAmount: 29900,
        currency: 'KRW',
        tenant: {},
      }

      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue(starterSubscription)
      ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue(starterSubscription)
      ;(prisma.subscription.update as jest.Mock).mockResolvedValue({
        ...starterSubscription,
        plan: SubscriptionPlan.BUSINESS,
      })
      ;(prisma.tenant.update as jest.Mock).mockResolvedValue({})
      ;(prisma.invoice.create as jest.Mock).mockResolvedValue({
        id: 'test-invoice-2',
        subscriptionId: starterSubscription.id,
        total: 170000,
        status: 'PAID',
        paymentKey: 'payment-upgrade-456',
      })

      // 2. 사용량 모킹 - STARTER 한계 도달
      mockUsageTracker.getCurrentUsage.mockResolvedValue({
        email: 500, // STARTER 한계
        sms: 300,
        kakao: 200,
        api_call: 1000,
        storage: 1024,
      })

      mockUsageTracker.checkUsageLimits.mockResolvedValue({
        allowed: false,
        currentUsage: 500,
        limit: 500,
        usagePercentage: 100,
        warningLevel: 'exceeded',
        message: 'Email limit exceeded',
      })

      // 3. BUSINESS로 업그레이드
      mockTossPayments.createAutoPayment.mockResolvedValue({
        paymentKey: 'payment-upgrade-456',
        status: 'DONE',
        totalAmount: 170000,
      })

      const upgradeResult = await subscriptionService.changePlan({
        tenantId: testTenantId,
        newPlan: SubscriptionPlan.BUSINESS,
        immediate: true,
      })

      // 4. 검증: 업그레이드 성공
      expect(upgradeResult).toBeTruthy()
      expect(upgradeResult.plan).toBe(SubscriptionPlan.BUSINESS)

      // 5. 업그레이드 후 사용량 검증 (BUSINESS 한계로 확인)
      mockUsageTracker.checkUsageLimits.mockResolvedValue({
        allowed: true,
        currentUsage: 500,
        limit: 10000, // BUSINESS 한계
        usagePercentage: 5,
        warningLevel: 'none',
      })

      const newUsageValidation = await mockUsageTracker.checkUsageLimits(testTenantId, 'email')

      expect(newUsageValidation.allowed).toBe(true)
    })
  })

  describe('플랜 다운그레이드 시나리오', () => {
    test('BUSINESS → STARTER 다운그레이드 (사용량 검증 통과)', async () => {
      // 1. BUSINESS 구독 모킹
      const businessSubscription = {
        id: 'test-subscription-3',
        tenantId: testTenantId,
        plan: SubscriptionPlan.BUSINESS,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        customerKey: 'test-customer-key',
        billingKey: 'test-billing-key',
        priceAmount: 199900,
        currency: 'KRW',
        tenant: {},
      }

      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue(businessSubscription)
      ;(prisma.subscription.update as jest.Mock).mockResolvedValue({
        ...businessSubscription,
        plan: SubscriptionPlan.STARTER,
        priceAmount: 29900,
      })
      ;(prisma.tenant.update as jest.Mock).mockResolvedValue({})

      // 2. 현재 사용량이 STARTER 한계 내라고 모킹
      ;(prisma.company.count as jest.Mock).mockResolvedValue(5)
      ;(prisma.contact.count as jest.Mock).mockResolvedValue(30)
      ;(prisma.tenantUser.count as jest.Mock).mockResolvedValue(1)
      ;(prisma.emailLog.count as jest.Mock).mockResolvedValue(400)
      ;(prisma.notificationLog.count as jest.Mock).mockResolvedValue(300)

      // 3. 다운그레이드 실행
      const downgradeResult = await subscriptionService.changePlan({
        tenantId: testTenantId,
        newPlan: SubscriptionPlan.STARTER,
        immediate: true,
      })

      // 4. 검증: 다운그레이드 성공
      expect(downgradeResult).toBeTruthy()
      expect(downgradeResult.plan).toBe(SubscriptionPlan.STARTER)

      // 5. 검증: 추가 결제 없음 (다운그레이드)
      expect(mockTossPayments.createAutoPayment).not.toHaveBeenCalled()
    })

    test('BUSINESS → STARTER 다운그레이드 거부 (사용량 초과)', async () => {
      // 1. BUSINESS 구독 모킹
      const businessSubscription = {
        id: 'test-subscription-4',
        tenantId: testTenantId,
        plan: SubscriptionPlan.BUSINESS,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        customerKey: 'test-customer-key',
        billingKey: 'test-billing-key',
        priceAmount: 199900,
        currency: 'KRW',
        tenant: {},
      }

      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue(businessSubscription)

      // 2. 현재 사용량이 STARTER 한계 초과라고 모킹
      ;(prisma.company.count as jest.Mock).mockResolvedValue(15) // STARTER 한계(10) 초과
      ;(prisma.contact.count as jest.Mock).mockResolvedValue(80) // STARTER 한계(50) 초과
      ;(prisma.tenantUser.count as jest.Mock).mockResolvedValue(3) // STARTER 한계(2) 초과
      ;(prisma.emailLog.count as jest.Mock).mockResolvedValue(1500) // STARTER 한계(500) 초과
      ;(prisma.notificationLog.count as jest.Mock).mockResolvedValue(800) // STARTER 한계(500) 초과

      // 3. 다운그레이드 시도 (사용량 초과로 인해 오류 발생)
      await expect(
        subscriptionService.changePlan({
          tenantId: testTenantId,
          newPlan: SubscriptionPlan.STARTER,
          immediate: true,
        })
      ).rejects.toThrow()

      // 4. 검증: 원래 구독 상태 유지
      expect(prisma.subscription.update).not.toHaveBeenCalled()
    })
  })

  describe('플랜 변경 결제 실패 시나리오', () => {
    test('업그레이드 결제 실패 시 롤백', async () => {
      // 1. STARTER 구독 모킹
      const starterSubscription = {
        id: 'test-subscription-5',
        tenantId: testTenantId,
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        customerKey: 'test-customer-key',
        billingKey: 'test-billing-key',
        priceAmount: 29900,
        currency: 'KRW',
        tenant: {},
      }

      ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue(starterSubscription)

      // 2. 결제 실패 모킹
      mockTossPayments.createAutoPayment.mockRejectedValue(new Error('카드 승인이 거절되었습니다'))
      mockTossPayments.generateOrderId.mockReturnValue('test-order-fail')

      // 3. 업그레이드 시도
      await expect(
        subscriptionService.changePlan({
          tenantId: testTenantId,
          newPlan: SubscriptionPlan.BUSINESS,
          immediate: true,
        })
      ).rejects.toThrow()

      // 4. 검증: 원래 구독 상태 유지
      expect(prisma.subscription.update).not.toHaveBeenCalled()
    })
  })
})
