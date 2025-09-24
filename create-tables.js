// Supabase에 직접 테이블 생성 SQL 실행
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function createTables() {
  console.log('🏗️ Echo Mail 데이터베이스 테이블 생성...')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log('Supabase URL:', url)
  console.log('Service Role Key:', serviceRoleKey ? `${serviceRoleKey.substring(0, 20)}...` : 'NOT SET')

  if (!url || !serviceRoleKey) {
    console.error('❌ Supabase 환경변수가 설정되지 않았습니다.')
    return
  }

  // Service Role Key로 클라이언트 생성 (모든 권한)
  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    // 마이그레이션 SQL 파일 읽기
    const migrationPath = path.join(__dirname, 'prisma', 'migrations', '20250924_initial_schema', 'migration.sql')

    if (!fs.existsSync(migrationPath)) {
      console.error('❌ 마이그레이션 파일을 찾을 수 없습니다:', migrationPath)
      return
    }

    const migrationSql = fs.readFileSync(migrationPath, 'utf8')
    console.log('📄 마이그레이션 SQL 파일 로드됨 (' + migrationSql.length + ' bytes)')

    // SQL을 개별 명령문으로 분리
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📊 총 ${statements.length}개의 SQL 명령문 실행 예정`)

    // 각 명령문을 순차적으로 실행
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      console.log(`\n${i + 1}/${statements.length}. 실행 중...`)
      console.log(statement.substring(0, 60) + '...')

      try {
        const { data, error } = await supabase.rpc('exec_sql', { query: statement })

        if (error) {
          console.error(`❌ SQL 실행 실패: ${error.message}`)
          // 테이블이 이미 존재하는 경우는 무시
          if (!error.message.includes('already exists')) {
            throw error
          } else {
            console.log('⚠️ 테이블이 이미 존재함 (스킵)')
          }
        } else {
          console.log('✅ 성공')
        }
      } catch (sqlError) {
        console.error(`❌ SQL 실행 중 오류: ${sqlError.message}`)

        // 테이블 생성 관련 오류가 아니면 중단
        if (!sqlError.message.includes('already exists') &&
            !sqlError.message.includes('does not exist')) {
          throw sqlError
        }
      }
    }

    console.log('\n🎉 테이블 생성 완료!')

    // 테이블 목록 확인
    console.log('\n📋 생성된 테이블 확인...')
    await checkTables()

  } catch (error) {
    console.error('❌ 데이터베이스 테이블 생성 실패:', error.message)
  }
}

async function checkTables() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = createClient(url, anonKey)

  const tables = ['companies', 'contacts', 'users', 'email_logs', 'notification_logs', 'system_configs']

  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log(`📋 ${table}: ❌ 존재하지 않음`)
      } else {
        console.log(`📋 ${table}: ⚠️ 오류 - ${error.message}`)
      }
    } else {
      console.log(`📋 ${table}: ✅ 존재함 (${count} 레코드)`)
    }
  }
}

createTables()