const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const tenantId = 'cmi6xb2ma0000le04jprqgfxd'

  // UID 180841 메일 조회
  const mail180841 = await prisma.emailLog.findFirst({
    where: {
      tenantId,
      imapUid: 180841
    }
  })
  console.log('=== UID 180841 (12/15 03:32 교보문고) ===')
  console.log(mail180841 ? `존재함: ${mail180841.id}` : '없음')

  // UID 180851 메일 조회
  const mail180851 = await prisma.emailLog.findFirst({
    where: {
      tenantId,
      imapUid: 180851
    }
  })
  console.log('\n=== UID 180851 (12/15 18:30 교보문고) ===')
  console.log(mail180851 ? `존재함: ${mail180851.id}` : '없음')

  // 12월 15일 메일 전체 조회
  console.log('\n=== 12월 15일 00:00 ~ 12월 16일 00:00(KST) 메일 ===')
  // KST 12/15 00:00 = UTC 12/14 15:00
  // KST 12/16 00:00 = UTC 12/15 15:00
  const dec15Mails = await prisma.emailLog.findMany({
    where: {
      tenantId,
      receivedAt: {
        gte: new Date('2025-12-14T15:00:00Z'),
        lt: new Date('2025-12-15T15:00:00Z')
      }
    },
    select: {
      id: true,
      imapUid: true,
      sender: true,
      subject: true,
      receivedAt: true
    },
    orderBy: { receivedAt: 'asc' }
  })

  console.log(`총 ${dec15Mails.length}건`)
  for (const m of dec15Mails) {
    const kst = new Date(m.receivedAt.getTime() + 9*60*60*1000).toISOString().replace('T', ' ').slice(0,19)
    console.log(`UID ${m.imapUid}: [${kst}] ${m.sender.substring(0,25)} - ${m.subject?.substring(0,30)}`)
  }

  // 테넌트의 최근 메일 몇 개 조회
  console.log('\n=== 최근 저장된 메일 10개 ===')
  const recentMails = await prisma.emailLog.findMany({
    where: { tenantId },
    select: {
      id: true,
      imapUid: true,
      sender: true,
      subject: true,
      receivedAt: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  for (const m of recentMails) {
    const recvKst = new Date(m.receivedAt.getTime() + 9*60*60*1000).toISOString().replace('T', ' ').slice(0,19)
    console.log(`UID ${m.imapUid}: [수신 ${recvKst}] ${m.sender.substring(0,20)}`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
