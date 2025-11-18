import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSupabaseUser() {
  const email = 'sic113@naver.com'

  console.log(`=== Supabase 사용자 확인: ${email} ===\n`)

  // Supabase Admin 클라이언트 생성
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Supabase 환경변수가 설정되지 않았습니다.')
    console.log('- NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
    await prisma.$disconnect()
    return
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Admin API로 사용자 목록 조회
  const { data: users, error } = await supabase.auth.admin.listUsers()

  if (error) {
    console.log('❌ Supabase 사용자 조회 실패:', error.message)
    await prisma.$disconnect()
    return
  }

  // 이메일로 사용자 찾기
  const user = users?.users.find((u) => u.email === email)

  if (!user) {
    console.log('❌ Supabase에 해당 이메일로 가입된 사용자가 없습니다.')
    console.log('\n최근 가입한 사용자들:')
    users?.users
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .forEach((u) => {
        console.log(`- ${u.email} (ID: ${u.id})`)
        console.log(`  Created: ${new Date(u.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`)
      })
  } else {
    console.log('✅ Supabase 사용자 발견!')
    console.log(`- User ID: ${user.id}`)
    console.log(`- Email: ${user.email}`)
    console.log(`- Created: ${new Date(user.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`)
    console.log(`- Confirmed: ${user.email_confirmed_at ? '✅' : '❌'}`)

    // 이 ownerId로 테넌트 찾기
    console.log('\n테넌트 확인 (ownerId 기준):')
    const tenant = await prisma.tenant.findFirst({
      where: {
        ownerId: user.id,
      },
    })

    if (!tenant) {
      console.log('❌ 이 사용자의 테넌트가 생성되지 않았습니다.')
      console.log('\n원인:')
      console.log('- /api/auth/setup-account API가 호출되지 않았거나')
      console.log('- API 호출이 실패했을 가능성')
    } else {
      console.log('✅ 테넌트 발견!')
      console.log(`- Tenant ID: ${tenant.id}`)
      console.log(`- Name: ${tenant.name}`)
      console.log(`- Subdomain: ${tenant.subdomain}`)
    }
  }

  await prisma.$disconnect()
}

checkSupabaseUser()
