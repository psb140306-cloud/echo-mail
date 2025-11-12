const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const tenantId = 'cmhn51bs10000upmjuafsfl2n'

  console.log('Checking subscriptions for tenant:', tenantId)

  const subscriptions = await prisma.subscription.findMany({
    where: { tenantId }
  })

  console.log('\nSubscriptions found:', subscriptions.length)
  console.log(JSON.stringify(subscriptions, null, 2))

  if (subscriptions.length === 0) {
    console.log('\n⚠️  No subscriptions found - creating FREE_TRIAL subscription...')

    const now = new Date()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

    const newSubscription = await prisma.subscription.create({
      data: {
        tenantId,
        plan: 'FREE_TRIAL',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        priceAmount: 0, // FREE_TRIAL is free
        cancelAtPeriodEnd: false,
      }
    })

    console.log('\n✅ Created subscription:')
    console.log(JSON.stringify(newSubscription, null, 2))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
