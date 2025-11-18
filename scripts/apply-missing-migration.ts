import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function applyMissingMigration() {
  console.log('🔧 누락된 마이그레이션 적용 중...\n')

  try {
    // 1. workingDays
    await prisma.$executeRawUnsafe(`
      ALTER TABLE delivery_rules
      ADD COLUMN IF NOT EXISTS "workingDays" TEXT[] DEFAULT ARRAY['1', '2', '3', '4', '5']::TEXT[]
    `)
    console.log('✅ workingDays 컬럼 추가')

    // 2. customClosedDates
    await prisma.$executeRawUnsafe(`
      ALTER TABLE delivery_rules
      ADD COLUMN IF NOT EXISTS "customClosedDates" TEXT[] DEFAULT ARRAY[]::TEXT[]
    `)
    console.log('✅ customClosedDates 컬럼 추가')

    // 3. excludeHolidays
    await prisma.$executeRawUnsafe(`
      ALTER TABLE delivery_rules
      ADD COLUMN IF NOT EXISTS "excludeHolidays" BOOLEAN NOT NULL DEFAULT true
    `)
    console.log('✅ excludeHolidays 컬럼 추가')

    // 4. beforeCutoffDeliveryTime
    await prisma.$executeRawUnsafe(`
      ALTER TABLE delivery_rules
      ADD COLUMN IF NOT EXISTS "beforeCutoffDeliveryTime" TEXT NOT NULL DEFAULT '오전'
    `)
    console.log('✅ beforeCutoffDeliveryTime 컬럼 추가')

    // 5. afterCutoffDeliveryTime
    await prisma.$executeRawUnsafe(`
      ALTER TABLE delivery_rules
      ADD COLUMN IF NOT EXISTS "afterCutoffDeliveryTime" TEXT NOT NULL DEFAULT '오후'
    `)
    console.log('✅ afterCutoffDeliveryTime 컬럼 추가')

    console.log('\n🎉 마이그레이션 완료!')
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

applyMissingMigration()
