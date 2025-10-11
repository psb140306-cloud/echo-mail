// 환경변수를 직접 설정하여 마이그레이션 실행
const { execSync } = require('child_process')
const dotenv = require('dotenv')

// Load environment variables
dotenv.config({ path: '.env.local' })

console.log('🚀 환경변수와 함께 마이그레이션 실행...')
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL이 설정되지 않았습니다.')
  process.exit(1)
}

try {
  console.log('📡 Prisma DB Push 실행...')

  // 환경변수를 명시적으로 전달
  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL,
  }

  const result = execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: env,
    timeout: 60000, // 1분 타임아웃
  })

  console.log('✅ 마이그레이션 성공!')
} catch (error) {
  console.error('❌ 마이그레이션 실패:', error.message)

  // 더 자세한 연결 정보 출력
  console.log('\n🔍 연결 디버그 정보:')
  const url = process.env.DATABASE_URL
  const urlParts = url.match(/postgresql:\/\/(.+):(.+)@(.+):(\d+)\/(.+)/)

  if (urlParts) {
    console.log('- 사용자:', urlParts[1])
    console.log('- 호스트:', urlParts[3])
    console.log('- 포트:', urlParts[4])
    console.log('- 데이터베이스:', urlParts[5])
  }
}
