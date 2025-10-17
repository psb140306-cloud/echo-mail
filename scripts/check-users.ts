import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUsers() {
  try {
    console.log('🔍 데이터베이스 연결 중...\n')

    // User 테이블 조회
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    })

    console.log(`📊 총 사용자 수: ${users.length}명\n`)

    if (users.length === 0) {
      console.log('❌ 등록된 사용자가 없습니다.\n')
    } else {
      console.log('👥 사용자 목록:\n')
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`)
        console.log(`   이름: ${user.name || '(미설정)'}`)
        console.log(`   역할: ${user.role}`)
        console.log(`   이메일 인증: ${user.emailVerified ? '✅ 완료' : '❌ 미완료'}`)
        console.log(`   가입일: ${user.createdAt.toLocaleString('ko-KR')}`)
        console.log('')
      })
    }

    // Tenant 테이블 조회
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    })

    console.log(`\n🏢 총 테넌트 수: ${tenants.length}개\n`)

    if (tenants.length > 0) {
      console.log('🏢 테넌트 목록:\n')
      tenants.forEach((tenant, index) => {
        console.log(`${index + 1}. ${tenant.name}`)
        console.log(`   구독 상태: ${tenant.subscriptionStatus}`)
        console.log(`   플랜: ${tenant.subscriptionPlan}`)
        console.log(`   생성일: ${tenant.createdAt.toLocaleString('ko-KR')}`)
        console.log('')
      })
    }
  } catch (error) {
    console.error('❌ 에러 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()
