import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTenantMember() {
  const userId = 'd5e64196-9438-4740-8325-e8aaff044f25'
  const tenantId = 'cmi40d1hw0000qey8ma57qssw'

  console.log('=== TenantMember 생성 ===\n')

  // 이미 존재하는지 확인
  const existing = await prisma.tenantMember.findFirst({
    where: {
      userId,
      tenantId,
    },
  })

  if (existing) {
    console.log('❌ 이미 멤버십이 존재합니다.')
    console.log(`- Role: ${existing.role}`)
    console.log(`- Status: ${existing.status}`)
    await prisma.$disconnect()
    return
  }

  // 멤버십 생성 (소유자)
  const member = await prisma.tenantMember.create({
    data: {
      userId,
      tenantId,
      userEmail: 'sic113@naver.com',
      role: 'OWNER',
      status: 'ACTIVE',
    },
  })

  console.log('✅ TenantMember 생성 완료!')
  console.log(`- User ID: ${member.userId}`)
  console.log(`- Tenant ID: ${member.tenantId}`)
  console.log(`- Role: ${member.role}`)
  console.log(`- Status: ${member.status}`)

  await prisma.$disconnect()
}

createTenantMember()
