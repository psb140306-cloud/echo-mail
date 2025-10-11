import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import crypto from 'crypto'

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

      // 사용자 권한 확인 (OWNER, ADMIN만 초대 목록 조회 가능)
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

      // 대기 중인 초대 목록 조회
      const invitations = await prisma.teamInvitation.findMany({
        where: {
          tenantId,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
      })

      logger.info('Team invitations retrieved', {
        tenantId,
        count: invitations.length,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        data: invitations.map(invitation => ({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          createdAt: invitation.createdAt.toISOString(),
          expiresAt: invitation.expiresAt.toISOString(),
        })),
      })
    } catch (error) {
      logger.error('Failed to retrieve team invitations', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '팀 초대 목록 조회 중 오류가 발생했습니다.' },
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

      // 사용자 권한 확인 (OWNER, ADMIN만 초대 가능)
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

      const { email, role } = await request.json()

      if (!email || !role) {
        return NextResponse.json({ error: '이메일과 역할이 필요합니다.' }, { status: 400 })
      }

      // 유효한 역할인지 확인
      const validRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: '유효하지 않은 역할입니다.' }, { status: 400 })
      }

      // 이미 팀 멤버인지 확인
      const existingMember = await prisma.teamMember.findFirst({
        where: {
          tenantId,
          user: {
            email,
          },
        },
      })

      if (existingMember) {
        return NextResponse.json({ error: '이미 팀 멤버입니다.' }, { status: 400 })
      }

      // 대기 중인 초대가 있는지 확인
      const existingInvitation = await prisma.teamInvitation.findFirst({
        where: {
          tenantId,
          email,
          status: 'PENDING',
        },
      })

      if (existingInvitation) {
        return NextResponse.json({ error: '이미 초대가 발송되었습니다.' }, { status: 400 })
      }

      // 초대 토큰 생성
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7일 후 만료

      // 초대 생성
      const invitation = await prisma.teamInvitation.create({
        data: {
          tenantId,
          email,
          role,
          token,
          expiresAt,
          invitedBy: user.id,
        },
      })

      // 초대 이메일 발송 (실제 구현에서는 이메일 서비스 사용)
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/team/accept-invitation?token=${token}`

      // 여기서 이메일 발송 로직 구현
      // await sendInvitationEmail(email, inviteUrl, role)

      logger.info('Team invitation created', {
        invitationId: invitation.id,
        email,
        role,
        tenantId,
        invitedBy: user.id,
      })

      return NextResponse.json({
        success: true,
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          createdAt: invitation.createdAt.toISOString(),
          expiresAt: invitation.expiresAt.toISOString(),
        },
        message: '팀 초대가 발송되었습니다.',
      })
    } catch (error) {
      logger.error('Failed to create team invitation', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '팀 초대 발송 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}