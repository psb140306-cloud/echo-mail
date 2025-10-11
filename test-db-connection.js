// Supabase 데이터베이스 연결 테스트
require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')

async function testConnection() {
  console.log('🔗 Supabase 데이터베이스 연결 테스트...')

  // 환경변수 확인
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')
  console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET')

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL이 설정되지 않았습니다.')
    console.error(
      '   .env.local 파일에서 DATABASE_URL의 password 부분을 실제 비밀번호로 변경하세요.'
    )
    return
  }

  const prisma = new PrismaClient()

  try {
    // 데이터베이스 연결 테스트
    await prisma.$connect()
    console.log('✅ 데이터베이스 연결 성공!')

    // 테이블 존재 여부 확인
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `

    console.log('📋 현재 테이블:', tables.map((t) => t.table_name).join(', '))
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error.message)

    if (error.message.includes('password authentication failed')) {
      console.error('   💡 비밀번호가 틀렸습니다. .env.local의 DATABASE_URL을 확인하세요.')
    } else if (error.message.includes('connection refused')) {
      console.error('   💡 연결이 거부되었습니다. 네트워크나 호스트 주소를 확인하세요.')
    }
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
