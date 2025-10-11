// Simple mail service test
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function testMailConfiguration() {
  console.log('🧪 메일 서비스 설정 확인...\n')

  // 환경변수 확인
  console.log('📋 메일 설정:')
  console.log('- MAIL_HOST:', process.env.MAIL_HOST || '❌ 미설정')
  console.log('- MAIL_PORT:', process.env.MAIL_PORT || '❌ 미설정')
  console.log('- MAIL_SECURE:', process.env.MAIL_SECURE || '❌ 미설정')
  console.log('- MAIL_USER:', process.env.MAIL_USER || '❌ 미설정')
  console.log('- MAIL_PASSWORD:', process.env.MAIL_PASSWORD ? '✅ 설정됨' : '❌ 미설정')
  console.log('')

  const isConfigured = process.env.MAIL_HOST &&
                      process.env.MAIL_USER &&
                      process.env.MAIL_PASSWORD

  if (!isConfigured) {
    console.error('❌ 메일 설정이 완전하지 않습니다.')
    console.error('다음 환경변수를 .env.local에서 확인하세요:')
    console.error('- MAIL_HOST, MAIL_USER, MAIL_PASSWORD')
    return false
  }

  console.log('✅ 메일 설정 완료')

  // 기본 연결 가능성 테스트 (DNS 해석)
  try {
    const dns = await import('dns')
    const { promisify } = await import('util')
    const lookup = promisify(dns.default.lookup)

    console.log(`🔍 DNS 해석 테스트: ${process.env.MAIL_HOST}`)
    const result = await lookup(process.env.MAIL_HOST)
    console.log(`✅ DNS 해석 성공: ${result.address}`)

    return true
  } catch (error) {
    console.error('❌ DNS 해석 실패:', error.message)
    return false
  }
}

// 스크립트 실행
testMailConfiguration()
  .then(success => {
    if (success) {
      console.log('\n🎉 메일 서비스 기본 설정 확인 완료!')
      console.log('📌 실제 IMAP 연결 테스트는 프로덕션 환경에서 수행하세요.')
    } else {
      console.log('\n❌ 메일 서비스 설정에 문제가 있습니다.')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ 테스트 실행 실패:', error.message)
    process.exit(1)
  })