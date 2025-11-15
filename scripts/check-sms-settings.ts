import { prisma } from '../lib/db'

async function checkSMSSettings() {
  try {
    console.log('=== Checking SMS Settings in Database ===\n')

    // Get all tenants
    const tenants = await prisma.tenant.findMany()
    console.log(`Found ${tenants.length} tenant(s):\n`)

    for (const tenant of tenants) {
      console.log(`Tenant: ${tenant.name} (ID: ${tenant.id})`)

      // Get SMS settings for this tenant
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
        console.log('  SMS Settings:')
        smsConfigs.forEach(config => {
          let value = config.value
          try {
            value = JSON.parse(value)
          } catch {}
          console.log(`    ${config.key}: ${value}`)
        })
      } else {
        console.log('  No SMS settings in database')
      }
      console.log('')
    }

    console.log('\n=== Environment Variables ===')
    console.log(`SMS_PROVIDER: ${process.env.SMS_PROVIDER}`)
    console.log(`ALIGO_API_KEY: ${process.env.ALIGO_API_KEY}`)
    console.log(`SOLAPI_API_KEY: ${process.env.SOLAPI_API_KEY ? process.env.SOLAPI_API_KEY.substring(0, 8) + '...' : 'not set'}`)
    console.log(`SOLAPI_SENDER_PHONE: ${process.env.SOLAPI_SENDER_PHONE}`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSMSSettings()
