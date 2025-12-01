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

      // 팀 멤버 목록 조회
      const tenantMembers = await prisma.tenantMember.findMany({
        where: { tenantId },
        orderBy: [
          { role: 'asc' },
          { invitedAt: 'asc' },
        ],
      })

      logger.info('Team members retrieved', {
        tenantId,
        count: tenantMembers.length,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        data: tenantMembers.map(member => ({
          id: member.id,
          userId: member.userId,
          email: member.userEmail,
          name: member.userName || member.userEmail,
          role: member.role,
          status: member.status,
          joinedAt: member.acceptedAt?.toISOString() || member.invitedAt.toISOString(),
          invitedAt: member.invitedAt.toISOString(),
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
