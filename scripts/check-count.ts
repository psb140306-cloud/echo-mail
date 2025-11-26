import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const tenant = await prisma.tenant.findFirst({
    where: { ownerEmail: 'cd-op@hanmail.net' }
  })

  if (!tenant) {
    console.log('테넌트 없음')
    return
  }

  const emailCount = await prisma.emailLog.count({ where: { tenantId: tenant.id } })
  const notifCount = await prisma.notificationLog.count({ where: { tenantId: tenant.id } })

  console.log('=== cd-op@hanmail.net 데이터 현황 ===')
  console.log('EmailLog:', emailCount, '개')
  console.log('NotificationLog:', notifCount, '개')

  await prisma.$disconnect()
}

check().catch(console.error)
