import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

/**
 * 인증된 사용자의 테넌트 ID를 조회합니다.
 * Supabase Auth 사용자를 확인하고, Prisma users 테이블에서 tenantId를 가져옵니다.
 *
 * @returns 테넌트 ID 또는 null
 * @throws Error 인증되지 않은 사용자이거나 사용자를 찾을 수 없는 경우
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

  // Prisma에서 사용자 조회하여 tenantId 가져오기
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { tenantId: true, email: true },
  })

  if (!dbUser) {
    logger.error('User not found in database', { authUserId: user.id })
    throw new Error('사용자 정보를 찾을 수 없습니다.')
  }

  if (!dbUser.tenantId) {
    logger.warn('User has no tenant', { userId: user.id, email: dbUser.email })
    throw new Error('테넌트 정보가 없습니다. 회원가입을 완료해주세요.')
  }

  logger.debug('Tenant ID retrieved from user', {
    userId: user.id,
    tenantId: dbUser.tenantId,
  })

  return dbUser.tenantId
}

/**
 * 인증된 사용자 정보와 테넌트 ID를 함께 조회합니다.
 *
 * @returns 사용자 ID와 테넌트 ID
 */
export async function getAuthUserWithTenant(): Promise<{
  userId: string
  tenantId: string
  email: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('인증되지 않은 사용자입니다.')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { tenantId: true, email: true },
  })

  if (!dbUser) {
    throw new Error('사용자 정보를 찾을 수 없습니다.')
  }

  if (!dbUser.tenantId) {
    throw new Error('테넌트 정보가 없습니다. 회원가입을 완료해주세요.')
  }

  return {
    userId: user.id,
    tenantId: dbUser.tenantId,
    email: dbUser.email,
  }
}
