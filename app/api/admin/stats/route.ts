import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth/super-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 슈퍼어드민 권한 확인
    const authError = await requireSuperAdmin()
    if (authError) return authError

    // 통계 데이터 조회
    const [tenantCount, notificationCount, companyCount] = await Promise.all([
      // 총 테넌트 수
      prisma.tenant.count(),

      // 30일 내 알림 발송 수 (NotificationLog 모델 사용)
      prisma.notificationLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // 등록된 업체 수 (모든 테넌트 합계)
      prisma.company.count(),
    ])

    // 총 사용자 수 - Prisma groupBy로 고유 userId 개수 구하기
    const users = await prisma.tenantMember.groupBy({
      by: ['userId'],
    })
    const userCount = users.length

    return NextResponse.json({
      tenantCount,
      userCount,
      notificationCount,
      companyCount,
    })
  } catch (error) {
    console.error('[Stats API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
