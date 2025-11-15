import { PrismaClient } from '@prisma/client'

async function checkSupabaseSMS() {
  // Supabase DB URL 직접 사용
  const supabaseUrl = process.env.DATABASE_URL

  console.log('=== Supabase Production DB 연결 ===')
  console.log('DB URL:', supabaseUrl ? supabaseUrl.substring(0, 50) + '...' : 'missing')
  console.log('')

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: supabaseUrl,
      },
    },
    log: ['error', 'warn'],
  })

  try {
    // 연결 테스트
    await prisma.$connect()
    console.log('✅ DB 연결 성공\n')

    // 1. 모든 테넌트 조회
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        ownerEmail: true,
      }
    })

    console.log(`📊 총 ${tenants.length}개 테넌트 발견\n`)

    for (const tenant of tenants) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`📌 Tenant: ${tenant.name}`)
      console.log(`   ID: ${tenant.id}`)
      console.log(`   Subdomain: ${tenant.subdomain}`)
      console.log(`   Owner: ${tenant.ownerEmail}`)
      console.log('')

      // 2. SystemConfig 테이블에서 SMS 설정 조회
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
        console.log(`   ✅ SMS 설정 발견 (${smsConfigs.length}개):`)
        smsConfigs.forEach(config => {
          let value = config.value
          try {
            value = JSON.parse(value)
          } catch {}

          // API Key/Secret은 일부만 표시
          if (config.key === 'sms.apiKey' && typeof value === 'string' && value.length > 8) {
            value = value.substring(0, 8) + '...'
          }
          if (config.key === 'sms.apiSecret' && typeof value === 'string' && value.length > 8) {
            value = value.substring(0, 8) + '...'
          }

          console.log(`      ${config.key}: ${value}`)
        })
      } else {
        console.log('   ❌ SMS 설정 없음')
      }
      console.log('')
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // 3. 전체 SystemConfig 통계
    const totalConfigs = await prisma.systemConfig.count()
    const smsConfigsTotal = await prisma.systemConfig.count({
      where: {
        key: {
          startsWith: 'sms.'
        }
      }
    })

    console.log('📈 SystemConfig 통계:')
    console.log(`   전체 설정: ${totalConfigs}개`)
    console.log(`   SMS 설정: ${smsConfigsTotal}개`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSupabaseSMS()
