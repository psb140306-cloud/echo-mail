import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

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

      const tenantId = user.user_metadata?.tenantId

      if (!tenantId) {
        return NextResponse.json({ error: '테넌트 정보가 필요합니다.' }, { status: 400 })
      }

      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
      const skip = (page - 1) * limit

      // 팀 활동 기록 조회
      const [activities, totalCount] = await Promise.all([
        prisma.teamActivity.findMany({
          where: { tenantId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                user_metadata: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.teamActivity.count({ where: { tenantId } }),
      ])

      logger.info('Team activities retrieved', {
        tenantId,
        count: activities.length,
        totalCount,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        data: activities.map(activity => ({
          id: activity.id,
          type: activity.type,
          description: activity.description,
          metadata: activity.metadata,
          user: {
            id: activity.user.id,
            email: activity.user.email,
            name: activity.user.user_metadata?.full_name || activity.user.email,
          },
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
      logger.error('Failed to retrieve team activities', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '팀 활동 기록 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}

export async function POST(request: NextRequest) {
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

      const tenantId = user.user_metadata?.tenantId

      if (!tenantId) {
        return NextResponse.json({ error: '테넌트 정보가 필요합니다.' }, { status: 400 })
      }

      const { type, description, metadata } = await request.json()

      if (!type || !description) {
        return NextResponse.json({ error: '활동 유형과 설명이 필요합니다.' }, { status: 400 })
      }

      // 팀 활동 기록 생성
      const activity = await prisma.teamActivity.create({
        data: {
          tenantId,
          userId: user.id,
          type,
          description,
          metadata: metadata || {},
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              user_metadata: true,
            },
          },
        },
      })

      logger.info('Team activity logged', {
        activityId: activity.id,
        type,
        tenantId,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        data: {
          id: activity.id,
          type: activity.type,
          description: activity.description,
          metadata: activity.metadata,
          user: {
            id: activity.user.id,
            email: activity.user.email,
            name: activity.user.user_metadata?.full_name || activity.user.email,
          },
          createdAt: activity.createdAt.toISOString(),
        },
        message: '팀 활동이 기록되었습니다.',
      })
    } catch (error) {
      logger.error('Failed to log team activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '팀 활동 기록 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}