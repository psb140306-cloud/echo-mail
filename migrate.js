// Prisma 마이그레이션 스크립트
require('dotenv').config({ path: '.env.local' })
const { execSync } = require('child_process')

console.log('🚀 Prisma 마이그레이션 시작...')

// 환경변수 확인
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL이 설정되지 않았습니다.')
  process.exit(1)
}

try {
  // 1. Prisma generate
  console.log('📦 Prisma Client 생성...')
  execSync('npx prisma generate', {
    stdio: 'inherit',
    env: { ...process.env },
  })

  // 2. Database push
  console.log('📡 데이터베이스 스키마 push...')
  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env },
  })

  console.log('✅ 마이그레이션 완료!')
} catch (error) {
  console.error('❌ 마이그레이션 실패:', error.message)
  process.exit(1)
}
