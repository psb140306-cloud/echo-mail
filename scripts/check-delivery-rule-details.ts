import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDeliveryRuleDetails() {
  console.log('=== 납품 규칙 상세 확인 (경기 지역) ===\n')

  const rule = await prisma.deliveryRule.findFirst({
    where: {
      region: '경기',
      isActive: true,
    },
  })

  if (!rule) {
    console.log('❌ 규칙을 찾을 수 없습니다.')
    await prisma.$disconnect()
    return
  }

  console.log('지역:', rule.region)
  console.log('마감 시간:', rule.cutoffTime)
  console.log('마감 전 배송일:', rule.beforeCutoffDays, '일 후')
  console.log('마감 후 배송일:', rule.afterCutoffDays, '일 후')
  console.log('마감 전 배송 시간:', rule.beforeCutoffDeliveryTime)
  console.log('마감 후 배송 시간:', rule.afterCutoffDeliveryTime)
  console.log('영업일:', rule.workingDays)
  console.log('공휴일 제외:', rule.excludeHolidays)
  console.log('\n커스텀 휴무일 (customClosedDates):')
  console.log(rule.customClosedDates)
  console.log('\nJSON:')
  console.log(JSON.stringify(rule.customClosedDates, null, 2))

  await prisma.$disconnect()
}

checkDeliveryRuleDetails()
