import { UsageTracker, UsageType, UsageLimitCheck } from '@/lib/usage/usage-tracker'
import { SubscriptionPlan, PLAN_LIMITS } from '@/lib/subscription/plans'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'

jest.mock('@/lib/db', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn(),
    },
    tenantUser: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/redis', () => ({
  redis: {
    pipeline: jest.fn(),
    get: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
    setex: jest.fn(),
    incrby: jest.fn(),
    expire: jest.fn(),
    set: jest.fn(),
    lpush: jest.fn(),
    ltrim: jest.fn(),
  },
}))

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('UsageTracker', () => {
  const mockRedis = redis as jest.Mocked<typeof redis>
  const mockPipeline = {
    incrby: jest.fn(),
    expire: jest.fn(),
    set: jest.fn(),
    exec: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockRedis.pipeline.mockReturnValue(mockPipeline as any)
    mockPipeline.exec.mockResolvedValue([])
  })

  describe('사용량 증가 (incrementUsage)', () => {
    test('이메일 사용량을 증가시킬 수 있음', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.EMAIL
      const amount = 5

      await UsageTracker.incrementUsage(tenantId, usageType, amount)

      expect(mockRedis.pipeline).toHaveBeenCalled()
      expect(mockPipeline.incrby).toHaveBeenCalledTimes(3) // daily, monthly, total
      expect(mockPipeline.expire).toHaveBeenCalledTimes(3) // daily, monthly, last_activity
      expect(mockPipeline.set).toHaveBeenCalledWith(
        expect.stringContaining('last_activity'),
        expect.any(Number)
      )
      expect(mockPipeline.exec).toHaveBeenCalled()
    })

    test('SMS 사용량을 메타데이터와 함께 증가시킬 수 있음', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.SMS
      const amount = 1
      const metadata = { phoneNumber: '+82-10-1234-5678', message: 'Test SMS' }

      mockRedis.lpush.mockResolvedValue(1)
      mockRedis.ltrim.mockResolvedValue('OK')
      mockRedis.expire.mockResolvedValue(1)

      await UsageTracker.incrementUsage(tenantId, usageType, amount, metadata)

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        expect.stringContaining('metadata'),
        expect.stringContaining(JSON.stringify(metadata))
      )
      expect(mockRedis.ltrim).toHaveBeenCalledWith(expect.stringContaining('metadata'), 0, 99)
      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.stringContaining('metadata'),
        30 * 24 * 60 * 60
      )
    })

    test('API 호출 사용량을 추적할 수 있음', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.API_CALL
      const metadata = { endpoint: '/api/companies', method: 'GET' }

      await UsageTracker.incrementUsage(tenantId, usageType, 1, metadata)

      expect(mockRedis.pipeline).toHaveBeenCalled()
      expect(mockPipeline.incrby).toHaveBeenCalledWith(expect.stringContaining('api_call'), 1)
    })

    test('카카오톡 사용량을 추적할 수 있음', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.KAKAO
      const amount = 3
      const metadata = { templateId: 'welcome', recipients: 3 }

      await UsageTracker.incrementUsage(tenantId, usageType, amount, metadata)

      expect(mockRedis.pipeline).toHaveBeenCalled()
      expect(mockPipeline.incrby).toHaveBeenCalledWith(expect.stringContaining('kakao'), amount)
    })

    test('스토리지 사용량을 바이트 단위로 추적할 수 있음', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.STORAGE
      const amount = 1024 * 1024 // 1MB
      const metadata = { fileType: 'attachment', fileName: 'document.pdf' }

      await UsageTracker.incrementUsage(tenantId, usageType, amount, metadata)

      expect(mockRedis.pipeline).toHaveBeenCalled()
      expect(mockPipeline.incrby).toHaveBeenCalledWith(expect.stringContaining('storage'), amount)
    })
  })

  describe('현재 사용량 조회 (getCurrentUsage)', () => {
    test('월별 사용량을 조회할 수 있음', async () => {
      const tenantId = 'tenant-123'

      mockRedis.get
        .mockResolvedValueOnce('150') // email
        .mockResolvedValueOnce('25') // sms
        .mockResolvedValueOnce('10') // kakao
        .mockResolvedValueOnce('500') // api_call
        .mockResolvedValueOnce('1048576') // storage (1MB)

      const usage = await UsageTracker.getCurrentUsage(tenantId)

      expect(usage).toEqual({
        email: 150,
        sms: 25,
        kakao: 10,
        api_call: 500,
        storage: 1048576,
      })

      expect(mockRedis.get).toHaveBeenCalledTimes(5)
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringMatching(/usage:tenant-123:(email|sms|kakao|api_call|storage):\d{4}-\d{2}/)
      )
    })

    test('일별 사용량을 조회할 수 있음', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.EMAIL

      mockRedis.get.mockResolvedValue('50')

      const usage = await UsageTracker.getCurrentUsage(tenantId, usageType, 'day')

      expect(usage).toEqual({ email: 50 })
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringMatching(/usage:tenant-123:email:\d{4}-\d{2}-\d{2}/)
      )
    })

    test('전체 사용량을 조회할 수 있음', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.SMS

      mockRedis.get.mockResolvedValue('1000')

      const usage = await UsageTracker.getCurrentUsage(tenantId, usageType, 'total')

      expect(usage).toEqual({ sms: 1000 })
      expect(mockRedis.get).toHaveBeenCalledWith('usage:tenant-123:sms:total')
    })

    test('사용량이 없는 경우 0을 반환함', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.EMAIL

      mockRedis.get.mockResolvedValue(null)

      const usage = await UsageTracker.getCurrentUsage(tenantId, usageType)

      expect(usage).toEqual({ email: 0 })
    })
  })

  describe('사용량 제한 체크 (checkUsageLimits)', () => {
    test('무료 체험 플랜의 이메일 제한을 체크함', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.EMAIL

      const mockTenant = {
        id: tenantId,
        subscriptionPlan: SubscriptionPlan.FREE_TRIAL,
        maxEmails: PLAN_LIMITS[SubscriptionPlan.FREE_TRIAL].maxEmailsPerMonth,
        maxNotifications: PLAN_LIMITS[SubscriptionPlan.FREE_TRIAL].maxNotificationsPerMonth,
      }

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)
      mockRedis.get.mockResolvedValue('80') // 현재 사용량 80건

      const result = await UsageTracker.checkUsageLimits(tenantId, usageType)

      expect(result).toEqual({
        allowed: true,
        currentUsage: 80,
        limit: 100, // FREE_TRIAL 이메일 제한
        usagePercentage: 80,
        warningLevel: 'warning', // 80% 도달
        message: expect.stringContaining('80%에 도달했습니다'),
      })
    })

    test('프로페셔널 플랜의 SMS 제한을 체크함', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.SMS

      const mockTenant = {
        id: tenantId,
        subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
        maxEmails: PLAN_LIMITS[SubscriptionPlan.PROFESSIONAL].maxEmailsPerMonth,
        maxNotifications: PLAN_LIMITS[SubscriptionPlan.PROFESSIONAL].maxNotificationsPerMonth,
      }

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)
      mockRedis.get.mockResolvedValue('1900') // 현재 사용량 1900건

      const result = await UsageTracker.checkUsageLimits(tenantId, usageType)

      expect(result).toEqual({
        allowed: true,
        currentUsage: 1900,
        limit: 2000, // PROFESSIONAL 알림 제한
        usagePercentage: 95,
        warningLevel: 'critical', // 95% 도달
        message: expect.stringContaining('95%에 도달했습니다'),
      })
    })

    test('사용량이 제한을 초과한 경우', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.EMAIL

      const mockTenant = {
        id: tenantId,
        subscriptionPlan: SubscriptionPlan.STARTER,
        maxEmails: PLAN_LIMITS[SubscriptionPlan.STARTER].maxEmailsPerMonth,
        maxNotifications: PLAN_LIMITS[SubscriptionPlan.STARTER].maxNotificationsPerMonth,
      }

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)
      mockRedis.get.mockResolvedValue('600') // 500 제한 초과

      const result = await UsageTracker.checkUsageLimits(tenantId, usageType)

      expect(result).toEqual({
        allowed: false,
        currentUsage: 600,
        limit: 500, // STARTER 이메일 제한
        usagePercentage: 100,
        warningLevel: 'exceeded',
        message: expect.stringContaining('한도(500)를 초과했습니다'),
      })
    })

    test('엔터프라이즈 플랜은 무제한 사용 가능', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.EMAIL

      const mockTenant = {
        id: tenantId,
        subscriptionPlan: SubscriptionPlan.ENTERPRISE,
        maxEmails: PLAN_LIMITS[SubscriptionPlan.ENTERPRISE].maxEmailsPerMonth,
        maxNotifications: PLAN_LIMITS[SubscriptionPlan.ENTERPRISE].maxNotificationsPerMonth,
      }

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)
      mockRedis.get.mockResolvedValue('50000') // 높은 사용량

      const result = await UsageTracker.checkUsageLimits(tenantId, usageType)

      expect(result).toEqual({
        allowed: true,
        currentUsage: 50000,
        limit: Number.MAX_SAFE_INTEGER, // 무제한
        usagePercentage: expect.any(Number),
        warningLevel: 'none',
        message: undefined,
      })
    })

    test('API 액세스가 없는 플랜은 API 호출 제한됨', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.API_CALL

      const mockTenant = {
        id: tenantId,
        subscriptionPlan: SubscriptionPlan.STARTER, // API 액세스 없음
        maxEmails: PLAN_LIMITS[SubscriptionPlan.STARTER].maxEmailsPerMonth,
        maxNotifications: PLAN_LIMITS[SubscriptionPlan.STARTER].maxNotificationsPerMonth,
      }

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)
      mockRedis.get.mockResolvedValue('1')

      const result = await UsageTracker.checkUsageLimits(tenantId, usageType)

      expect(result).toEqual({
        allowed: false,
        currentUsage: 1,
        limit: 0, // API 액세스 없음
        usagePercentage: 100,
        warningLevel: 'exceeded',
        message: expect.stringContaining('한도(0)를 초과했습니다'),
      })
    })

    test('API 액세스가 있는 플랜은 API 호출 가능', async () => {
      const tenantId = 'tenant-123'
      const usageType = UsageType.API_CALL

      const mockTenant = {
        id: tenantId,
        subscriptionPlan: SubscriptionPlan.PROFESSIONAL, // API 액세스 있음
        maxEmails: PLAN_LIMITS[SubscriptionPlan.PROFESSIONAL].maxEmailsPerMonth,
        maxNotifications: PLAN_LIMITS[SubscriptionPlan.PROFESSIONAL].maxNotificationsPerMonth,
      }

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)
      mockRedis.get.mockResolvedValue('5000')

      const result = await UsageTracker.checkUsageLimits(tenantId, usageType)

      expect(result).toEqual({
        allowed: true,
        currentUsage: 5000,
        limit: 10000, // API 액세스 있음 (월 10,000회)
        usagePercentage: 50,
        warningLevel: 'none',
        message: undefined,
      })
    })

    test('테넌트가 존재하지 않는 경우', async () => {
      const tenantId = 'nonexistent-tenant'
      const usageType = UsageType.EMAIL

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await UsageTracker.checkUsageLimits(tenantId, usageType)

      expect(result).toEqual({
        allowed: false,
        currentUsage: 0,
        limit: 0,
        usagePercentage: 100,
        warningLevel: 'exceeded',
        message: '테넌트를 찾을 수 없습니다.',
      })
    })
  })

  describe('일괄 사용량 제한 체크 (checkAllUsageLimits)', () => {
    test('모든 사용량 타입을 한 번에 체크할 수 있음', async () => {
      const tenantId = 'tenant-123'

      const mockTenant = {
        id: tenantId,
        subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
        maxEmails: PLAN_LIMITS[SubscriptionPlan.PROFESSIONAL].maxEmailsPerMonth,
        maxNotifications: PLAN_LIMITS[SubscriptionPlan.PROFESSIONAL].maxNotificationsPerMonth,
      }

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)

      // 각 사용량 타입별로 다른 값 반환
      mockRedis.get
        .mockResolvedValueOnce('1500') // email
        .mockResolvedValueOnce('800') // sms
        .mockResolvedValueOnce('200') // kakao
        .mockResolvedValueOnce('5000') // api_call
        .mockResolvedValueOnce('500000000') // storage

      const results = await UsageTracker.checkAllUsageLimits(tenantId)

      expect(Object.keys(results)).toEqual(Object.values(UsageType))
      expect(results[UsageType.EMAIL].currentUsage).toBe(1500)
      expect(results[UsageType.SMS].currentUsage).toBe(800)
      expect(results[UsageType.KAKAO].currentUsage).toBe(200)
      expect(results[UsageType.API_CALL].currentUsage).toBe(5000)
      expect(results[UsageType.STORAGE].currentUsage).toBe(500000000)
    })
  })

  describe('사용량 통계 조회 (getUsageStats)', () => {
    test('기간별 사용량 통계를 조회할 수 있음', async () => {
      const tenantId = 'tenant-123'
      const startMonth = '2024-01'
      const endMonth = '2024-03'

      // 3개월간의 데이터 모킹
      const mockUsageData = [
        // 2024-01
        '100',
        '20',
        '10',
        '1000',
        '1000000',
        // 2024-02
        '150',
        '30',
        '15',
        '1500',
        '2000000',
        // 2024-03
        '200',
        '40',
        '20',
        '2000',
        '3000000',
      ]

      let callCount = 0
      mockRedis.get.mockImplementation(() => {
        return Promise.resolve(mockUsageData[callCount++] || '0')
      })

      const stats = await UsageTracker.getUsageStats(tenantId, startMonth, endMonth)

      expect(stats).toHaveLength(3)
      expect(stats[0].period).toBe('2024-03') // 최신순 정렬
      expect(stats[0].email).toBe(200)
      expect(stats[0].sms).toBe(40)
      expect(stats[0].kakao).toBe(20)
      expect(stats[0].apiCall).toBe(2000)
      expect(stats[0].storage).toBe(3000000)

      expect(stats[2].period).toBe('2024-01') // 가장 오래된 데이터
      expect(stats[2].email).toBe(100)
    })

    test('기본 기간(6개월)으로 통계를 조회할 수 있음', async () => {
      const tenantId = 'tenant-123'

      mockRedis.get.mockResolvedValue('100')

      const stats = await UsageTracker.getUsageStats(tenantId)

      expect(stats).toHaveLength(6) // 6개월
      expect(stats.every((stat) => stat.tenantId === tenantId)).toBe(true)
    })
  })

  describe('사용량 초기화 및 삭제', () => {
    test('월별 사용량을 초기화할 수 있음', async () => {
      const tenantId = 'tenant-123'

      mockRedis.del.mockResolvedValue(5) // 5개 키 삭제됨

      await UsageTracker.resetMonthlyUsage(tenantId)

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringMatching(/usage:tenant-123:(email|sms|kakao|api_call|storage):\d{4}-\d{2}/),
        expect.stringMatching(/usage:tenant-123:(email|sms|kakao|api_call|storage):\d{4}-\d{2}/),
        expect.stringMatching(/usage:tenant-123:(email|sms|kakao|api_call|storage):\d{4}-\d{2}/),
        expect.stringMatching(/usage:tenant-123:(email|sms|kakao|api_call|storage):\d{4}-\d{2}/),
        expect.stringMatching(/usage:tenant-123:(email|sms|kakao|api_call|storage):\d{4}-\d{2}/)
      )
    })

    test('전체 사용량을 삭제할 수 있음', async () => {
      const tenantId = 'tenant-123'
      const mockKeys = [
        'usage:tenant-123:email:2024-01',
        'usage:tenant-123:sms:2024-01',
        'usage:tenant-123:total',
        'usage:tenant-123:last_activity',
      ]

      mockRedis.keys.mockResolvedValue(mockKeys)
      mockRedis.del.mockResolvedValue(mockKeys.length)

      await UsageTracker.deleteAllUsage(tenantId)

      expect(mockRedis.keys).toHaveBeenCalledWith('usage:tenant-123:*')
      expect(mockRedis.del).toHaveBeenCalledWith(...mockKeys)
    })

    test('삭제할 키가 없는 경우 오류가 발생하지 않음', async () => {
      const tenantId = 'tenant-123'

      mockRedis.keys.mockResolvedValue([])

      await expect(UsageTracker.deleteAllUsage(tenantId)).resolves.not.toThrow()
      expect(mockRedis.del).not.toHaveBeenCalled()
    })
  })

  describe('편의 함수들', () => {
    test('trackEmailUsage 함수가 올바르게 동작함', async () => {
      const tenantId = 'tenant-123'
      const count = 10

      const { trackEmailUsage } = await import('@/lib/usage/usage-tracker')
      await trackEmailUsage(tenantId, count)

      expect(mockRedis.pipeline).toHaveBeenCalled()
      expect(mockPipeline.incrby).toHaveBeenCalledWith(expect.stringContaining('email'), count)
    })

    test('trackSMSUsage 함수가 메타데이터와 함께 동작함', async () => {
      const tenantId = 'tenant-123'
      const count = 1
      const metadata = { phoneNumber: '+82-10-1234-5678' }

      mockRedis.lpush.mockResolvedValue(1)
      mockRedis.ltrim.mockResolvedValue('OK')
      mockRedis.expire.mockResolvedValue(1)

      const { trackSMSUsage } = await import('@/lib/usage/usage-tracker')
      await trackSMSUsage(tenantId, count, metadata)

      expect(mockRedis.lpush).toHaveBeenCalled()
    })

    test('trackKakaoUsage 함수가 올바르게 동작함', async () => {
      const tenantId = 'tenant-123'
      const count = 3
      const metadata = { templateId: 'welcome' }

      const { trackKakaoUsage } = await import('@/lib/usage/usage-tracker')
      await trackKakaoUsage(tenantId, count, metadata)

      expect(mockRedis.pipeline).toHaveBeenCalled()
    })

    test('trackAPIUsage 함수가 엔드포인트 정보와 함께 동작함', async () => {
      const tenantId = 'tenant-123'
      const endpoint = '/api/companies'

      const { trackAPIUsage } = await import('@/lib/usage/usage-tracker')
      await trackAPIUsage(tenantId, endpoint)

      expect(mockRedis.pipeline).toHaveBeenCalled()
    })

    test('checkEmailLimit 함수가 올바르게 동작함', async () => {
      const tenantId = 'tenant-123'

      const mockTenant = {
        id: tenantId,
        subscriptionPlan: SubscriptionPlan.STARTER,
        maxEmails: 500,
        maxNotifications: 500,
      }

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)
      mockRedis.get.mockResolvedValue('300')

      const { checkEmailLimit } = await import('@/lib/usage/usage-tracker')
      const result = await checkEmailLimit(tenantId)

      expect(result.currentUsage).toBe(300)
      expect(result.limit).toBe(500)
      expect(result.allowed).toBe(true)
    })

    test('checkNotificationLimit 함수가 올바르게 동작함', async () => {
      const tenantId = 'tenant-123'

      const mockTenant = {
        id: tenantId,
        subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
        maxEmails: 2000,
        maxNotifications: 2000,
      }

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)
      mockRedis.get.mockResolvedValue('1800')

      const { checkNotificationLimit } = await import('@/lib/usage/usage-tracker')
      const result = await checkNotificationLimit(tenantId)

      expect(result.currentUsage).toBe(1800)
      expect(result.limit).toBe(2000)
      expect(result.allowed).toBe(true)
      expect(result.warningLevel).toBe('warning') // 90% 사용량
    })
  })

  describe('플랜별 제한 검증', () => {
    test.each([
      [SubscriptionPlan.FREE_TRIAL, 100, 100],
      [SubscriptionPlan.STARTER, 500, 500],
      [SubscriptionPlan.PROFESSIONAL, 2000, 2000],
      [SubscriptionPlan.BUSINESS, 10000, 10000],
      [SubscriptionPlan.ENTERPRISE, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    ])('%s 플랜의 제한이 올바르게 적용됨', async (plan, expectedEmailLimit, expectedSmsLimit) => {
      const tenantId = 'tenant-123'

      const mockTenant = {
        id: tenantId,
        subscriptionPlan: plan,
        maxEmails: PLAN_LIMITS[plan].maxEmailsPerMonth,
        maxNotifications: PLAN_LIMITS[plan].maxNotificationsPerMonth,
      }

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)
      mockRedis.get.mockResolvedValue('50')

      const emailCheck = await UsageTracker.checkUsageLimits(tenantId, UsageType.EMAIL)
      const smsCheck = await UsageTracker.checkUsageLimits(tenantId, UsageType.SMS)

      expect(emailCheck.limit).toBe(expectedEmailLimit)
      expect(smsCheck.limit).toBe(expectedSmsLimit)
    })

    test('플랜별 API 액세스 권한이 올바르게 적용됨', async () => {
      const planApiAccess = [
        [SubscriptionPlan.FREE_TRIAL, false],
        [SubscriptionPlan.STARTER, false],
        [SubscriptionPlan.PROFESSIONAL, true],
        [SubscriptionPlan.BUSINESS, true],
        [SubscriptionPlan.ENTERPRISE, true],
      ]

      for (const [plan, hasApiAccess] of planApiAccess) {
        const tenantId = `tenant-${plan}`
        const mockTenant = {
          id: tenantId,
          subscriptionPlan: plan,
          maxEmails: PLAN_LIMITS[plan as SubscriptionPlan].maxEmailsPerMonth,
          maxNotifications: PLAN_LIMITS[plan as SubscriptionPlan].maxNotificationsPerMonth,
        }

        ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)
        mockRedis.get.mockResolvedValue('100')

        const apiCheck = await UsageTracker.checkUsageLimits(tenantId, UsageType.API_CALL)

        const expectedLimit = hasApiAccess ? 10000 : 0
        expect(apiCheck.limit).toBe(expectedLimit)
        expect(apiCheck.allowed).toBe(hasApiAccess ? true : false)
      }
    })
  })

  describe('경고 레벨 테스트', () => {
    test('사용량에 따른 경고 레벨이 올바르게 설정됨', async () => {
      const tenantId = 'tenant-123'
      const mockTenant = {
        id: tenantId,
        subscriptionPlan: SubscriptionPlan.STARTER,
        maxEmails: 500,
        maxNotifications: 500,
      }

      ;(prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant)

      // 테스트 케이스: [사용량, 예상 경고 레벨]
      const testCases = [
        [300, 'none'], // 60% - 경고 없음
        [400, 'warning'], // 80% - 경고
        [475, 'critical'], // 95% - 위험
        [500, 'exceeded'], // 100% - 초과
        [600, 'exceeded'], // 120% - 초과
      ]

      for (const [usage, expectedWarningLevel] of testCases) {
        mockRedis.get.mockResolvedValue(String(usage))

        const result = await UsageTracker.checkUsageLimits(tenantId, UsageType.EMAIL)

        expect(result.warningLevel).toBe(expectedWarningLevel)
        expect(result.currentUsage).toBe(usage)
        expect(result.usagePercentage).toBe(Math.min((usage / 500) * 100, 100))

        if (expectedWarningLevel !== 'none') {
          expect(result.message).toBeDefined()
        }
      }
    })
  })
})
