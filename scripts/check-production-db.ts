import { PrismaClient } from '@prisma/client'

async function checkProductionDB() {
  // Production DB URL 사용
  const productionDbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL

  console.log('=== Production Database 연결 ===')
  console.log('DB URL:', productionDbUrl ? 'exists' : 'missing')
  console.log('')

  const prisma = new PrismaClient({
    datasourceUrl: productionDbUrl,
  })

  try {
    // 1. 모든 테넌트 조회
    const tenants = await prisma.tenant.findMany()
    console.log(`총 ${tenants.length}개 테넌트 발견:\n`)

    for (const tenant of tenants) {
      console.log(`📌 Tenant: ${tenant.name}`)
      console.log(`   ID: ${tenant.id}`)
      console.log(`   Subdomain: ${tenant.subdomain}`)
      console.log(`   Owner: ${tenant.ownerEmail}`)
      console.log('')

      // 2. SMS 설정 조회
      const smsConfigs = await prisma.systemConfig.findMany({
        where: {
          tenantId: tenant.id,
          key: {
            startsWith: 'sms.'
          }
        },
        orderBy: {
          key: 'asc'
        }
      })

      if (smsConfigs.length > 0) {
        console.log('   ✅ SMS 설정 (DB에 저장됨):')
        smsConfigs.forEach(config => {
          let value = config.value
          try {
            value = JSON.parse(value)
          } catch {}

          // API Key/Secret은 일부만 표시
          if (config.key === 'sms.apiKey' || config.key === 'sms.apiSecret') {
            if (typeof value === 'string' && value.length > 8) {
              value = value.substring(0, 8) + '...'
            }
          }

          console.log(`      ${config.key}: ${value}`)
        })
      } else {
        console.log('   ❌ SMS 설정 없음 (환경변수 사용)')
      }
      console.log('')
    }

    // 3. 환경변수 확인 (참고용)
    console.log('\n=== 환경변수 (로컬) ===')
    console.log(`SMS_PROVIDER: ${process.env.SMS_PROVIDER}`)
    console.log(`SOLAPI_API_KEY: ${process.env.SOLAPI_API_KEY ? process.env.SOLAPI_API_KEY.substring(0, 8) + '...' : 'not set'}`)
    console.log(`SOLAPI_API_SECRET: ${process.env.SOLAPI_API_SECRET ? '설정됨' : 'not set'}`)
    console.log(`SOLAPI_SENDER_PHONE: ${process.env.SOLAPI_SENDER_PHONE || 'not set'}`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkProductionDB()
