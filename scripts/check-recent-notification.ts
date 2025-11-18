import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkRecentNotification() {
  console.log('=== 최근 알림 확인 ===\n')

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
    },
  })

  if (!recentNotification) {
    console.log('알림이 없습니다.')
    await prisma.$disconnect()
    return
  }

  console.log('업체:', recentNotification.company?.name)
  console.log('지역:', recentNotification.company?.region)
  console.log('메시지:', recentNotification.message)
  console.log('발송 시간:', recentNotification.createdAt)
  console.log()

  if (recentNotification.company?.region && recentNotification.company?.tenantId) {
    const rule = await prisma.deliveryRule.findFirst({
      where: {
        region: recentNotification.company.region,
        tenantId: recentNotification.company.tenantId,
        isActive: true,
      },
    })

    if (rule) {
      console.log('=== 납품 규칙 ===')
      console.log('지역:', rule.region)
      console.log('마감 시간:', rule.cutoffTime)
      console.log('마감 전 배송일:', rule.beforeCutoffDays, '일 후')
      console.log('마감 후 배송일:', rule.afterCutoffDays, '일 후')
      console.log('마감 전 배송 시간:', rule.beforeCutoffDeliveryTime)
      console.log('마감 후 배송 시간:', rule.afterCutoffDeliveryTime)
      console.log('영업일:', rule.workingDays)
      console.log('공휴일 제외:', rule.excludeHolidays)
      console.log('커스텀 휴무일:', rule.customClosedDates)
    } else {
      console.log('❌ 납품 규칙을 찾을 수 없습니다.')
    }
  }

  await prisma.$disconnect()
}

checkRecentNotification()
