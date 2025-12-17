import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

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

      const invitationId = params.id

      // DB에서 실제 멤버십 및 권한 검증 (메타데이터 신뢰하지 않음)
      const tenantMember = await prisma.tenantMember.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          role: { in: ['OWNER', 'ADMIN'] },
        },
      })

      if (!tenantMember) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }

      const tenantId = tenantMember.tenantId

      // 초대 조회 및 권한 확인
      const invitation = await prisma.tenantInvitation.findFirst({
        where: {
          id: invitationId,
          tenantId,
          status: 'PENDING',
        },
      })

      if (!invitation) {
        return NextResponse.json({ error: '초대를 찾을 수 없습니다.' }, { status: 404 })
      }

      // 초대 삭제 (또는 상태 변경)
      await prisma.tenantInvitation.delete({
        where: { id: invitationId },
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
