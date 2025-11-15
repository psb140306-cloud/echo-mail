import { prisma } from '../lib/db'

async function clearSMSSettings() {
  try {
    console.log('=== Clearing SMS Settings from Database ===\n')

    // Get first tenant (samdial)
    const tenant = await prisma.tenant.findFirst()

    if (!tenant) {
      console.log('No tenant found')
      return
    }

    console.log(`Tenant: ${tenant.name} (ID: ${tenant.id})\n`)

    // Delete all SMS settings for this tenant
    const result = await prisma.systemConfig.deleteMany({
      where: {
        tenantId: tenant.id,
        key: {
          startsWith: 'sms.'
        }
      }
    })

    console.log(`Deleted ${result.count} SMS configuration(s)`)
    console.log('\nNow the system will use environment variables:')
    console.log(`  SMS_PROVIDER: ${process.env.SMS_PROVIDER}`)
    console.log(`  SOLAPI_API_KEY: ${process.env.SOLAPI_API_KEY ? process.env.SOLAPI_API_KEY.substring(0, 8) + '...' : 'not set'}`)
    console.log(`  SOLAPI_SENDER_PHONE: ${process.env.SOLAPI_SENDER_PHONE}`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearSMSSettings()
