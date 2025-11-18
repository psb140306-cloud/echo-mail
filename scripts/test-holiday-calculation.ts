import { PrismaClient } from '@prisma/client'
import { DeliveryCalculator } from '@/lib/utils/delivery-calculator'

const prisma = new PrismaClient()

async function testHolidayCalculation() {
  console.log('=== 공휴일 포함 납품일 계산 테스트 ===\n')

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

  // 테스트용 공휴일 생성 (11/19)
  // 먼저 기존 테스트 공휴일 삭제
  await prisma.holiday.deleteMany({
    where: {
      tenantId: rule.tenantId,
      name: '테스트 공휴일',
    },
  })

  const testHoliday = await prisma.holiday.create({
    data: {
      tenantId: rule.tenantId,
      name: '테스트 공휴일',
      date: new Date('2025-11-19T00:00:00.000Z'),
    },
  })

  console.log('✅ 테스트 공휴일 생성:', testHoliday.date.toISOString(), '-', testHoliday.name)
  console.log()

  console.log('납품 규칙:')
  console.log('- 마감 시간:', rule.cutoffTime)
  console.log('- 마감 전 배송일:', rule.beforeCutoffDays, '일 후,', rule.beforeCutoffDeliveryTime)
  console.log('- 영업일:', rule.workingDays)
  console.log('- 공휴일 제외:', rule.excludeHolidays)
  console.log()

  // 테스트 케이스: 11/18(화) 11:24
  const testDate = new Date('2025-11-18T11:24:00+09:00')
  console.log('테스트 주문 시간:', testDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))
  console.log()

  const calculator = new DeliveryCalculator()
  const result = await calculator.calculateDeliveryDate({
    orderDateTime: testDate,
    region: '경기',
    tenantId: rule.tenantId,
  })

  console.log('계산 결과:')
  console.log('- 납품일 (KST):', result.deliveryDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))
  console.log('- 배송 시간:', result.deliveryTime)
  console.log()
  console.log('✅ 예상: 11/19가 공휴일이므로 → 11/20 (목)')

  // 테스트 공휴일 삭제
  await prisma.holiday.delete({
    where: {
      id: testHoliday.id,
    },
  })
  console.log('\n🗑️  테스트 공휴일 삭제 완료')

  await prisma.$disconnect()
}

testHolidayCalculation()
