import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 })
    }

    // 초대 조회
    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        token,
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        tenant: {
          select: {
            name: true,
          },
        },
        inviter: {
          select: {
            email: true,
            user_metadata: true,
          },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: '유효하지 않거나 만료된 초대입니다.' }, { status: 404 })
    }

    logger.info('Invitation validated', {
      invitationId: invitation.id,
      email: invitation.email,
      tenantId: invitation.tenantId,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        tenantName: invitation.tenant.name,
        inviterName: invitation.inviter.user_metadata?.full_name || invitation.inviter.email,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    })
  } catch (error) {
    logger.error('Failed to validate invitation', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: '초대 검증 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}