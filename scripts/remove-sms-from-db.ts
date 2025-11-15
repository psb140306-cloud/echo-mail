import { PrismaClient } from '@prisma/client'

async function removeSMSFromDB() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  try {
    console.log('=== SMS 설정을 SystemConfig에서 제거 ===\n')

    // 모든 테넌트의 SMS 설정 삭제
    const result = await prisma.systemConfig.deleteMany({
      where: {
        key: {
          startsWith: 'sms.'
        }
      }
    })

    console.log(`✅ ${result.count}개의 SMS 설정을 삭제했습니다.`)
    console.log('\n이제 SMS는 환경변수만 사용합니다:')
    console.log(`  SMS_PROVIDER: ${process.env.SMS_PROVIDER}`)
    console.log(`  SOLAPI_API_KEY: ${process.env.SOLAPI_API_KEY ? '설정됨' : '없음'}`)
    console.log(`  SOLAPI_API_SECRET: ${process.env.SOLAPI_API_SECRET ? '설정됨' : '없음'}`)
    console.log(`  SOLAPI_SENDER_PHONE: ${process.env.SOLAPI_SENDER_PHONE || '없음'}`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

removeSMSFromDB()
