import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

/**
 * 인증된 사용자의 테넌트 ID를 조회합니다.
 * Supabase Auth 사용자를 확인하고, TenantMember를 통해 tenantId를 가져옵니다.
 *
 * @returns 테넌트 ID
 * @throws Error 인증되지 않은 사용자이거나 멤버십을 찾을 수 없는 경우
 */
export async function getTenantIdFromAuthUser(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    logger.warn('Unauthorized access attempt', { error: authError?.message })
    throw new Error('인증되지 않은 사용자입니다.')
  }

  // TenantMember를 통해 사용자의 tenant 조회
  const membership = await prisma.tenantMember.findFirst({
    where: {
      userId: user.id,
      status: 'ACTIVE',
    },
    select: {
      tenantId: true,
      userEmail: true,
      role: true,
    },
  })

  if (!membership) {
    logger.error('No active tenant membership found', {
      authUserId: user.id,
      email: user.email,
    })
    throw new Error('테넌트 정보를 찾을 수 없습니다. 회원가입을 완료해주세요.')
  }

  logger.debug('Tenant ID retrieved from membership', {
    userId: user.id,
    tenantId: membership.tenantId,
    role: membership.role,
  })

  return membership.tenantId
}

/**
 * 인증된 사용자 정보와 테넌트 ID를 함께 조회합니다.
 *
 * @returns 사용자 ID, 테넌트 ID, 이메일, 역할
 */
export async function getAuthUserWithTenant(): Promise<{
  userId: string
  tenantId: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('인증되지 않은 사용자입니다.')
  }

  const membership = await prisma.tenantMember.findFirst({
    where: {
      userId: user.id,
      status: 'ACTIVE',
    },
    select: {
      tenantId: true,
      userEmail: true,
      role: true,
    },
  })

  if (!membership) {
    throw new Error('테넌트 정보를 찾을 수 없습니다. 회원가입을 완료해주세요.')
  }

  return {
    userId: user.id,
    tenantId: membership.tenantId,
    email: membership.userEmail,
    role: membership.role,
  }
}
