import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkRecentEmailLog() {
  console.log('=== 최근 이메일 로그 확인 ===\n')

  const recentEmail = await prisma.emailLog.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      company: {
        select: {
          name: true,
          region: true,
        },
      },
    },
  })

  if (!recentEmail) {
    console.log('이메일 로그가 없습니다.')
    await prisma.$disconnect()
    return
  }

  console.log('발신자:', recentEmail.from)
  console.log('제목:', recentEmail.subject)
  console.log('매칭된 업체:', recentEmail.company?.name)
  console.log('지역:', recentEmail.company?.region)
  console.log('수신 시간 (UTC):', recentEmail.receivedAt?.toISOString())
  console.log('수신 시간 (KST):', recentEmail.receivedAt?.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))
  console.log('처리 시간 (UTC):', recentEmail.createdAt.toISOString())
  console.log('처리 시간 (KST):', recentEmail.createdAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))
  console.log('알림 발송됨:', recentEmail.notificationSent)

  await prisma.$disconnect()
}

checkRecentEmailLog()
