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

      // 팀 멤버 목록 조회
      const teamMembers = await prisma.teamMember.findMany({
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
        orderBy: [
          { role: 'asc' },
          { joinedAt: 'asc' },
        ],
      })

      logger.info('Team members retrieved', {
        tenantId,
        count: teamMembers.length,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        data: teamMembers.map(member => ({
          id: member.id,
          userId: member.userId,
          email: member.user.email,
          name: member.user.user_metadata?.full_name || member.user.email,
          role: member.role,
          status: member.status,
          joinedAt: member.joinedAt.toISOString(),
          lastActiveAt: member.lastActiveAt?.toISOString(),
        })),
      })
    } catch (error) {
      logger.error('Failed to retrieve team members', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '팀 멤버 목록 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}