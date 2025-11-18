import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testTenantLookup() {
  const host = 'echo-mail-blush.vercel.app'
  const subdomain = host.replace('.vercel.app', '')

  console.log('🔍 테넌트 조회 테스트\n')
  console.log('검색 조건:')
  console.log(`  subdomain: "${subdomain}"`)
  console.log(`  customDomain: "${host}"`)
  console.log()

  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [{ subdomain: subdomain }, { customDomain: host }],
    },
    select: {
      id: true,
      name: true,
      subdomain: true,
      customDomain: true,
    },
  })

  if (tenant) {
    console.log('✅ 테넌트 발견:')
    console.log(JSON.stringify(tenant, null, 2))
  } else {
    console.log('❌ 테넌트를 찾을 수 없습니다.')
    console.log('\n모든 테넌트 목록:')

    const allTenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        customDomain: true,
      },
    })

    console.log(JSON.stringify(allTenants, null, 2))
  }

  await prisma.$disconnect()
}

testTenantLookup()
