import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixUserExssuda() {
  const email = 'exssuda@gmail.com'

  console.log(`=== ${email} 사용자 수정 ===\n`)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users?.users.find((u) => u.email === email)

  if (!user) {
    console.log('❌ Supabase에 사용자가 없습니다.')
    await prisma.$disconnect()
    return
  }

  console.log('✅ Supabase 사용자 발견:', user.id)

  const existingTenant = await prisma.tenant.findFirst({
    where: { ownerId: user.id },
  })

  if (existingTenant) {
    console.log('✅ 기존 테넌트 발견:', existingTenant.id)

    const membership = await prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        tenantId: existingTenant.id,
      },
    })

    if (!membership) {
      console.log('❌ 멤버십 없음 - 생성 중...')
      await prisma.tenantMember.create({
        data: {
          userId: user.id,
          tenantId: existingTenant.id,
          userEmail: email,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      })
      console.log('✅ 멤버십 생성 완료')
    } else {
      console.log('✅ 멤버십 존재:', membership.role)
    }
  } else {
    console.log('❌ 테넌트 없음 - 생성 중...')

    const subdomain = email.split('@')[0].replace(/[^a-zA-Z0-9-]/g, '')

    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: subdomain,
          subdomain,
          ownerId: user.id,
          ownerEmail: email,
          ownerName: subdomain,
          subscriptionPlan: 'FREE_TRIAL',
          subscriptionStatus: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          maxCompanies: 10,
          maxContacts: 50,
          maxEmails: 100,
          maxNotifications: 100,
        },
      })

      await tx.tenantMember.create({
        data: {
          userId: user.id,
          tenantId: newTenant.id,
          userEmail: email,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      })

      return newTenant
    })

    console.log('✅ 테넌트 + 멤버십 생성 완료:', tenant.id)
  }

  await prisma.$disconnect()
}

fixUserExssuda()
