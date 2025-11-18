import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTenantForUser() {
  const userId = 'd5e64196-9438-4740-8325-e8aaff044f25'
  const email = 'sic113@naver.com'

  console.log('=== 사용자 테넌트 생성 ===\n')

  // 이미 테넌트가 있는지 확인
  const existing = await prisma.tenant.findFirst({
    where: { ownerId: userId },
  })

  if (existing) {
    console.log('❌ 이미 테넌트가 존재합니다:')
    console.log(`- Tenant ID: ${existing.id}`)
    console.log(`- Name: ${existing.name}`)
    await prisma.$disconnect()
    return
  }

  // Subdomain 생성 (이메일 앞부분 사용)
  const subdomain = email.split('@')[0].replace(/[^a-zA-Z0-9-]/g, '')

  // Subdomain 중복 확인
  const subdomainExists = await prisma.tenant.findFirst({
    where: { subdomain },
  })

  const finalSubdomain = subdomainExists ? `${subdomain}-${Date.now()}` : subdomain

  // 테넌트 생성
  const tenant = await prisma.tenant.create({
    data: {
      name: email.split('@')[0],
      subdomain: finalSubdomain,
      ownerId: userId,
      ownerEmail: email,
      ownerName: email.split('@')[0],
      subscriptionPlan: 'FREE_TRIAL',
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14일
      maxCompanies: 10,
      maxContacts: 50,
      maxEmails: 100,
      maxNotifications: 100,
    },
  })

  console.log('✅ 테넌트 생성 완료!')
  console.log(`- Tenant ID: ${tenant.id}`)
  console.log(`- Name: ${tenant.name}`)
  console.log(`- Subdomain: ${tenant.subdomain}`)
  console.log(`- Owner: ${tenant.ownerEmail}`)
  console.log(`- Plan: ${tenant.subscriptionPlan}`)
  console.log(`- Trial Ends: ${tenant.trialEndsAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`)

  await prisma.$disconnect()
}

createTenantForUser()
