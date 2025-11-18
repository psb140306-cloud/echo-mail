import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateTenantDomain() {
  console.log('🔧 테넌트 도메인 업데이트 중...\n')

  const tenantId = 'cmhn51bs10000upmjuafsfl2n' // samdial
  const customDomain = 'echo-mail-blush.vercel.app'

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { customDomain }
  })

  console.log('✅ 테넌트 도메인 설정 완료:')
  console.log(`   이름: ${updated.name}`)
  console.log(`   서브도메인: ${updated.subdomain}`)
  console.log(`   커스텀 도메인: ${updated.customDomain}`)
  console.log(`\n이제 ${customDomain}에서 로그인하면 테넌트 컨텍스트가 설정됩니다.`)

  await prisma.$disconnect()
}

updateTenantDomain().catch((error) => {
  console.error('에러 발생:', error)
  process.exit(1)
})
