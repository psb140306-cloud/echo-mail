import { PrismaClient } from '@prisma/client'
import { DeliveryCalculator } from '@/lib/utils/delivery-calculator'

const prisma = new PrismaClient()

async function testDeliveryCalculation() {
  console.log('=== 납품일 계산 테스트 ===\n')

  // 경기 지역 규칙 가져오기
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

  console.log('납품 규칙:')
  console.log('- 마감 시간:', rule.cutoffTime)
  console.log('- 마감 전 배송일:', rule.beforeCutoffDays, '일 후,', rule.beforeCutoffDeliveryTime)
  console.log('- 마감 후 배송일:', rule.afterCutoffDays, '일 후,', rule.afterCutoffDeliveryTime)
  console.log('- 영업일:', rule.workingDays)
  console.log()

  // 테스트 케이스: 11/18(월) 11:24
  const testDate = new Date('2024-11-18T11:24:00+09:00')
  console.log('테스트 주문 시간:', testDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))
  console.log('UTC:', testDate.toISOString())
  console.log()

  const calculator = new DeliveryCalculator()
  const result = await calculator.calculateDeliveryDate({
    orderDateTime: testDate,
    region: '경기',
    tenantId: rule.tenantId,
  })

  console.log('계산 결과:')
  console.log('- 납품일:', result.deliveryDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))
  console.log('- 배송 시간:', result.deliveryTime)
  console.log('- 포맷된 날짜:', result.formattedDate)
  console.log('- 마감 전 주문:', result.isBeforeCutoff)

  await prisma.$disconnect()
}

testDeliveryCalculation()
