import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 })
      }

      // DB에서 실제 멤버십 검증 (메타데이터 신뢰하지 않음)
      const currentMember = await prisma.tenantMember.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
        },
      })

      if (!currentMember) {
        return NextResponse.json({ error: '팀에 소속되어 있지 않습니다.' }, { status: 403 })
      }

      const tenantId = currentMember.tenantId

      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
      const skip = (page - 1) * limit

      // 활동 로그 조회
      const [activities, totalCount] = await Promise.all([
        prisma.activityLog.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.activityLog.count({ where: { tenantId } }),
      ])

      logger.info('Activity logs retrieved', {
        tenantId,
        count: activities.length,
        totalCount,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        data: activities.map(activity => ({
          id: activity.id,
          userId: activity.userId,
          userName: activity.userName || activity.userEmail,
          action: activity.action,
          description: activity.description,
          metadata: activity.metadata,
          createdAt: activity.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      })
    } catch (error) {
      logger.error('Failed to retrieve activity logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '활동 로그 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}
