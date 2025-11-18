import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkHoliday2025() {
  console.log('=== 2025년 11월 공휴일 확인 ===\n')

  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: new Date('2025-11-01T00:00:00.000Z'),
        lte: new Date('2025-11-30T23:59:59.999Z'),
      },
    },
    orderBy: {
      date: 'asc',
    },
  })

  if (holidays.length === 0) {
    console.log('❌ 2025년 11월에 등록된 공휴일이 없습니다.')
  } else {
    console.log(`✅ 총 ${holidays.length}개의 공휴일:`)
    holidays.forEach((holiday) => {
      const kstDate = holiday.date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      console.log(`  - ${kstDate}: ${holiday.name}`)
    })
  }

  await prisma.$disconnect()
}

checkHoliday2025()
