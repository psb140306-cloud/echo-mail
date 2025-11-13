/**
 * park8374@naver.com 사용자를 슈퍼어드민으로 설정하는 스크립트
 *
 * 사용법:
 * 1. npm run set-admin
 * 또는
 * 2. npx tsx scripts/set-super-admin.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// 환경변수 로드
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수 설정 필요:')
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 .env.local에 설정하세요')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setUserAsAdmin(email: string) {
  try {
    console.log(`\n🔍 ${email} 사용자 조회 중...`)

    // 이메일로 사용자 조회
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      throw new Error(`사용자 목록 조회 실패: ${listError.message}`)
    }

    const user = users.find(u => u.email === email)

    if (!user) {
      console.error(`❌ ${email} 사용자를 찾을 수 없습니다.`)
      console.log('\n📝 등록된 사용자 목록:')
      users.forEach(u => console.log(`  - ${u.email}`))
      return false
    }

    console.log(`✅ 사용자 찾음: ${user.id}`)
    console.log(`📋 현재 메타데이터:`, user.user_metadata)

    // 사용자 메타데이터 업데이트
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          role: 'super_admin'
        }
      }
    )

    if (updateError) {
      throw new Error(`메타데이터 업데이트 실패: ${updateError.message}`)
    }

    console.log(`\n✅ ${email}을(를) 슈퍼어드민으로 설정했습니다!`)
    console.log(`📋 업데이트된 메타데이터:`, updatedUser.user?.user_metadata)
    return true

  } catch (error) {
    console.error(`\n❌ 오류 발생:`, error)
    return false
  }
}

async function main() {
  console.log('🚀 슈퍼어드민 설정 스크립트 시작\n')
  console.log('Supabase URL:', supabaseUrl)

  const success = await setUserAsAdmin('park8374@naver.com')

  if (success) {
    console.log('\n✨ 완료! park8374@naver.com이 이제 슈퍼어드민입니다.')
    console.log('이제 /admin 페이지에 접근할 수 있습니다.')
  } else {
    console.log('\n⚠️  슈퍼어드민 설정에 실패했습니다.')
    console.log('1. park8374@naver.com으로 먼저 회원가입했는지 확인하세요.')
    console.log('2. SUPABASE_SERVICE_ROLE_KEY가 올바른지 확인하세요.')
  }
}

main().catch(console.error)