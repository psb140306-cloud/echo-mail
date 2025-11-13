import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testFixes() {
  console.log('='.repeat(60))
  console.log('테스트: 수정사항 검증')
  console.log('='.repeat(60))

  const tenantId = 'b6f80a6a-9e11-40c6-950f-9c387e9e20dc'
  const companyId = 'da8497f5-8cb8-4fa2-95f7-de17c9f59752'

  console.log('\n1. 템플릿 변수 테스트')
  console.log('-'.repeat(40))

  // 배송 시간 계산 테스트
  const orderTimes = [
    new Date('2025-01-13T09:00:00'), // 오전 9시
    new Date('2025-01-13T13:00:00'), // 오후 1시
    new Date('2025-01-13T15:00:00'), // 오후 3시
  ]

  for (const orderTime of orderTimes) {
    const hour = orderTime.getHours()
    const cutoffHour = 14 // 일반적인 마감 시간
    const deliveryTime = hour < cutoffHour ? '오전' : '오후'

    console.log(`주문 시간: ${orderTime.toLocaleString('ko-KR')} -> 배송 시간대: ${deliveryTime}`)
  }

  console.log('\n2. 중복 이메일 체크 테스트')
  console.log('-'.repeat(40))

  // 최근 이메일 로그 확인
  const recentEmails = await prisma.emailLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      messageId: true,
      sender: true,
      subject: true,
      createdAt: true,
    }
  })

  console.log(`최근 이메일 로그 ${recentEmails.length}건:`)
  recentEmails.forEach((email, i) => {
    console.log(`${i + 1}. MessageID: ${email.messageId}`)
    console.log(`   발신자: ${email.sender}`)
    console.log(`   제목: ${email.subject}`)
    console.log(`   시간: ${email.createdAt.toLocaleString('ko-KR')}`)
  })

  // 중복 체크
  const messageIds = recentEmails.map(e => e.messageId)
  const uniqueMessageIds = [...new Set(messageIds)]

  if (messageIds.length !== uniqueMessageIds.length) {
    console.log('⚠️ 경고: 중복된 MessageID 발견!')
  } else {
    console.log('✅ 모든 MessageID가 고유함')
  }

  console.log('\n3. SMS 바이트 계산 테스트')
  console.log('-'.repeat(40))

  const testMessages = [
    '[발주 접수] 대한상사님, 발주가 접수되었습니다. 납품일: 2025년 1월 14일 화요일 오전',
    '[발주 접수] 대한상사님, 발주가 접수되었습니다. 납품일: 2025년 1월 14일 화요일 {{deliveryTime}}',
  ]

  for (const message of testMessages) {
    const charLength = message.length
    const byteLength = Buffer.from(message, 'utf8').length
    const messageType = byteLength <= 90 ? 'SMS' : 'LMS'

    console.log(`메시지: ${message}`)
    console.log(`  문자 수: ${charLength}자`)
    console.log(`  바이트: ${byteLength}bytes`)
    console.log(`  타입: ${messageType}`)
    console.log('')
  }

  console.log('\n4. 최근 알림 발송 상태')
  console.log('-'.repeat(40))

  const recentNotifications = await prisma.notificationLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      type: true,
      status: true,
      recipient: true,
      message: true,
      createdAt: true,
      errorMessage: true,
    }
  })

  console.log(`최근 알림 ${recentNotifications.length}건:`)
  recentNotifications.forEach((notif, i) => {
    console.log(`${i + 1}. [${notif.type}] ${notif.status}`)
    console.log(`   수신자: ${notif.recipient}`)
    console.log(`   시간: ${notif.createdAt.toLocaleString('ko-KR')}`)

    if (notif.message) {
      try {
        const vars = JSON.parse(notif.message)
        if (vars.deliveryTime) {
          console.log(`   ✅ deliveryTime 변수 포함: ${vars.deliveryTime}`)
        } else {
          console.log(`   ⚠️ deliveryTime 변수 누락`)
        }
      } catch (e) {
        console.log(`   메시지: ${notif.message.substring(0, 50)}...`)
      }
    }

    if (notif.errorMessage) {
      console.log(`   에러: ${notif.errorMessage}`)
    }
  })

  console.log('\n' + '='.repeat(60))
}

testFixes()
  .catch(console.error)
  .finally(() => prisma.$disconnect())