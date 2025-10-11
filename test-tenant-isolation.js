/**
 * 테넌트 격리 검증 스크립트
 * 실제 데이터베이스와 Prisma 미들웨어를 사용하여 테넌트 격리를 검증
 */

const { PrismaClient } = require('@prisma/client')
const { createTenantMiddleware, TenantContext } = require('./lib/tenant-middleware')

async function testTenantIsolation() {
  console.log('🔍 테넌트 격리 검증 테스트 시작...\n')

  // Prisma 클라이언트 초기화
  const prisma = new PrismaClient({
    log: ['error'],
    errorFormat: 'pretty',
  })

  // 테넌트 미들웨어 적용
  createTenantMiddleware(prisma)
  const tenantContext = TenantContext.getInstance()

  const TENANT_A_ID = 'tenant-a-test'
  const TENANT_B_ID = 'tenant-b-test'

  try {
    console.log('✅ 1. 테넌트 컨텍스트 설정 테스트')

    // 테넌트 A 설정
    tenantContext.setTenant(TENANT_A_ID)
    console.log(`   테넌트 A 설정: ${tenantContext.getTenantId()}`)

    // 테넌트 B 설정
    tenantContext.setTenant(TENANT_B_ID)
    console.log(`   테넌트 B 설정: ${tenantContext.getTenantId()}`)

    console.log('✅ 2. 테넌트 없이 쿼리 시 에러 발생 테스트')
    tenantContext.clear()

    try {
      await prisma.company.findMany()
      console.log('   ❌ 에러가 발생하지 않음 - 격리 실패')
    } catch (error) {
      if (error.message.includes('Tenant context required')) {
        console.log('   ✅ 테넌트 컨텍스트 필수 에러 정상 발생')
      } else {
        console.log(`   ⚠️  예상과 다른 에러: ${error.message}`)
      }
    }

    console.log('✅ 3. 테넌트별 데이터 생성 테스트')

    // 테넌트 A로 회사 생성
    tenantContext.setTenant(TENANT_A_ID)
    const companyA = await prisma.company.create({
      data: {
        name: 'Company A',
        email: 'company-a@test.com',
        region: '서울',
      },
    })
    console.log(`   테넌트 A 회사 생성: ${companyA.name}, tenantId: ${companyA.tenantId}`)

    // 테넌트 B로 회사 생성
    tenantContext.setTenant(TENANT_B_ID)
    const companyB = await prisma.company.create({
      data: {
        name: 'Company B',
        email: 'company-b@test.com',
        region: '부산',
      },
    })
    console.log(`   테넌트 B 회사 생성: ${companyB.name}, tenantId: ${companyB.tenantId}`)

    console.log('✅ 4. 테넌트별 데이터 격리 검증')

    // 테넌트 A에서 조회
    tenantContext.setTenant(TENANT_A_ID)
    const companiesA = await prisma.company.findMany()
    console.log(`   테넌트 A에서 조회된 회사 수: ${companiesA.length}`)
    console.log(`   테넌트 A 회사들의 tenantId: ${companiesA.map((c) => c.tenantId).join(', ')}`)

    // 테넌트 B에서 조회
    tenantContext.setTenant(TENANT_B_ID)
    const companiesB = await prisma.company.findMany()
    console.log(`   테넌트 B에서 조회된 회사 수: ${companiesB.length}`)
    console.log(`   테넌트 B 회사들의 tenantId: ${companiesB.map((c) => c.tenantId).join(', ')}`)

    // 격리 확인
    const hasAInB = companiesB.some((c) => c.tenantId === TENANT_A_ID)
    const hasBInA = companiesA.some((c) => c.tenantId === TENANT_B_ID)

    if (!hasAInB && !hasBInA) {
      console.log('   ✅ 테넌트 격리 성공: 각 테넌트는 자신의 데이터만 조회')
    } else {
      console.log('   ❌ 테넌트 격리 실패: 교차 접근 발생')
    }

    console.log('✅ 5. 테스트 데이터 정리')

    // 테스트 데이터 정리
    tenantContext.setTenant(TENANT_A_ID)
    const deletedA = await prisma.company.deleteMany({
      where: { name: { contains: 'Company A' } },
    })
    console.log(`   테넌트 A 데이터 삭제: ${deletedA.count}개`)

    tenantContext.setTenant(TENANT_B_ID)
    const deletedB = await prisma.company.deleteMany({
      where: { name: { contains: 'Company B' } },
    })
    console.log(`   테넌트 B 데이터 삭제: ${deletedB.count}개`)

    console.log('\n🎉 테넌트 격리 검증 완료!')
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
    console.log('📦 데이터베이스 연결 종료')
  }
}

testTenantIsolation().catch(console.error)
