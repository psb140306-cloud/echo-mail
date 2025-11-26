import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteData() {
  const email = 'cd-op@hanmail.net'

  // 1. 해당 이메일의 테넌트 찾기
  const tenant = await prisma.tenant.findFirst({
    where: { ownerEmail: email },
    select: { id: true, name: true, ownerEmail: true }
  })

  if (!tenant) {
    console.log('테넌트를 찾을 수 없습니다:', email)
    await prisma.$disconnect()
    return
  }

  console.log('=== 삭제 대상 테넌트 ===')
  console.log('ID:', tenant.id)
  console.log('이름:', tenant.name)
  console.log('이메일:', tenant.ownerEmail)

  // 2. 삭제 전 현재 데이터 개수 확인
  const emailLogCount = await prisma.emailLog.count({
    where: { tenantId: tenant.id }
  })
  const notificationLogCount = await prisma.notificationLog.count({
    where: { tenantId: tenant.id }
  })

  console.log('\n=== 삭제할 데이터 ===')
  console.log('EmailLog:', emailLogCount, '개')
  console.log('NotificationLog:', notificationLogCount, '개')

  // 3. NotificationLog 먼저 삭제 (EmailLog 참조)
  const deletedNotifications = await prisma.notificationLog.deleteMany({
    where: { tenantId: tenant.id }
  })
  console.log('\n삭제된 NotificationLog:', deletedNotifications.count, '개')

  // 4. EmailLog 삭제
  const deletedEmails = await prisma.emailLog.deleteMany({
    where: { tenantId: tenant.id }
  })
  console.log('삭제된 EmailLog:', deletedEmails.count, '개')

  console.log('\n=== 삭제 완료 ===')

  await prisma.$disconnect()
}

deleteData().catch(console.error)
