import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUserTenant() {
  const email = 'sic113@naver.com'

  console.log(`=== 사용자 테넌트 확인: ${email} ===\n`)

  // 이메일로 테넌트 찾기
  const tenant = await prisma.tenant.findFirst({
    where: {
      ownerEmail: email,
    },
    include: {
      companies: {
        take: 5,
      },
      deliveryRules: {
        take: 5,
      },
    },
  })

  if (!tenant) {
    console.log('❌ 해당 이메일로 등록된 테넌트를 찾을 수 없습니다.')

    // 모든 테넌트 목록 확인
    console.log('\n모든 테넌트 목록:')
    const allTenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        ownerEmail: true,
        subdomain: true,
        customDomain: true,
        subscriptionPlan: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    })

    allTenants.forEach((t) => {
      console.log(`\n- ${t.name}`)
      console.log(`  Email: ${t.ownerEmail}`)
      console.log(`  Subdomain: ${t.subdomain}`)
      console.log(`  Custom Domain: ${t.customDomain || 'N/A'}`)
      console.log(`  Plan: ${t.subscriptionPlan}`)
      console.log(`  Created: ${t.createdAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`)
    })
  } else {
    console.log('✅ 테넌트 발견!')
    console.log('\n기본 정보:')
    console.log(`- ID: ${tenant.id}`)
    console.log(`- 이름: ${tenant.name}`)
    console.log(`- 소유자: ${tenant.ownerName || 'N/A'} (${tenant.ownerEmail})`)
    console.log(`- Subdomain: ${tenant.subdomain}`)
    console.log(`- Custom Domain: ${tenant.customDomain || 'N/A'}`)
    console.log(`- 구독 플랜: ${tenant.subscriptionPlan}`)
    console.log(`- 구독 상태: ${tenant.subscriptionStatus}`)
    console.log(`- 생성일: ${tenant.createdAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`)

    console.log('\n발신번호 설정:')
    console.log(`- 발신번호: ${tenant.senderPhone || 'N/A'}`)
    console.log(`- 인증 여부: ${tenant.senderVerified ? '✅ 인증됨' : '❌ 미인증'}`)
    if (tenant.senderVerifiedAt) {
      console.log(`- 인증 일시: ${tenant.senderVerifiedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`)
    }

    console.log(`\n등록된 업체: ${tenant.companies.length}개`)
    if (tenant.companies.length > 0) {
      tenant.companies.forEach((company) => {
        console.log(`  - ${company.name} (${company.region})`)
      })
    }

    console.log(`\n납품 규칙: ${tenant.deliveryRules.length}개`)
    if (tenant.deliveryRules.length > 0) {
      tenant.deliveryRules.forEach((rule) => {
        console.log(`  - ${rule.region}: 마감 ${rule.cutoffTime}`)
      })
    }
  }

  await prisma.$disconnect()
}

checkUserTenant()
