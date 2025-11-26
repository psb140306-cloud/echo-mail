import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDuplicates() {
  // 같은 subject, sender, receivedAt(날짜)인데 다른 messageId를 가진 레코드 찾기
  const emails = await prisma.emailLog.findMany({
    select: {
      id: true,
      messageId: true,
      subject: true,
      sender: true,
      receivedAt: true,
    },
    orderBy: { receivedAt: 'desc' },
    take: 100,
  })

  // subject + sender + 날짜 기준으로 그룹화
  const groups: Record<string, Array<{ id: string; messageId: string | null; receivedAt: Date | null }>> = {}
  for (const email of emails) {
    const dateStr = email.receivedAt?.toISOString().split('T')[0] || 'unknown'
    const key = `${email.subject}|${email.sender}|${dateStr}`
    if (!groups[key]) groups[key] = []
    groups[key].push({
      id: email.id,
      messageId: email.messageId,
      receivedAt: email.receivedAt,
    })
  }

  // 2개 이상인 그룹 출력 (중복 의심)
  console.log('=== 같은 제목+발신자+날짜인데 다른 레코드 ===')
  let found = false
  for (const [key, items] of Object.entries(groups)) {
    if (items.length > 1) {
      found = true
      console.log('\n키:', key.substring(0, 60))
      for (const item of items) {
        console.log('  - messageId:', item.messageId?.substring(0, 80))
      }
    }
  }

  if (!found) {
    console.log('중복 의심 레코드 없음')
  }

  await prisma.$disconnect()
}

checkDuplicates().catch(console.error)
