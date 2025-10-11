// 메일 서비스 테스트 스크립트
const dotenv = require('dotenv')

// Load environment variables
dotenv.config({ path: '.env.local' })

async function testMailConnection() {
  console.log('🧪 메일 서비스 연결 테스트 시작...\n')

  // 환경변수 확인
  console.log('📋 메일 설정 확인:')
  console.log('- MAIL_HOST:', process.env.MAIL_HOST)
  console.log('- MAIL_PORT:', process.env.MAIL_PORT)
  console.log('- MAIL_SECURE:', process.env.MAIL_SECURE)
  console.log('- MAIL_USER:', process.env.MAIL_USER)
  console.log('- MAIL_PASSWORD:', process.env.MAIL_PASSWORD ? 'SET' : 'NOT SET')
  console.log('')

  if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASSWORD) {
    console.error('❌ 메일 설정이 완전하지 않습니다.')
    console.error('다음 환경변수를 .env.local에서 확인하세요:')
    console.error('- MAIL_HOST, MAIL_USER, MAIL_PASSWORD')
    return
  }

  try {
    // 동적 import를 사용하여 ES 모듈 로드
    const { ImapClient } = await import('./lib/mail/imap-client.ts')

    const config = {
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || '993'),
      secure: process.env.MAIL_SECURE === 'true',
      user: process.env.MAIL_USER,
      password: process.env.MAIL_PASSWORD,
      checkInterval: 10000, // 테스트용 짧은 간격
    }

    console.log('🔄 IMAP 클라이언트 생성 중...')
    const client = new ImapClient(config)

    console.log('🔗 IMAP 서버 연결 시도...')
    const connected = await client.connect()

    if (!connected) {
      console.error('❌ IMAP 연결 실패')
      return
    }

    console.log('✅ IMAP 연결 성공!')

    console.log('📂 INBOX 선택 중...')
    const selected = await client.selectMailbox('INBOX')

    if (!selected) {
      console.error('❌ INBOX 선택 실패')
      await client.disconnect()
      return
    }

    console.log('✅ INBOX 선택 성공!')

    console.log('📧 읽지 않은 메일 확인 중...')
    const emails = await client.getUnseenEmails()

    console.log(`📬 읽지 않은 메일 ${emails.length}개 발견`)

    if (emails.length > 0) {
      console.log('\n📋 최근 메일 목록:')
      emails.slice(0, 5).forEach((email, index) => {
        console.log(`${index + 1}. 발신자: ${email.from}`)
        console.log(`   제목: ${email.subject}`)
        console.log(`   수신시간: ${email.receivedAt.toLocaleString('ko-KR')}`)
        console.log(`   첨부파일: ${email.attachments.length}개`)
        console.log('')
      })
    }

    console.log('🔌 연결 해제 중...')
    await client.disconnect()
    console.log('✅ 연결 해제 완료')

    console.log('\n🎉 메일 서비스 테스트 완료!')
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message)

    if (error.code === 'EAUTH') {
      console.error('\n🔐 인증 오류 해결 방법:')
      console.error('1. Gmail 앱 비밀번호 사용 확인')
      console.error('2. 2단계 인증 설정 확인')
      console.error('3. 보안 수준이 낮은 앱 허용 설정')
    } else if (error.code === 'ECONNECTION') {
      console.error('\n🌐 연결 오류 해결 방법:')
      console.error('1. 인터넷 연결 확인')
      console.error('2. 방화벽 설정 확인')
      console.error('3. MAIL_HOST와 MAIL_PORT 설정 확인')
    }
  }
}

// 스크립트 실행
testMailConnection().catch(console.error)
