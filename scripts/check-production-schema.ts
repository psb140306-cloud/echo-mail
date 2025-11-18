import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkProductionSchema() {
  console.log('🔍 Production DB 스키마 확인 중...\n')

  try {
    // 납품 규칙 하나 조회
    const rule = await prisma.deliveryRule.findFirst({
      select: {
        id: true,
        region: true,
        beforeCutoffDays: true,
        afterCutoffDays: true,
        beforeCutoffDeliveryTime: true,
        afterCutoffDeliveryTime: true,
      }
    })

    if (rule) {
      console.log('✅ 스키마 필드 정상:')
      console.log(JSON.stringify(rule, null, 2))
    } else {
      console.log('⚠️  납품 규칙이 없습니다.')
    }
  } catch (error: any) {
    console.error('❌ 에러 발생:')
    console.error(error.message)

    if (error.message.includes('beforeCutoffDeliveryTime') ||
        error.message.includes('afterCutoffDeliveryTime')) {
      console.error('\n💡 원인: DB에 새 컬럼이 없습니다.')
      console.error('해결: migration.sql을 Supabase에 적용해야 합니다.')
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkProductionSchema()
