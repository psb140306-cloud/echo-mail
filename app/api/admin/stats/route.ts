import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 사용자 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 관리자 권한 확인
    const isDefaultAdmin = user.email === 'seah0623@naver.com'
    if (!isDefaultAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

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
