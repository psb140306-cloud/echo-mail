import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUsers() {
  try {
    console.log('🔍 데이터베이스 연결 중...\n')

    // TenantMember 조회 (Supabase Auth 사용)
    const members = await prisma.tenantMember.findMany({
      select: {
        id: true,
        userId: true,
        userEmail: true,
        userName: true,
        role: true,
        status: true,
        tenant: {
          select: {
            name: true,
          },
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    })

    console.log(`📊 총 멤버 수: ${members.length}명\n`)

    if (members.length === 0) {
      console.log('❌ 등록된 멤버가 없습니다.\n')
    } else {
      console.log('👥 멤버 목록:\n')
      members.forEach((member, index) => {
        console.log(`${index + 1}. ${member.userEmail}`)
        console.log(`   이름: ${member.userName || '(미설정)'}`)
        console.log(`   역할: ${member.role}`)
        console.log(`   상태: ${member.status}`)
        console.log(`   테넌트: ${member.tenant.name}`)
        console.log(`   가입일: ${member.createdAt.toLocaleString('ko-KR')}`)
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
