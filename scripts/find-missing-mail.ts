const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const tenantId = 'cmi6xb2ma0000le04jprqgfxd'

  // "제인 오스틴" 또는 "250주년" 키워드로 검색
  console.log('=== "제인 오스틴" 또는 "250주년" 포함 메일 검색 ===')
  const mails1 = await prisma.emailLog.findMany({
    where: {
      tenantId,
      OR: [
        { subject: { contains: '제인' } },
        { subject: { contains: '오스틴' } },
        { subject: { contains: '250' } },
        { subject: { contains: '한정판' } }
      ]
    },
    select: {
      id: true,
      imapUid: true,
      sender: true,
      subject: true,
      receivedAt: true,
      createdAt: true
    }
  })
  console.log(`결과: ${mails1.length}건`)
  for (const m of mails1) {
    console.log(m)
  }

  // 12/15 00:00 ~ 06:00 KST 범위 메일 확인
  // KST 12/15 00:00 = UTC 12/14 15:00
  // KST 12/15 06:00 = UTC 12/14 21:00
  console.log('\n=== 12/15 00:00~06:00(KST) 메일 ===')
  const earlyMails = await prisma.emailLog.findMany({
    where: {
      tenantId,
      receivedAt: {
        gte: new Date('2025-12-14T15:00:00Z'),
        lt: new Date('2025-12-14T21:00:00Z')
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
  console.log(`총 ${earlyMails.length}건`)
  for (const m of earlyMails) {
    const kst = new Date(m.receivedAt.getTime() + 9*60*60*1000).toISOString().replace('T', ' ').slice(0,19)
    console.log(`[${kst}] UID ${m.imapUid}: ${m.subject?.substring(0,50)}`)
  }

  // 12/13, 12/14 교보문고 메일 확인
  console.log('\n=== 12/13~14 교보문고 메일 ===')
  const oldKyobo = await prisma.emailLog.findMany({
    where: {
      tenantId,
      sender: { contains: 'kyobo' },
      receivedAt: {
        gte: new Date('2025-12-12T15:00:00Z'),
        lt: new Date('2025-12-14T15:00:00Z')
      }
    },
    select: {
      id: true,
      imapUid: true,
      subject: true,
      receivedAt: true
    },
    orderBy: { receivedAt: 'asc' }
  })
  console.log(`총 ${oldKyobo.length}건`)
  for (const m of oldKyobo) {
    const kst = new Date(m.receivedAt.getTime() + 9*60*60*1000).toISOString().replace('T', ' ').slice(0,19)
    console.log(`[${kst}] UID ${m.imapUid}: ${m.subject?.substring(0,50)}`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
