import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTenantMember() {
  const userId = 'd5e64196-9438-4740-8325-e8aaff044f25'
  const email = 'sic113@naver.com'

  console.log('=== TenantMember 확인 ===\n')

  // 사용자의 멤버십 찾기
  const memberships = await prisma.tenantMember.findMany({
    where: {
      userId,
    },
    include: {
      tenant: true,
    },
  })

  if (memberships.length === 0) {
    console.log(`❌ ${email} 사용자의 멤버십이 없습니다.`)
    console.log('\n해결 방법: TenantMember 레코드를 생성해야 합니다.')

    // 해당 사용자가 소유한 테넌트 찾기
    const ownedTenant = await prisma.tenant.findFirst({
      where: {
        ownerId: userId,
      },
    })

    if (ownedTenant) {
      console.log('\n✅ 소유한 테넌트 발견:')
      console.log(`- Tenant ID: ${ownedTenant.id}`)
      console.log(`- Name: ${ownedTenant.name}`)
      console.log('\n멤버십 레코드를 생성하시겠습니까?')
    }
  } else {
    console.log(`✅ ${memberships.length}개의 멤버십 발견:`)
    memberships.forEach((m) => {
      console.log(`\n- Tenant: ${m.tenant.name}`)
      console.log(`  ID: ${m.tenantId}`)
      console.log(`  Role: ${m.role}`)
      console.log(`  Status: ${m.status}`)
    })
  }

  await prisma.$disconnect()
}

checkTenantMember()
