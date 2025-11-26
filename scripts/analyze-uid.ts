import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function analyze() {
  // 11-26 발주합니다 메일들의 UID 패턴 분석
  const nov26 = await prisma.emailLog.findMany({
    where: {
      subject: '발주합니다',
      sender: 'seah0623@naver.com',
      receivedAt: {
        gte: new Date('2025-11-26T00:00:00Z'),
        lt: new Date('2025-11-27T00:00:00Z')
      }
    },
    select: { id: true, messageId: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  })

  console.log('=== 11/26 "발주합니다" (seah0623) 메일들 ===')
  console.log('총', nov26.length, '개')

  for (const e of nov26) {
    // UID 추출
    const uidMatch = e.messageId?.match(/uid(\d+)/)
    const uid = uidMatch ? uidMatch[1] : 'N/A'
    const hashMatch = e.messageId?.match(/-([a-f0-9]{8,})$/)
    const hash = hashMatch ? hashMatch[1].substring(0, 8) : 'N/A'

    console.log(`UID: ${uid.padStart(6)} | hash: ${hash} | created: ${e.createdAt.toISOString().substring(11, 19)} | msgId: ${e.messageId?.substring(0, 70)}`)
  }

  // UID별로 그룹화
  const uidGroups: Record<string, number> = {}
  for (const e of nov26) {
    const uidMatch = e.messageId?.match(/uid(\d+)/)
    const uid = uidMatch ? uidMatch[1] : 'no-uid'
    uidGroups[uid] = (uidGroups[uid] || 0) + 1
  }

  console.log('\n=== UID별 레코드 수 ===')
  for (const [uid, count] of Object.entries(uidGroups)) {
    console.log(`UID ${uid}: ${count}개`)
  }

  await prisma.$disconnect()
}

analyze().catch(console.error)
