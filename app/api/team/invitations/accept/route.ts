import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 })
    }

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 })
    }

    // 초대 조회 및 검증
    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        token,
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: '유효하지 않거나 만료된 초대입니다.' }, { status: 404 })
    }

    // 이메일 검증
    if (invitation.email !== user.email) {
      return NextResponse.json({ error: '초대받은 이메일과 다른 계정입니다.' }, { status: 400 })
    }

    // 이미 팀 멤버인지 확인
    const existingMember = await prisma.teamMember.findFirst({
      where: {
        tenantId: invitation.tenantId,
        userId: user.id,
      },
    })

    if (existingMember) {
      return NextResponse.json({ error: '이미 팀 멤버입니다.' }, { status: 400 })
    }

    // 트랜잭션으로 팀 멤버 추가 및 초대 상태 업데이트
    await prisma.$transaction(async (tx) => {
      // 팀 멤버 추가
      await tx.teamMember.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          role: invitation.role,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      })

      // 초대 상태 업데이트
      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      })

      // 팀 활동 기록
      await tx.teamActivity.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          type: 'MEMBER_JOINED',
          description: `${user.email}님이 팀에 참여했습니다 (${invitation.role})`,
          metadata: {
            invitationId: invitation.id,
            role: invitation.role,
          },
        },
      })
    })

    // 사용자 메타데이터에 테넌트 정보 추가
    await supabase.auth.updateUser({
      data: {
        tenantId: invitation.tenantId,
      },
    })

    logger.info('Team invitation accepted', {
      invitationId: invitation.id,
      tenantId: invitation.tenantId,
      userId: user.id,
      email: user.email,
      role: invitation.role,
    })

    return NextResponse.json({
      success: true,
      message: '팀 초대가 수락되었습니다.',
      data: {
        tenantId: invitation.tenantId,
        role: invitation.role,
      },
    })
  } catch (error) {
    logger.error('Failed to accept team invitation', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: '초대 수락 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}