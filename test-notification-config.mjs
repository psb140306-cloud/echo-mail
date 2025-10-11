// Simple notification configuration test
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

function testNotificationConfiguration() {
  console.log('🧪 알림 서비스 설정 확인...\n')

  console.log('📋 SMS 설정:')
  console.log('- SMS_PROVIDER:', process.env.SMS_PROVIDER || '❌ 미설정')

  // Aligo SMS 설정
  console.log('- ALIGO_API_KEY:', process.env.ALIGO_API_KEY ? '✅ 설정됨' : '❌ 미설정')
  console.log('- ALIGO_USER_ID:', process.env.ALIGO_USER_ID ? '✅ 설정됨' : '❌ 미설정')
  console.log('- ALIGO_SENDER:', process.env.ALIGO_SENDER || '❌ 미설정')

  // NCP SMS 설정
  console.log('- NCP_ACCESS_KEY:', process.env.NCP_ACCESS_KEY ? '✅ 설정됨' : '❌ 미설정')
  console.log('- NCP_SECRET_KEY:', process.env.NCP_SECRET_KEY ? '✅ 설정됨' : '❌ 미설정')
  console.log('- NCP_SERVICE_ID:', process.env.NCP_SERVICE_ID ? '✅ 설정됨' : '❌ 미설정')
  console.log('')

  console.log('📋 카카오톡 설정:')
  console.log('- KAKAO_API_KEY:', process.env.KAKAO_API_KEY ? '✅ 설정됨' : '❌ 미설정')
  console.log('- KAKAO_API_SECRET:', process.env.KAKAO_API_SECRET ? '✅ 설정됨' : '❌ 미설정')
  console.log('- KAKAO_SENDER_KEY:', process.env.KAKAO_SENDER_KEY ? '✅ 설정됨' : '❌ 미설정')
  console.log('')

  const aligoConfigured = process.env.ALIGO_API_KEY &&
                         process.env.ALIGO_USER_ID &&
                         process.env.ALIGO_SENDER

  const ncpConfigured = process.env.NCP_ACCESS_KEY &&
                       process.env.NCP_SECRET_KEY &&
                       process.env.NCP_SERVICE_ID

  const smsConfigured = aligoConfigured || ncpConfigured

  const kakaoConfigured = process.env.KAKAO_API_KEY &&
                         process.env.KAKAO_API_SECRET &&
                         process.env.KAKAO_SENDER_KEY

  console.log('📊 설정 상태:')
  console.log(`- SMS 발송: ${smsConfigured ? '✅ 가능' : '❌ 설정 필요'}`)
  console.log(`- 카카오톡 발송: ${kakaoConfigured ? '✅ 가능' : '❌ 설정 필요'}`)
  console.log('')

  if (!smsConfigured && !kakaoConfigured) {
    console.log('⚠️  알림 발송을 위해서는 최소 하나의 서비스 설정이 필요합니다.')
    console.log('')
    console.log('📖 설정 방법:')
    console.log('1. SMS 발송 설정 (Aligo):')
    console.log('   - SMS_PROVIDER=aligo')
    console.log('   - ALIGO_API_KEY=your_api_key')
    console.log('   - ALIGO_USER_ID=your_user_id')
    console.log('   - ALIGO_SENDER=010-1234-5678')
    console.log('')
    console.log('2. SMS 발송 설정 (NCP):')
    console.log('   - SMS_PROVIDER=ncp')
    console.log('   - NCP_ACCESS_KEY=your_access_key')
    console.log('   - NCP_SECRET_KEY=your_secret_key')
    console.log('   - NCP_SERVICE_ID=your_service_id')
    console.log('')
    console.log('3. 카카오톡 발송 설정:')
    console.log('   - KAKAO_API_KEY=your_api_key')
    console.log('   - KAKAO_API_SECRET=your_api_secret')
    console.log('   - KAKAO_SENDER_KEY=your_sender_key')

    return false
  }

  console.log('🎉 알림 서비스 설정 확인 완료!')
  return true
}

// 스크립트 실행
const success = testNotificationConfiguration()
if (!success) {
  process.exit(1)
}