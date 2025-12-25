import { PrismaClient } from '@prisma/client'
import { generateHolidays } from '../lib/utils/holiday-calculator'

const prisma = new PrismaClient()

async function run() {
  const currentYear = new Date().getFullYear()
  const nextYear = currentYear + 1

  console.log(`\n=== 공휴일 자동 생성 (${currentYear}년, ${nextYear}년) ===\n`)

  // 모든 테넌트 조회
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
  })

  console.log(`총 테넌트 수: ${tenants.length}\n`)

  let created = 0
  let skipped = 0

  for (const tenant of tenants) {
    // 현재 연도 공휴일 확인
    const existingCurrentYear = await prisma.holiday.count({
      where: {
        tenantId: tenant.id,
        date: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`),
        },
      },
    })

    // 다음 연도 공휴일 확인
    const existingNextYear = await prisma.holiday.count({
      where: {
        tenantId: tenant.id,
        date: {
          gte: new Date(`${nextYear}-01-01`),
          lt: new Date(`${nextYear + 1}-01-01`),
        },
      },
    })

    const yearsToGenerate: number[] = []
    if (existingCurrentYear === 0) yearsToGenerate.push(currentYear)
    if (existingNextYear === 0) yearsToGenerate.push(nextYear)

    if (yearsToGenerate.length === 0) {
      console.log(`✓ ${tenant.name}: 이미 공휴일 있음 (스킵)`)
      skipped++
      continue
    }

    // 공휴일 생성
    let totalCreated = 0
    for (const year of yearsToGenerate) {
      const holidays = generateHolidays(year)
      if (holidays.length > 0) {
        const result = await prisma.holiday.createMany({
          data: holidays.map((h) => ({
            name: h.name,
            date: new Date(h.date),
            isRecurring: false,
            tenantId: tenant.id,
          })),
          skipDuplicates: true,
        })
        totalCreated += result.count
      }
    }

    console.log(`✓ ${tenant.name}: ${yearsToGenerate.join(', ')}년 공휴일 ${totalCreated}개 생성`)
    created++
  }

  console.log(`\n=== 완료 ===`)
  console.log(`생성: ${created}개 테넌트`)
  console.log(`스킵: ${skipped}개 테넌트`)

  await prisma.$disconnect()
}

run().catch(console.error)
