import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

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

      const tenantId = user.user_metadata?.tenantId
      const memberId = params.id

      if (!tenantId) {
        return NextResponse.json({ error: '테넌트 정보가 필요합니다.' }, { status: 400 })
      }

      // 사용자 권한 확인 (OWNER, ADMIN만 멤버 수정 가능)
      const currentMember = await prisma.teamMember.findFirst({
        where: {
          tenantId,
          userId: user.id,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      })

      if (!currentMember) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }

      // 수정할 멤버 조회
      const targetMember = await prisma.teamMember.findFirst({
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

      // 자신을 OWNER로 변경하려는 경우 방지
      if (role === 'OWNER' && targetMember.userId !== user.id) {
        return NextResponse.json({ error: '소유자 권한은 양도할 수 없습니다.' }, { status: 400 })
      }

      const updateData: any = {}

      if (role) {
        const validRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']
        if (!validRoles.includes(role)) {
          return NextResponse.json({ error: '유효하지 않은 역할입니다.' }, { status: 400 })
        }
        updateData.role = role
      }

      if (status) {
        if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
          return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 })
        }
        updateData.status = status
      }

      // 멤버 정보 업데이트
      const updatedMember = await prisma.teamMember.update({
        where: { id: memberId },
        data: updateData,
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
          email: updatedMember.user.email,
          name: updatedMember.user.user_metadata?.full_name || updatedMember.user.email,
          role: updatedMember.role,
          status: updatedMember.status,
          joinedAt: updatedMember.joinedAt.toISOString(),
          lastActiveAt: updatedMember.lastActiveAt?.toISOString(),
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

      const tenantId = user.user_metadata?.tenantId
      const memberId = params.id

      if (!tenantId) {
        return NextResponse.json({ error: '테넌트 정보가 필요합니다.' }, { status: 400 })
      }

      // 사용자 권한 확인 (OWNER, ADMIN만 멤버 제거 가능)
      const currentMember = await prisma.teamMember.findFirst({
        where: {
          tenantId,
          userId: user.id,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      })

      if (!currentMember) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }

      // 제거할 멤버 조회
      const targetMember = await prisma.teamMember.findFirst({
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
      await prisma.teamMember.delete({
        where: { id: memberId },
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