// Simple queue test
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function testQueueConfiguration() {
  console.log('🧪 큐 서비스 설정 확인...\n')

  // Redis 설정 확인
  console.log('📋 Redis 설정:')
  console.log('- REDIS_URL:', process.env.REDIS_URL ? '✅ 설정됨' : '❌ 미설정')
  console.log('')

  if (!process.env.REDIS_URL) {
    console.error('❌ Redis 설정이 누락되었습니다.')
    console.error('REDIS_URL 환경변수를 .env.local에서 확인하세요.')
    return false
  }

  console.log('✅ Redis 설정 완료')

  // Redis URL 파싱 테스트
  try {
    const url = new URL(process.env.REDIS_URL)
    console.log(`🔍 Redis 연결 정보:`)
    console.log(`   - 호스트: ${url.hostname}`)
    console.log(`   - 포트: ${url.port || 6379}`)
    console.log(`   - 프로토콜: ${url.protocol}`)

    return true
  } catch (error) {
    console.error('❌ Redis URL 파싱 실패:', error.message)
    return false
  }
}

// 스크립트 실행
testQueueConfiguration()
  .then(success => {
    if (success) {
      console.log('\n🎉 큐 서비스 기본 설정 확인 완료!')
      console.log('📌 실제 Redis 연결 테스트는 프로덕션 환경에서 수행하세요.')
    } else {
      console.log('\n❌ 큐 서비스 설정에 문제가 있습니다.')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ 테스트 실행 실패:', error.message)
    process.exit(1)
  })