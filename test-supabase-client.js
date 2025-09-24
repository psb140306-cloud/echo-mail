// Supabase 클라이언트 직접 테스트
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function testSupabaseClient() {
  console.log('🧪 Supabase 클라이언트 테스트...')

  // 환경변수 확인
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('Supabase URL:', url)
  console.log('Anon Key:', anonKey ? `${anonKey.substring(0, 20)}...` : 'NOT SET')

  if (!url || !anonKey) {
    console.error('❌ Supabase 환경변수가 설정되지 않았습니다.')
    return
  }

  const supabase = createClient(url, anonKey)

  try {
    // 1. 연결 테스트 - health check
    console.log('\n1️⃣ 기본 연결 테스트...')
    const { data: healthCheck, error: connError } = await supabase.rpc('pg_backend_pid')

    if (connError) {
      console.error('❌ 연결 실패:', connError.message)
      // 연결이 실패해도 계속 진행
    } else {
      console.log('✅ Supabase 연결 성공! (Backend PID:', healthCheck, ')')
    }

    // 2. 데이터베이스 버전 확인
    console.log('\n2️⃣ 데이터베이스 정보 확인...')
    const { data: version, error: versionError } = await supabase.rpc('version')

    if (!versionError && version) {
      console.log('DB 버전:', version.substring(0, 50) + '...')
    }

    // 3. 테이블 존재 여부 확인
    console.log('\n3️⃣ 테이블 존재 여부 확인...')
    const tables = ['companies', 'contacts', 'users']

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.log(`📋 ${table}: 테이블이 존재하지 않음 (마이그레이션 필요)`)
        } else {
          console.log(`📋 ${table}: 오류 - ${error.message}`)
        }
      } else {
        console.log(`📋 ${table}: ✅ 존재함 (${data.length} 레코드)`)
      }
    }

    // 4. 스키마 생성 권한 테스트
    console.log('\n4️⃣ 스키마 생성 권한 테스트...')
    const { data: testTable, error: createError } = await supabase.rpc('test_schema_permissions')

    if (createError) {
      console.log('⚠️ 스키마 생성 권한 제한 (정상 - RLS 때문)')
    }

  } catch (error) {
    console.error('❌ 예상치 못한 오류:', error.message)
  }
}

testSupabaseClient()