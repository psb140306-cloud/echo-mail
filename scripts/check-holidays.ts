import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkHolidays() {
  console.log('=== 공휴일 확인 (11/18 ~ 11/20) ===\n')

  const dates = ['2024-11-18', '2024-11-19', '2024-11-20']

  for (const date of dates) {
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: new Date(date + 'T00:00:00.000Z'),
      },
    })

    if (holiday) {
      console.log(`${date}: ✅ 공휴일 - ${holiday.name}`)
    } else {
      console.log(`${date}: ❌ 공휴일 아님`)
    }
  }

  await prisma.$disconnect()
}

checkHolidays()
