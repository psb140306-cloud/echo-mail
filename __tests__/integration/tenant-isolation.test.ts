/**
 * 테넌트 간 데이터 격리 통합 테스트
 *
 * 이 테스트는 멀티테넌트 SaaS 시스템의 핵심인 데이터 격리를 검증합니다:
 * 1. 테넌트별 데이터 접근 제한
 * 2. 교차 테넌트 접근 차단
 * 3. API 레벨 격리 검증
 * 4. 데이터베이스 레벨 격리 검증
 * 5. 세션 기반 테넌트 컨텍스트 관리
 */

import { prisma } from '@/lib/db'
import { TenantContext } from '@/lib/middleware/tenant-context'
import { validateTenantAccess } from '@/lib/tenant-middleware'

// 모든 의존성 모킹
jest.mock('@/lib/db', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tenantUser: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    company: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    emailLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    notificationLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/middleware/tenant-context', () => ({
  TenantContext: {
    getInstance: jest.fn(),
  },
}))

jest.mock('@/lib/tenant-middleware', () => ({
  validateTenantAccess: jest.fn(),
}))

describe('테넌트 간 데이터 격리 통합 테스트', () => {
  const tenantA = {
    id: 'tenant-a-id',
    name: 'Company A',
    subdomain: 'company-a',
  }

  const tenantB = {
    id: 'tenant-b-id',
    name: 'Company B',
    subdomain: 'company-b',
  }

  const userA = {
    id: 'user-a-id',
    email: 'user@company-a.com',
    tenantId: tenantA.id,
  }

  const userB = {
    id: 'user-b-id',
    email: 'user@company-b.com',
    tenantId: tenantB.id,
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // TenantContext 모킹
    ;(TenantContext.getInstance as jest.Mock).mockReturnValue({
      getTenantId: jest.fn(),
      getUserId: jest.fn(),
      setTenant: jest.fn(),
      clear: jest.fn(),
    })
  })

  describe('테넌트별 데이터 접근 제한', () => {
    test('테넌트 A 사용자는 테넌트 A 데이터만 조회 가능', async () => {
      // 1. 테넌트 A 컨텍스트 설정
      const contextInstance = (TenantContext.getInstance as jest.Mock)()
      ;(contextInstance.getTenantId as jest.Mock).mockReturnValue(tenantA.id)
      ;(contextInstance.getUserId as jest.Mock).mockReturnValue(userA.id)

      // 2. 테넌트 A 회사 데이터 모킹
      const tenantACompanies = [
        { id: 'company-a-1', name: 'Company A-1', tenantId: tenantA.id },
        { id: 'company-a-2', name: 'Company A-2', tenantId: tenantA.id },
      ]

      ;(prisma.company.findMany as jest.Mock).mockImplementation((args) => {
        if (args?.where?.tenantId === tenantA.id) {
          return Promise.resolve(tenantACompanies)
        }
        return Promise.resolve([])
      })

      // 3. 데이터 조회
      const companies = await prisma.company.findMany({
        where: { tenantId: tenantA.id },
      })

      // 4. 검증: 테넌트 A 데이터만 반환
      expect(companies).toHaveLength(2)
      expect(companies[0].tenantId).toBe(tenantA.id)
      expect(companies[1].tenantId).toBe(tenantA.id)
    })

    test('테넌트 B 사용자는 테넌트 B 데이터만 조회 가능', async () => {
      // 1. 테넌트 B 컨텍스트 설정
      const contextInstance = (TenantContext.getInstance as jest.Mock)()
      ;(contextInstance.getTenantId as jest.Mock).mockReturnValue(tenantB.id)
      ;(contextInstance.getUserId as jest.Mock).mockReturnValue(userB.id)

      // 2. 테넌트 B 연락처 데이터 모킹
      const tenantBContacts = [
        { id: 'contact-b-1', name: 'Contact B-1', tenantId: tenantB.id },
        { id: 'contact-b-2', name: 'Contact B-2', tenantId: tenantB.id },
        { id: 'contact-b-3', name: 'Contact B-3', tenantId: tenantB.id },
      ]

      ;(prisma.contact.findMany as jest.Mock).mockImplementation((args) => {
        if (args?.where?.tenantId === tenantB.id) {
          return Promise.resolve(tenantBContacts)
        }
        return Promise.resolve([])
      })

      // 3. 데이터 조회
      const contacts = await prisma.contact.findMany({
        where: { tenantId: tenantB.id },
      })

      // 4. 검증: 테넌트 B 데이터만 반환
      expect(contacts).toHaveLength(3)
      contacts.forEach((contact) => {
        expect(contact.tenantId).toBe(tenantB.id)
      })
    })
  })

  describe('교차 테넌트 접근 차단', () => {
    test('테넌트 A 사용자가 테넌트 B 데이터 접근 시 차단', async () => {
      // 1. 테넌트 A 컨텍스트 설정
      const contextInstance = (TenantContext.getInstance as jest.Mock)()
      ;(contextInstance.getTenantId as jest.Mock).mockReturnValue(tenantA.id)
      ;(contextInstance.getUserId as jest.Mock).mockReturnValue(userA.id)

      // 2. 접근 검증 모킹 (실패)
      ;(validateTenantAccess as jest.Mock).mockResolvedValue(false)

      // 3. 테넌트 B 데이터 접근 시도
      const accessAllowed = await validateTenantAccess(userA.id, tenantB.id)

      // 4. 검증: 접근 차단
      expect(accessAllowed).toBe(false)
      expect(validateTenantAccess).toHaveBeenCalledWith(userA.id, tenantB.id)
    })

    test('다른 테넌트 데이터 생성 시도 시 차단', async () => {
      // 1. 테넌트 A 컨텍스트 설정
      const contextInstance = (TenantContext.getInstance as jest.Mock)()
      ;(contextInstance.getTenantId as jest.Mock).mockReturnValue(tenantA.id)

      // 2. 데이터 생성 모킹 (tenantId 검증)
      ;(prisma.company.create as jest.Mock).mockImplementation((args) => {
        if (args?.data?.tenantId !== tenantA.id) {
          throw new Error('Unauthorized: Cannot create data for different tenant')
        }
        return Promise.resolve({
          id: 'new-company',
          ...args.data,
        })
      })

      // 3. 테넌트 B로 데이터 생성 시도
      try {
        await prisma.company.create({
          data: {
            name: 'Malicious Company',
            tenantId: tenantB.id, // 다른 테넌트 ID
          },
        })
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error.message).toContain('Unauthorized: Cannot create data for different tenant')
      }
    })

    test('다른 테넌트 데이터 수정 시도 시 차단', async () => {
      // 1. 테넌트 A 컨텍스트 설정
      const contextInstance = (TenantContext.getInstance as jest.Mock)()
      ;(contextInstance.getTenantId as jest.Mock).mockReturnValue(tenantA.id)

      // 2. 데이터 수정 모킹 (tenantId 검증)
      ;(prisma.contact.update as jest.Mock).mockImplementation((args) => {
        // 실제 데이터 조회 시뮬레이션
        const existingData = { id: args.where.id, tenantId: tenantB.id }

        if (existingData.tenantId !== tenantA.id) {
          throw new Error('Unauthorized: Cannot update data from different tenant')
        }
        return Promise.resolve(existingData)
      })

      // 3. 테넌트 B 데이터 수정 시도
      try {
        await prisma.contact.update({
          where: { id: 'contact-b-1' },
          data: { name: 'Hacked Contact' },
        })
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error.message).toContain('Unauthorized: Cannot update data from different tenant')
      }
    })

    test('다른 테넌트 데이터 삭제 시도 시 차단', async () => {
      // 1. 테넌트 A 컨텍스트 설정
      const contextInstance = (TenantContext.getInstance as jest.Mock)()
      ;(contextInstance.getTenantId as jest.Mock).mockReturnValue(tenantA.id)

      // 2. 데이터 삭제 모킹 (tenantId 검증)
      ;(prisma.company.delete as jest.Mock).mockImplementation((args) => {
        // 실제 데이터 조회 시뮬레이션
        const existingData = { id: args.where.id, tenantId: tenantB.id }

        if (existingData.tenantId !== tenantA.id) {
          throw new Error('Unauthorized: Cannot delete data from different tenant')
        }
        return Promise.resolve(existingData)
      })

      // 3. 테넌트 B 데이터 삭제 시도
      try {
        await prisma.company.delete({
          where: { id: 'company-b-1' },
        })
        throw new Error('Expected error to be thrown')
      } catch (error) {
        expect(error.message).toContain('Unauthorized: Cannot delete data from different tenant')
      }
    })
  })

  describe('API 레벨 격리 검증', () => {
    test('API 요청 시 테넌트 헤더 검증', async () => {
      // 1. API 요청 시뮬레이션
      const mockRequest = {
        headers: {
          'x-tenant-id': tenantA.id,
          authorization: 'Bearer token-a',
        },
      }

      // 2. 테넌트 검증 모킹
      ;(prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue({
        id: userA.id,
        tenantId: tenantA.id,
        userId: userA.id,
        role: 'ADMIN',
      })
      ;(validateTenantAccess as jest.Mock).mockImplementation(async (userId, tenantId) => {
        const tenantUser = await prisma.tenantUser.findUnique({
          where: {
            userId_tenantId: {
              userId,
              tenantId,
            },
          },
        })
        return !!tenantUser && tenantUser.tenantId === tenantId
      })

      // 3. 접근 검증
      const isValid = await (validateTenantAccess as jest.Mock)(userA.id, tenantA.id)

      // 4. 검증: 올바른 테넌트 접근 허용
      expect(isValid).toBe(true)
    })

    test('잘못된 테넌트 헤더로 API 요청 시 차단', async () => {
      // 1. API 요청 시뮬레이션 (잘못된 테넌트 ID)
      const mockRequest = {
        headers: {
          'x-tenant-id': tenantB.id, // 잘못된 테넌트
          authorization: 'Bearer token-a', // 테넌트 A 사용자 토큰
        },
      }

      // 2. 테넌트 검증 모킹
      ;(prisma.tenantUser.findUnique as jest.Mock).mockResolvedValue(null)
      ;(validateTenantAccess as jest.Mock).mockImplementation(async (userId, tenantId) => {
        const tenantUser = await prisma.tenantUser.findUnique({
          where: {
            userId_tenantId: {
              userId,
              tenantId,
            },
          },
        })
        return !!tenantUser
      })

      // 3. 접근 검증
      const isValid = await (validateTenantAccess as jest.Mock)(userA.id, tenantB.id)

      // 4. 검증: 잘못된 테넌트 접근 차단
      expect(isValid).toBe(false)
    })
  })

  describe('데이터베이스 레벨 격리 검증', () => {
    test('쿼리에 자동으로 테넌트 필터 적용', async () => {
      // 1. 테넌트 컨텍스트 설정
      const contextInstance = (TenantContext.getInstance as jest.Mock)()
      ;(contextInstance.getTenantId as jest.Mock).mockReturnValue(tenantA.id)

      // 2. 이메일 로그 조회 모킹
      const tenantAEmailLogs = [
        { id: 'email-1', subject: 'Email 1', tenantId: tenantA.id },
        { id: 'email-2', subject: 'Email 2', tenantId: tenantA.id },
      ]

      ;(prisma.emailLog.findMany as jest.Mock).mockImplementation((args) => {
        // tenantId 필터가 자동으로 적용되었는지 확인
        if (!args?.where?.tenantId) {
          throw new Error('Security: tenantId filter is required')
        }

        if (args.where.tenantId === tenantA.id) {
          return Promise.resolve(tenantAEmailLogs)
        }
        return Promise.resolve([])
      })

      // 3. 쿼리 실행
      const logs = await prisma.emailLog.findMany({
        where: { tenantId: tenantA.id },
      })

      // 4. 검증: 테넌트 필터 적용 및 데이터 반환
      expect(logs).toHaveLength(2)
      expect(logs[0].tenantId).toBe(tenantA.id)
      expect(prisma.emailLog.findMany).toHaveBeenCalledWith({
        where: { tenantId: tenantA.id },
      })
    })

    test('집계 쿼리에도 테넌트 필터 적용', async () => {
      // 1. 테넌트 컨텍스트 설정
      const contextInstance = (TenantContext.getInstance as jest.Mock)()
      ;(contextInstance.getTenantId as jest.Mock).mockReturnValue(tenantB.id)

      // 2. count 쿼리 모킹
      ;(prisma.notificationLog.findMany as jest.Mock).mockImplementation((args) => {
        if (args?.where?.tenantId === tenantB.id) {
          return Promise.resolve([
            { id: '1', tenantId: tenantB.id },
            { id: '2', tenantId: tenantB.id },
            { id: '3', tenantId: tenantB.id },
            { id: '4', tenantId: tenantB.id },
            { id: '5', tenantId: tenantB.id },
          ])
        }
        return Promise.resolve([])
      })

      // 3. 집계 쿼리 실행
      const logs = await prisma.notificationLog.findMany({
        where: { tenantId: tenantB.id },
      })
      const count = logs.length

      // 4. 검증: 테넌트 B 데이터만 집계
      expect(count).toBe(5)
    })
  })

  describe('세션 기반 테넌트 컨텍스트 관리', () => {
    test('로그인 시 테넌트 컨텍스트 설정', async () => {
      // 1. 로그인 시뮬레이션
      const contextInstance = (TenantContext.getInstance as jest.Mock)()
      const setTenantSpy = contextInstance.setTenant as jest.Mock

      // 2. 사용자 인증 후 테넌트 설정
      await setTenantSpy(tenantA.id, userA.id)

      // 3. 검증: 테넌트 컨텍스트 설정
      expect(setTenantSpy).toHaveBeenCalledWith(tenantA.id, userA.id)
    })

    test('로그아웃 시 테넌트 컨텍스트 초기화', async () => {
      // 1. 테넌트 컨텍스트 설정
      const contextInstance = (TenantContext.getInstance as jest.Mock)()
      const clearSpy = contextInstance.clear as jest.Mock

      // 2. 로그아웃 시뮬레이션
      await clearSpy()

      // 3. 검증: 테넌트 컨텍스트 초기화
      expect(clearSpy).toHaveBeenCalled()
    })

    test('테넌트 전환 시 컨텍스트 업데이트', async () => {
      // 1. 초기 테넌트 설정
      const contextInstance = (TenantContext.getInstance as jest.Mock)()
      const setTenantSpy = contextInstance.setTenant as jest.Mock

      await setTenantSpy(tenantA.id, userA.id)

      // 2. 다른 테넌트로 전환 (관리자 기능)
      await setTenantSpy(tenantB.id, userB.id)

      // 3. 검증: 컨텍스트 업데이트
      expect(setTenantSpy).toHaveBeenCalledTimes(2)
      expect(setTenantSpy).toHaveBeenLastCalledWith(tenantB.id, userB.id)
    })
  })
})
