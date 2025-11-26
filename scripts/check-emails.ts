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

  const emails = await prisma.emailLog.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      messageId: true,
      subject: true,
      sender: true,
      receivedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  console.log('=== 최근 이메일 ===')
  for (const e of emails) {
    console.log('---')
    console.log('subject:', e.subject)
    console.log('sender:', e.sender)
    console.log('messageId:', e.messageId)
    console.log('receivedAt:', e.receivedAt?.toISOString())
    console.log('createdAt:', e.createdAt.toISOString())
  }

  await prisma.$disconnect()
}

check().catch(console.error)
