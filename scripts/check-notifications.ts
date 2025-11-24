import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkNotifications() {
  const notifications = await prisma.notificationLog.findMany({
    where: {
      recipient: '01093704931',
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
    include: {
      emailLog: {
        select: {
          subject: true,
          sender: true,
        },
      },
    },
  })

  console.log('=== 알림 발송 내역 ===\n')

  notifications.forEach((notif, index) => {
    console.log(`[${index + 1}] ${notif.type}`)
    console.log(`    수신자: ${notif.recipient}`)
    console.log(`    상태: ${notif.status}`)
    console.log(`    메시지: ${notif.message}`)
    console.log(`    생성: ${notif.createdAt}`)
    console.log(`    발송: ${notif.sentAt || 'N/A'}`)
    console.log(`    에러: ${notif.errorMessage || 'N/A'}`)
    console.log(`    재시도: ${notif.retryCount}/${notif.maxRetries}`)
    console.log('')
  })
}

checkNotifications()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
