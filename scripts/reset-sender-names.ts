/**
 * EmailLog의 senderName 필드 초기화 스크립트
 *
 * 버그로 인해 잘못된 발신자 이름이 저장된 데이터를 초기화합니다.
 * 초기화 후 refresh-sender-names API를 호출하거나 메일을 다시 수집하면 올바른 값이 채워집니다.
 *
 * 실행: npx ts-node scripts/reset-sender-names.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetSenderNames() {
  console.log('=== senderName 필드 초기화 시작 ===\n')

  try {
    // 현재 상태 확인
    const beforeCount = await prisma.emailLog.count({
      where: { senderName: { not: null } }
    })
    const totalCount = await prisma.emailLog.count()

    console.log(`총 메일 수: ${totalCount}`)
    console.log(`senderName이 있는 메일 수: ${beforeCount}`)
    console.log('')

    // senderName 초기화
    console.log('senderName 필드를 null로 초기화 중...')

    const result = await prisma.emailLog.updateMany({
      where: { senderName: { not: null } },
      data: { senderName: null }
    })

    console.log(`\n✅ ${result.count}개 메일의 senderName이 초기화되었습니다.`)
    console.log('')
    console.log('다음 단계:')
    console.log('1. refresh-sender-names API를 호출하여 발신자 이름을 다시 가져오거나')
    console.log('2. 메일 스케줄러가 다음 수집 시 자동으로 채웁니다.')
    console.log('')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

resetSenderNames()
