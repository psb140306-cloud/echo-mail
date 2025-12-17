import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { sendTeamInvitationEmail } from '@/lib/email/team-invitation-email'
import { logActivity } from '@/lib/activity/log-activity'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

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

      // 대기 중인 초대 목록 조회 (만료되지 않은 것만)
      const invitations = await prisma.tenantInvitation.findMany({
        where: {
          tenantId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
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
          status: invitation.status,
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

      const { email, role } = await request.json()

      if (!email || !role) {
        return NextResponse.json({ error: '이메일과 역할이 필요합니다.' }, { status: 400 })
      }

      // 유효한 역할인지 확인 (OWNER는 초대 불가)
      const validRoles = ['ADMIN', 'MEMBER']
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: '유효하지 않은 역할입니다. (ADMIN, MEMBER만 가능)' }, { status: 400 })
      }

      // 이미 팀 멤버인지 확인
      const existingMember = await prisma.tenantMember.findFirst({
        where: {
          tenantId,
          userEmail: email,
        },
      })

      if (existingMember) {
        return NextResponse.json({ error: '이미 팀 멤버입니다.' }, { status: 400 })
      }

      // 대기 중인 초대가 있는지 확인 (만료되지 않은 것만)
      const existingInvitation = await prisma.tenantInvitation.findFirst({
        where: {
          tenantId,
          email,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
      })

      if (existingInvitation) {
        return NextResponse.json({ error: '이미 초대가 발송되었습니다.' }, { status: 400 })
      }

      // 만료된 PENDING 초대는 EXPIRED로 업데이트
      await prisma.tenantInvitation.updateMany({
        where: {
          tenantId,
          email,
          status: 'PENDING',
          expiresAt: { lte: new Date() },
        },
        data: { status: 'EXPIRED' },
      })

      // 초대 토큰 생성
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7일 후 만료

      // 초대 생성
      const invitation = await prisma.tenantInvitation.create({
        data: {
          tenantId,
          email,
          role,
          token,
          expiresAt,
          invitedBy: user.id,
        },
      })

      // 초대 이메일 발송
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/team/accept-invitation?token=${token}`

      // 테넌트 이름 조회
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true }
      })

      // 초대자 정보는 Supabase Auth에서 가져옴
      const inviterName = user.user_metadata?.full_name || user.email || '팀 관리자'
      const tenantName = tenant?.name || 'Echo Mail'

      // 이메일 발송 (비동기로 처리하여 응답 지연 방지)
      sendTeamInvitationEmail({
        email,
        inviteUrl,
        role,
        inviterName,
        tenantName,
      }).catch((err) => {
        logger.error('Failed to send invitation email (async)', { email, error: err })
      })

      // 활동 로그 기록
      const roleLabel = role === 'ADMIN' ? '관리자' : '멤버'
      await logActivity({
        tenantId,
        userId: user.id,
        userEmail: user.email!,
        userName: user.user_metadata?.full_name,
        action: 'MEMBER_INVITED',
        description: `${email}을(를) ${roleLabel}로 초대했습니다`,
        metadata: {
          invitationId: invitation.id,
          invitedEmail: email,
          role,
        },
      })

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
