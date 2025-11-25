import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkNotifications() {
  // 오늘 날짜
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 오늘 알림 개수 확인
  const todayCount = await prisma.notificationLog.count({
    where: {
      createdAt: { gte: today },
    },
  })
  console.log('=== 오늘 알림 통계 ===')
  console.log('오늘 알림 총 개수:', todayCount)

  // tenantId별 알림 개수
  const byTenant = await prisma.notificationLog.groupBy({
    by: ['tenantId'],
    where: {
      createdAt: { gte: today },
    },
    _count: true,
  })
  console.log('\ntenantId별 오늘 알림:')
  for (const t of byTenant) {
    const tenant = await prisma.tenant.findUnique({ where: { id: t.tenantId }, select: { subdomain: true, ownerEmail: true } })
    console.log(`  ${t.tenantId} (${tenant?.subdomain || 'N/A'}, ${tenant?.ownerEmail || 'N/A'}): ${t._count}건`)
  }

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
