import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 })
    }

    // 초대 조회 및 검증
    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        token,
        status: 'PENDING',
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: '유효하지 않은 초대입니다.' }, { status: 404 })
    }

    // 초대 거절 처리
    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
      },
    })

    logger.info('Team invitation declined', {
      invitationId: invitation.id,
      tenantId: invitation.tenantId,
      email: invitation.email,
    })

    return NextResponse.json({
      success: true,
      message: '초대가 거절되었습니다.',
    })
  } catch (error) {
    logger.error('Failed to decline team invitation', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: '초대 거절 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}