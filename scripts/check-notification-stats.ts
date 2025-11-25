import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  // KST 기준 오늘 시작 시간 계산
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)

  const today = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 0, 0, 0, 0)
  )
  today.setTime(today.getTime() - kstOffset)

  console.log('=== 시간 정보 ===')
  console.log('현재 UTC:', now.toISOString())
  console.log('현재 KST:', kstNow.toISOString())
  console.log('오늘 시작(UTC):', today.toISOString())

  // cd-op 테넌트 찾기
  const tenant = await prisma.tenant.findFirst({
    where: { ownerEmail: 'cd-op@hanmail.net' },
  })
  console.log('\n=== 테넌트 정보 ===')
  console.log('테넌트 ID:', tenant?.id)

  // 오늘 알림 (전체)
  const todayAll = await prisma.notificationLog.count({
    where: {
      tenantId: tenant?.id,
      createdAt: { gte: today },
    },
  })

  // 오늘 알림 (SENT만)
  const todaySent = await prisma.notificationLog.count({
    where: {
      tenantId: tenant?.id,
      createdAt: { gte: today },
      status: 'SENT',
    },
  })

  // 상태별 통계
  const byStatus = await prisma.notificationLog.groupBy({
    by: ['status'],
    where: {
      tenantId: tenant?.id,
      createdAt: { gte: today },
    },
    _count: true,
  })

  console.log('\n=== 오늘 알림 통계 ===')
  console.log('전체:', todayAll)
  console.log('SENT만:', todaySent)
  console.log('상태별:', JSON.stringify(byStatus, null, 2))

  // 최근 알림 10개 확인
  const recent = await prisma.notificationLog.findMany({
    where: { tenantId: tenant?.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      type: true,
      recipient: true,
      createdAt: true,
      errorMessage: true,
    },
  })

  console.log('\n=== 최근 알림 10개 ===')
  recent.forEach((n, i) => {
    console.log(`${i + 1}. ${n.status} | ${n.type} | ${n.recipient} | ${n.createdAt.toISOString()}`)
    if (n.errorMessage) console.log(`   에러: ${n.errorMessage}`)
  })

  // 전체 통계
  const totalByStatus = await prisma.notificationLog.groupBy({
    by: ['status'],
    where: { tenantId: tenant?.id },
    _count: true,
  })
  console.log('\n=== 전체 알림 상태별 통계 ===')
  console.log(JSON.stringify(totalByStatus, null, 2))
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
