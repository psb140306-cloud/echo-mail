const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

async function main() {
  const userEmail = 'park8374@naver.com'

  console.log('='.repeat(60))
  console.log(`${userEmail} 계정 정보 확인`)
  console.log('='.repeat(60))

  // 1. 사용자 조회
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      tenant: true,
    }
  })

  if (!user) {
    console.log('\n❌ 사용자를 찾을 수 없습니다.')
    return
  }

  console.log('\n[사용자 정보]')
  console.log(`ID: ${user.id}`)
  console.log(`Email: ${user.email}`)
  console.log(`Name: ${user.name}`)
  console.log(`Tenant ID: ${user.tenantId}`)
  console.log(`Tenant Name: ${user.tenant?.name || 'N/A'}`)

  const tenantId = user.tenantId

  // 2. 구독 정보
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId }
  })

  console.log('\n[구독 정보]')
  if (subscription) {
    console.log(`Plan: ${subscription.plan}`)
    console.log(`Status: ${subscription.status}`)
    console.log(`Price: ${subscription.priceAmount}원`)
    console.log(`Period: ${subscription.currentPeriodStart.toISOString()} ~ ${subscription.currentPeriodEnd.toISOString()}`)
  } else {
    console.log('❌ 구독 정보가 없습니다.')
  }

  // 3. 이메일 로그 통계
  const now = new Date()
  const koreaOffset = 9 * 60
  const koreaTime = new Date(now.getTime() + koreaOffset * 60 * 1000)
  const startOfMonth = new Date(Date.UTC(
    koreaTime.getUTCFullYear(),
    koreaTime.getUTCMonth(),
    1,
    0, 0, 0, 0
  ))
  startOfMonth.setHours(startOfMonth.getHours() - 9)

  const totalEmails = await prisma.emailLog.count({ where: { tenantId } })
  const emailsThisMonth = await prisma.emailLog.count({
    where: {
      tenantId,
      createdAt: { gte: startOfMonth },
    },
  })

  console.log('\n[이메일 처리 통계]')
  console.log(`전체: ${totalEmails}건`)
  console.log(`이번 달: ${emailsThisMonth}건`)
  console.log(`월 초: ${startOfMonth.toISOString()}`)

  // 4. 알림 로그 통계
  const totalNotifications = await prisma.notificationLog.count({ where: { tenantId } })
  const notificationsThisMonth = await prisma.notificationLog.count({
    where: {
      tenantId,
      createdAt: { gte: startOfMonth },
    },
  })

  console.log('\n[알림 발송 통계]')
  console.log(`전체: ${totalNotifications}건`)
  console.log(`이번 달: ${notificationsThisMonth}건`)

  // 5. 알림 로그 상세 (최근 10건)
  const recentNotifications = await prisma.notificationLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      type: true,
      status: true,
      createdAt: true,
      recipient: true,
    },
  })

  console.log('\n[최근 알림 로그 10건]')
  if (recentNotifications.length > 0) {
    recentNotifications.forEach((n, i) => {
      console.log(`${i + 1}. [${n.type}] ${n.status} - ${n.recipient} (${n.createdAt.toISOString()})`)
    })
  } else {
    console.log('❌ 알림 로그가 없습니다.')
  }

  // 6. 이메일 로그 상세 (최근 5건)
  const recentEmails = await prisma.emailLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      sender: true,
      subject: true,
      status: true,
      createdAt: true,
    },
  })

  console.log('\n[최근 이메일 로그 5건]')
  if (recentEmails.length > 0) {
    recentEmails.forEach((e, i) => {
      console.log(`${i + 1}. [${e.status}] ${e.sender} - "${e.subject}" (${e.createdAt.toISOString()})`)
    })
  } else {
    console.log('❌ 이메일 로그가 없습니다.')
  }

  console.log('\n' + '='.repeat(60))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
