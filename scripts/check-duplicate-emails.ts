import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDuplicates() {
  const emails = await prisma.emailLog.findMany({
    where: {
      subject: '발주합니다',
      sender: 'seah0623@naver.com',
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  })

  console.log('=== 중복 메일 분석 ===')
  console.log(`총 ${emails.length}개 발견\n`)

  emails.forEach((email, index) => {
    console.log(`[${index + 1}] ID: ${email.id}`)
    console.log(`    Message-ID: ${email.messageId}`)
    console.log(`    수신시간: ${email.receivedAt}`)
    console.log(`    생성시간: ${email.createdAt}`)
    console.log(`    상태: ${email.status}`)
    console.log('')
  })

  // Message-ID별 그룹핑
  const grouped = emails.reduce((acc, email) => {
    if (!acc[email.messageId]) {
      acc[email.messageId] = []
    }
    acc[email.messageId].push(email)
    return acc
  }, {} as Record<string, typeof emails>)

  console.log('=== Message-ID별 그룹 ===')
  Object.entries(grouped).forEach(([messageId, group]) => {
    console.log(`Message-ID: ${messageId}`)
    console.log(`  - 중복 개수: ${group.length}개`)
    if (group.length > 1) {
      console.log('  ⚠️ 중복 발생!')
    }
    console.log('')
  })
}

checkDuplicates()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
