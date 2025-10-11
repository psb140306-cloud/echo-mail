import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      const invitationId = params.id

      if (!tenantId) {
        return NextResponse.json({ error: '테넌트 정보가 필요합니다.' }, { status: 400 })
      }

      // 사용자 권한 확인 (OWNER, ADMIN만 초대 취소 가능)
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          tenantId,
          userId: user.id,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      })

      if (!teamMember) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }

      // 초대 조회 및 권한 확인
      const invitation = await prisma.teamInvitation.findFirst({
        where: {
          id: invitationId,
          tenantId,
          status: 'PENDING',
        },
      })

      if (!invitation) {
        return NextResponse.json({ error: '초대를 찾을 수 없습니다.' }, { status: 404 })
      }

      // 초대 취소
      await prisma.teamInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: user.id,
        },
      })

      logger.info('Team invitation cancelled', {
        invitationId,
        tenantId,
        cancelledBy: user.id,
      })

      return NextResponse.json({
        success: true,
        message: '초대가 취소되었습니다.',
      })
    } catch (error) {
      logger.error('Failed to cancel team invitation', {
        invitationId: params.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '초대 취소 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}