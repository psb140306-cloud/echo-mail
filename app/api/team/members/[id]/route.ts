import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { logActivity } from '@/lib/activity/log-activity'

export async function PUT(
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

      const memberId = params.id

      // DB에서 실제 멤버십 및 권한 검증 (메타데이터 신뢰하지 않음)
      const currentMember = await prisma.tenantMember.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          role: { in: ['OWNER', 'ADMIN'] },
        },
      })

      if (!currentMember) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }

      const tenantId = currentMember.tenantId

      // 수정할 멤버 조회
      const targetMember = await prisma.tenantMember.findFirst({
        where: {
          id: memberId,
          tenantId,
        },
      })

      if (!targetMember) {
        return NextResponse.json({ error: '멤버를 찾을 수 없습니다.' }, { status: 404 })
      }

      const { role, status } = await request.json()

      // OWNER는 수정할 수 없음
      if (targetMember.role === 'OWNER') {
        return NextResponse.json({ error: '소유자의 권한은 변경할 수 없습니다.' }, { status: 400 })
      }

      // ADMIN은 OWNER만 수정 가능
      if (targetMember.role === 'ADMIN' && currentMember.role !== 'OWNER') {
        return NextResponse.json({ error: '관리자 권한은 소유자만 변경할 수 있습니다.' }, { status: 403 })
      }

      const updateData: { role?: 'ADMIN' | 'MEMBER'; status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' } = {}

      if (role) {
        const validRoles = ['ADMIN', 'MEMBER']
        if (!validRoles.includes(role)) {
          return NextResponse.json({ error: '유효하지 않은 역할입니다. (ADMIN, MEMBER만 가능)' }, { status: 400 })
        }
        updateData.role = role
      }

      if (status) {
        if (!['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status)) {
          return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 })
        }
        updateData.status = status
      }

      // 멤버 정보 업데이트
      const updatedMember = await prisma.tenantMember.update({
        where: {
          id: memberId,
          tenantId,
        },
        data: updateData,
      })

      // 역할 변경 시 활동 로그 기록
      if (updateData.role) {
        const oldRoleLabel = targetMember.role === 'ADMIN' ? '관리자' : '멤버'
        const newRoleLabel = updateData.role === 'ADMIN' ? '관리자' : '멤버'
        await logActivity({
          tenantId,
          userId: user.id,
          userEmail: user.email!,
          userName: user.user_metadata?.full_name,
          action: 'ROLE_CHANGED',
          description: `${updatedMember.userName || updatedMember.userEmail}의 역할을 ${oldRoleLabel}에서 ${newRoleLabel}로 변경했습니다`,
          metadata: {
            targetMemberId: memberId,
            targetEmail: updatedMember.userEmail,
            oldRole: targetMember.role,
            newRole: updateData.role,
          },
        })
      }

      logger.info('Team member updated', {
        memberId,
        tenantId,
        updatedBy: user.id,
        changes: updateData,
      })

      return NextResponse.json({
        success: true,
        data: {
          id: updatedMember.id,
          userId: updatedMember.userId,
          email: updatedMember.userEmail,
          name: updatedMember.userName || updatedMember.userEmail,
          role: updatedMember.role,
          status: updatedMember.status,
          joinedAt: updatedMember.acceptedAt?.toISOString() || updatedMember.invitedAt.toISOString(),
        },
        message: '멤버 정보가 업데이트되었습니다.',
      })
    } catch (error) {
      logger.error('Failed to update team member', {
        memberId: params.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '멤버 정보 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}

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

      const memberId = params.id

      // DB에서 실제 멤버십 및 권한 검증 (메타데이터 신뢰하지 않음)
      const currentMember = await prisma.tenantMember.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          role: { in: ['OWNER', 'ADMIN'] },
        },
      })

      if (!currentMember) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }

      const tenantId = currentMember.tenantId

      // 제거할 멤버 조회
      const targetMember = await prisma.tenantMember.findFirst({
        where: {
          id: memberId,
          tenantId,
        },
      })

      if (!targetMember) {
        return NextResponse.json({ error: '멤버를 찾을 수 없습니다.' }, { status: 404 })
      }

      // OWNER는 제거할 수 없음
      if (targetMember.role === 'OWNER') {
        return NextResponse.json({ error: '소유자는 제거할 수 없습니다.' }, { status: 400 })
      }

      // ADMIN은 OWNER만 제거 가능
      if (targetMember.role === 'ADMIN' && currentMember.role !== 'OWNER') {
        return NextResponse.json({ error: '관리자는 소유자만 제거할 수 있습니다.' }, { status: 403 })
      }

      // 멤버 제거
      await prisma.tenantMember.delete({
        where: {
          id: memberId,
          tenantId,
        },
      })

      // 활동 로그 기록
      await logActivity({
        tenantId,
        userId: user.id,
        userEmail: user.email!,
        userName: user.user_metadata?.full_name,
        action: 'MEMBER_REMOVED',
        description: `${targetMember.userName || targetMember.userEmail}을(를) 팀에서 제거했습니다`,
        metadata: {
          removedMemberId: memberId,
          removedEmail: targetMember.userEmail,
          removedRole: targetMember.role,
        },
      })

      logger.info('Team member removed', {
        memberId,
        tenantId,
        removedBy: user.id,
        targetUserId: targetMember.userId,
      })

      return NextResponse.json({
        success: true,
        message: '팀 멤버가 제거되었습니다.',
      })
    } catch (error) {
      logger.error('Failed to remove team member', {
        memberId: params.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '팀 멤버 제거 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}
