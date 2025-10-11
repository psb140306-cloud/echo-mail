/**
 * 테넌트 데이터 격리 테스트
 * 멀티테넌시가 올바르게 작동하는지 검증
 */

import { PrismaClient } from '@prisma/client'
import { TenantContext, createTenantMiddleware } from '@/lib/tenant-middleware'
import { logger } from '@/lib/utils/logger'

// 테스트용 Prisma 인스턴스
let prisma: PrismaClient
let tenantContext: TenantContext

// 테스트 테넌트 데이터
const TENANT_A_ID = 'tenant-a-test-id'
const TENANT_B_ID = 'tenant-b-test-id'

beforeAll(async () => {
  prisma = new PrismaClient({
    log: ['error'],
    errorFormat: 'pretty',
  })

  // 테넌트 미들웨어 적용
  createTenantMiddleware(prisma)
  tenantContext = TenantContext.getInstance()

  // 테스트 테넌트 생성
  await prisma.$executeRaw`
    INSERT INTO tenants (id, name, subdomain, "subscriptionPlan", "subscriptionStatus", "trialEndsAt", "createdAt", "updatedAt")
    VALUES (${TENANT_A_ID}, 'Tenant A', 'tenant-a', 'STARTER', 'ACTIVE', NOW() + INTERVAL '30 days', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `

  await prisma.$executeRaw`
    INSERT INTO tenants (id, name, subdomain, "subscriptionPlan", "subscriptionStatus", "trialEndsAt", "createdAt", "updatedAt")
    VALUES (${TENANT_B_ID}, 'Tenant B', 'tenant-b', 'PROFESSIONAL', 'ACTIVE', NOW() + INTERVAL '30 days', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
})

afterAll(async () => {
  // 테스트 데이터 정리
  tenantContext.clear()

  await prisma.$executeRaw`DELETE FROM companies WHERE "tenantId" IN (${TENANT_A_ID}, ${TENANT_B_ID})`
  await prisma.$executeRaw`DELETE FROM contacts WHERE "tenantId" IN (${TENANT_A_ID}, ${TENANT_B_ID})`
  await prisma.$executeRaw`DELETE FROM tenants WHERE id IN (${TENANT_A_ID}, ${TENANT_B_ID})`

  await prisma.$disconnect()
})

beforeEach(() => {
  tenantContext.clear()
})

describe('테넌트 데이터 격리 검증', () => {
  describe('TenantContext 관리', () => {
    test('테넌트 컨텍스트 설정 및 조회', () => {
      expect(tenantContext.getTenantId()).toBeNull()

      tenantContext.setTenant(TENANT_A_ID, 'user-123')
      expect(tenantContext.getTenantId()).toBe(TENANT_A_ID)
      expect(tenantContext.getUserId()).toBe('user-123')

      tenantContext.clear()
      expect(tenantContext.getTenantId()).toBeNull()
      expect(tenantContext.getUserId()).toBeNull()
    })

    test('싱글톤 패턴 확인', () => {
      const context1 = TenantContext.getInstance()
      const context2 = TenantContext.getInstance()

      expect(context1).toBe(context2)

      context1.setTenant(TENANT_A_ID)
      expect(context2.getTenantId()).toBe(TENANT_A_ID)
    })
  })

  describe('Company 모델 테넌트 격리', () => {
    test('테넌트 컨텍스트 없이 쿼리 시 에러 발생', async () => {
      tenantContext.clear()

      await expect(prisma.company.findMany()).rejects.toThrow('Tenant context required')
    })

    test('CREATE - 자동 tenantId 주입', async () => {
      tenantContext.setTenant(TENANT_A_ID)

      const company = await prisma.company.create({
        data: {
          name: 'Company A1',
          email: 'company-a1@example.com',
          region: '서울',
        },
      })

      expect(company.tenantId).toBe(TENANT_A_ID)
    })

    test('FIND - 테넌트별 데이터 격리', async () => {
      // Tenant A 데이터 생성
      tenantContext.setTenant(TENANT_A_ID)
      await prisma.company.create({
        data: {
          name: 'Company A2',
          email: 'company-a2@example.com',
          region: '서울',
        },
      })

      // Tenant B 데이터 생성
      tenantContext.setTenant(TENANT_B_ID)
      await prisma.company.create({
        data: {
          name: 'Company B1',
          email: 'company-b1@example.com',
          region: '부산',
        },
      })

      // Tenant A 조회 - A의 데이터만 반환
      tenantContext.setTenant(TENANT_A_ID)
      const tenantACompanies = await prisma.company.findMany()
      expect(tenantACompanies.length).toBeGreaterThan(0)
      tenantACompanies.forEach((company) => {
        expect(company.tenantId).toBe(TENANT_A_ID)
      })

      // Tenant B 조회 - B의 데이터만 반환
      tenantContext.setTenant(TENANT_B_ID)
      const tenantBCompanies = await prisma.company.findMany()
      expect(tenantBCompanies.length).toBeGreaterThan(0)
      tenantBCompanies.forEach((company) => {
        expect(company.tenantId).toBe(TENANT_B_ID)
      })

      // 교차 접근 불가 확인
      tenantContext.setTenant(TENANT_A_ID)
      const crossAccessResult = await prisma.company.findMany({
        where: { name: 'Company B1' },
      })
      expect(crossAccessResult).toHaveLength(0)
    })

    test('UPDATE - 테넌트 격리 확인', async () => {
      // Tenant A 데이터 생성
      tenantContext.setTenant(TENANT_A_ID)
      const company = await prisma.company.create({
        data: {
          name: 'Company A3',
          email: 'company-a3@example.com',
          region: '서울',
        },
      })

      // Tenant B에서 A의 데이터 수정 시도 (실패해야 함)
      tenantContext.setTenant(TENANT_B_ID)
      const updateResult = await prisma.company.updateMany({
        where: { id: company.id },
        data: { name: 'Modified by B' },
      })
      expect(updateResult.count).toBe(0)

      // Tenant A에서 본인 데이터 수정 (성공)
      tenantContext.setTenant(TENANT_A_ID)
      const validUpdate = await prisma.company.update({
        where: { id: company.id },
        data: { name: 'Modified by A' },
      })
      expect(validUpdate.name).toBe('Modified by A')
      expect(validUpdate.tenantId).toBe(TENANT_A_ID)
    })

    test('DELETE - 테넌트 격리 확인', async () => {
      // Tenant A 데이터 생성
      tenantContext.setTenant(TENANT_A_ID)
      const company = await prisma.company.create({
        data: {
          name: 'Company A4',
          email: 'company-a4@example.com',
          region: '서울',
        },
      })

      // Tenant B에서 A의 데이터 삭제 시도 (실패해야 함)
      tenantContext.setTenant(TENANT_B_ID)
      const deleteResult = await prisma.company.deleteMany({
        where: { id: company.id },
      })
      expect(deleteResult.count).toBe(0)

      // 데이터가 여전히 존재하는지 확인
      tenantContext.setTenant(TENANT_A_ID)
      const stillExists = await prisma.company.findUnique({
        where: { id: company.id },
      })
      expect(stillExists).not.toBeNull()
    })
  })

  describe('Contact 모델 테넌트 격리', () => {
    test('Contact 생성 시 테넌트 격리', async () => {
      // Company 먼저 생성
      tenantContext.setTenant(TENANT_A_ID)
      const company = await prisma.company.create({
        data: {
          name: 'Company for Contact',
          email: 'contact-test@example.com',
          region: '서울',
        },
      })

      // Contact 생성
      const contact = await prisma.contact.create({
        data: {
          name: '김담당자',
          phone: '010-1234-5678',
          email: 'contact@example.com',
          companyId: company.id,
        },
      })

      expect(contact.tenantId).toBe(TENANT_A_ID)
      expect(contact.companyId).toBe(company.id)
    })

    test('다른 테넌트의 Contact 접근 불가', async () => {
      // Tenant A에서 Contact 생성
      tenantContext.setTenant(TENANT_A_ID)
      const company = await prisma.company.create({
        data: {
          name: 'Company A for Contact',
          email: 'contact-a@example.com',
          region: '서울',
        },
      })

      const contact = await prisma.contact.create({
        data: {
          name: '김담당자A',
          phone: '010-1111-1111',
          companyId: company.id,
        },
      })

      // Tenant B에서 접근 시도
      tenantContext.setTenant(TENANT_B_ID)
      const inaccessibleContact = await prisma.contact.findUnique({
        where: { id: contact.id },
      })
      expect(inaccessibleContact).toBeNull()

      const contacts = await prisma.contact.findMany({
        where: { name: '김담당자A' },
      })
      expect(contacts).toHaveLength(0)
    })
  })

  describe('사용량 제한 테스트', () => {
    test('테넌트별 Company 수 계산', async () => {
      // Tenant A에 여러 Company 생성
      tenantContext.setTenant(TENANT_A_ID)
      const initialCount = await prisma.company.count()

      await prisma.company.createMany({
        data: [
          { name: 'Count Test 1', email: 'count1@example.com', region: '서울' },
          { name: 'Count Test 2', email: 'count2@example.com', region: '부산' },
        ],
      })

      const newCount = await prisma.company.count()
      expect(newCount).toBe(initialCount + 2)

      // Tenant B에서는 다른 수가 나와야 함
      tenantContext.setTenant(TENANT_B_ID)
      const tenantBCount = await prisma.company.count()
      expect(tenantBCount).not.toBe(newCount)
    })
  })

  describe('Super Admin 모델 테스트', () => {
    test('Tenant 모델은 테넌트 격리 없이 접근 가능', async () => {
      tenantContext.clear() // 테넌트 컨텍스트 없음

      // Super Admin으로 모든 테넌트 조회 가능
      const tenants = await prisma.tenant.findMany()
      expect(tenants.length).toBeGreaterThanOrEqual(2)

      const tenantIds = tenants.map((t) => t.id)
      expect(tenantIds).toContain(TENANT_A_ID)
      expect(tenantIds).toContain(TENANT_B_ID)
    })

    test('User 모델은 테넌트 격리 없이 접근 가능', async () => {
      tenantContext.clear()

      // Super Admin은 모든 사용자 조회 가능
      await expect(prisma.user.findMany()).resolves.toBeDefined()
    })
  })

  describe('에러 상황 테스트', () => {
    test('잘못된 테넌트 ID로 컨텍스트 설정', () => {
      expect(() => {
        tenantContext.setTenant('non-existent-tenant')
      }).not.toThrow()

      expect(tenantContext.getTenantId()).toBe('non-existent-tenant')
    })

    test('빈 문자열 테넌트 ID', () => {
      expect(() => {
        tenantContext.setTenant('')
      }).not.toThrow()

      // 빈 문자열도 유효한 테넌트 ID로 취급
      expect(tenantContext.getTenantId()).toBe('')
    })
  })

  describe('복합 쿼리 테스트', () => {
    test('JOIN 쿼리에서 테넌트 격리', async () => {
      // Tenant A 데이터 생성
      tenantContext.setTenant(TENANT_A_ID)
      const companyA = await prisma.company.create({
        data: {
          name: 'Company A with Contacts',
          email: 'join-test-a@example.com',
          region: '서울',
        },
      })

      await prisma.contact.create({
        data: {
          name: '담당자A',
          phone: '010-1111-1111',
          companyId: companyA.id,
        },
      })

      // Tenant B 데이터 생성
      tenantContext.setTenant(TENANT_B_ID)
      const companyB = await prisma.company.create({
        data: {
          name: 'Company B with Contacts',
          email: 'join-test-b@example.com',
          region: '부산',
        },
      })

      await prisma.contact.create({
        data: {
          name: '담당자B',
          phone: '010-2222-2222',
          companyId: companyB.id,
        },
      })

      // Tenant A에서 Company와 Contact 조인 조회
      tenantContext.setTenant(TENANT_A_ID)
      const companiesWithContacts = await prisma.company.findMany({
        include: {
          contacts: true,
        },
        where: {
          name: {
            contains: 'with Contacts',
          },
        },
      })

      expect(companiesWithContacts.length).toBeGreaterThan(0)
      companiesWithContacts.forEach((company) => {
        expect(company.tenantId).toBe(TENANT_A_ID)
        company.contacts.forEach((contact) => {
          expect(contact.tenantId).toBe(TENANT_A_ID)
        })
      })

      // Company B가 조회되지 않는지 확인
      const hasCompanyB = companiesWithContacts.some((c) => c.name === 'Company B with Contacts')
      expect(hasCompanyB).toBe(false)
    })

    test('트랜잭션에서 테넌트 격리', async () => {
      tenantContext.setTenant(TENANT_A_ID)

      await prisma.$transaction(async (tx) => {
        // 트랜잭션 내에서도 테넌트 컨텍스트 유지
        const company = await tx.company.create({
          data: {
            name: 'Transaction Test Company',
            email: 'transaction@example.com',
            region: '대구',
          },
        })

        expect(company.tenantId).toBe(TENANT_A_ID)

        const contact = await tx.contact.create({
          data: {
            name: '트랜잭션 담당자',
            phone: '010-3333-3333',
            companyId: company.id,
          },
        })

        expect(contact.tenantId).toBe(TENANT_A_ID)
      })
    })
  })
})

describe('성능 테스트', () => {
  test('대량 데이터 테넌트 격리 성능', async () => {
    tenantContext.setTenant(TENANT_A_ID)

    const startTime = Date.now()

    // 100개 회사 생성
    const companies = Array.from({ length: 100 }, (_, i) => ({
      name: `Performance Test Company ${i}`,
      email: `perf-${i}@example.com`,
      region: i % 2 === 0 ? '서울' : '부산',
    }))

    await prisma.company.createMany({
      data: companies,
    })

    const endTime = Date.now()
    const duration = endTime - startTime

    // 10초 이내에 완료되어야 함
    expect(duration).toBeLessThan(10000)

    // 생성된 데이터 확인
    const count = await prisma.company.count({
      where: {
        name: {
          startsWith: 'Performance Test Company',
        },
      },
    })

    expect(count).toBe(100)

    // 정리
    await prisma.company.deleteMany({
      where: {
        name: {
          startsWith: 'Performance Test Company',
        },
      },
    })
  }, 15000) // 15초 타임아웃
})
