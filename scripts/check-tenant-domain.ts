import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTenantDomain() {
  console.log('=== 등록된 테넌트 목록 ===\n')

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      subdomain: true,
      customDomain: true,
      ownerEmail: true,
      subscriptionStatus: true,
    }
  })

  if (tenants.length === 0) {
    console.log('⚠️  등록된 테넌트가 없습니다.')
    console.log('\n해결 방법:')
    console.log('1. Supabase에서 회원가입/로그인')
    console.log('2. 온보딩 플로우를 통해 테넌트 생성')
    console.log('3. 또는 직접 DB에 테넌트 레코드 추가')
  } else {
    tenants.forEach((tenant, index) => {
      console.log(`${index + 1}. ${tenant.name}`)
      console.log(`   ID: ${tenant.id}`)
      console.log(`   서브도메인: ${tenant.subdomain}`)
      console.log(`   커스텀 도메인: ${tenant.customDomain || '(없음)'}`)
      console.log(`   소유자 이메일: ${tenant.ownerEmail}`)
      console.log(`   구독 상태: ${tenant.subscriptionStatus}`)
      console.log()
    })

    console.log('=== 도메인 매핑 확인 ===\n')
    console.log('현재 Vercel 도메인: echo-mail-blush.vercel.app')

    const matchingTenant = tenants.find(t =>
      t.subdomain === 'echo-mail-blush' ||
      t.customDomain === 'echo-mail-blush.vercel.app'
    )

    if (matchingTenant) {
      console.log(`✅ 매칭되는 테넌트 발견: ${matchingTenant.name}`)
    } else {
      console.log('❌ 매칭되는 테넌트가 없습니다.')
      console.log('\n해결 방법:')
      console.log('1. 기존 테넌트의 subdomain을 "echo-mail-blush"로 변경')
      console.log('2. 또는 customDomain을 "echo-mail-blush.vercel.app"로 설정')
      console.log('\nSQL 예시:')
      if (tenants.length > 0) {
        console.log(`UPDATE tenants SET subdomain = 'echo-mail-blush' WHERE id = '${tenants[0].id}';`)
        console.log('또는')
        console.log(`UPDATE tenants SET "customDomain" = 'echo-mail-blush.vercel.app' WHERE id = '${tenants[0].id}';`)
      }
    }
  }

  await prisma.$disconnect()
}

checkTenantDomain().catch((error) => {
  console.error('에러 발생:', error)
  process.exit(1)
})
