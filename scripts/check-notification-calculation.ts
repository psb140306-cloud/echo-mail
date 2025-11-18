import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkNotificationCalculation() {
  console.log('=== 알림 계산 상세 확인 ===\n')

  const recentNotification = await prisma.notificationLog.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      company: {
        select: {
          name: true,
          region: true,
          tenantId: true,
        },
      },
      emailLog: {
        select: {
          subject: true,
          receivedAt: true,
          createdAt: true,
        },
      },
    },
  })

  if (!recentNotification) {
    console.log('알림이 없습니다.')
    await prisma.$disconnect()
    return
  }

  console.log('업체:', recentNotification.company?.name)
  console.log('지역:', recentNotification.company?.region)
  console.log('\n메일 정보:')
  console.log('- 제목:', recentNotification.emailLog?.subject)
  console.log('- 수신 시간 (UTC):', recentNotification.emailLog?.receivedAt?.toISOString())
  console.log('- 수신 시간 (KST):', recentNotification.emailLog?.receivedAt?.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))

  console.log('\n알림 발송 정보:')
  console.log('- 발송 시간 (UTC):', recentNotification.createdAt.toISOString())
  console.log('- 발송 시간 (KST):', recentNotification.createdAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))
  console.log('- 메시지:', recentNotification.message)

  // message가 JSON이면 파싱
  try {
    const parsed = JSON.parse(recentNotification.message)
    console.log('\n파싱된 메시지:')
    console.log(JSON.stringify(parsed, null, 2))
  } catch (e) {
    // JSON이 아니면 그냥 출력
  }

  await prisma.$disconnect()
}

checkNotificationCalculation()
