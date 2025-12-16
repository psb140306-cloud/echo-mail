import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  // 테넌트별 메일 수 확인
  const counts = await prisma.emailLog.groupBy({
    by: ['tenantId'],
    _count: true,
    orderBy: { _count: { tenantId: 'desc' } }
  })
  console.log('테넌트별 메일 수:', counts)

  // cmi6xb2ma0000le04jprqgfxd 테넌트의 최근 메일 확인
  const recentMails = await prisma.emailLog.findMany({
    where: { tenantId: 'cmi6xb2ma0000le04jprqgfxd' },
    orderBy: { receivedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      subject: true,
      sender: true,
      receivedAt: true,
      imapUid: true,
    }
  })
  console.log('\n최근 메일 10개:')
  recentMails.forEach(m => {
    const uid = m.imapUid || 'N/A'
    const date = m.receivedAt?.toISOString() || 'N/A'
    const sender = m.sender || 'N/A'
    const subject = m.subject?.substring(0, 40) || 'N/A'
    console.log(`- UID:${uid} | ${date} | ${sender} | ${subject}`)
  })

  // 전체 메일 수
  const total = await prisma.emailLog.count({
    where: { tenantId: 'cmi6xb2ma0000le04jprqgfxd' }
  })
  console.log('\n총 메일 수:', total)

  await prisma.$disconnect()
}

check()
