import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export type ActivityAction =
  | 'MEMBER_INVITED'
  | 'MEMBER_JOINED'
  | 'MEMBER_REMOVED'
  | 'ROLE_CHANGED'
  | 'INVITATION_CANCELLED'
  | 'SETTINGS_UPDATED'

interface LogActivityParams {
  tenantId: string
  userId: string
  userEmail: string
  userName?: string | null
  action: ActivityAction
  description: string
  metadata?: Record<string, unknown>
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  const { tenantId, userId, userEmail, userName, action, description, metadata } = params

  try {
    await prisma.activityLog.create({
      data: {
        tenantId,
        userId,
        userEmail,
        userName,
        action,
        description,
        metadata: metadata || {},
      },
    })

    logger.info('Activity logged', {
      tenantId,
      userId,
      action,
      description,
    })
  } catch (error) {
    // 활동 로그 실패는 주요 기능에 영향을 주지 않도록 에러만 로깅
    logger.error('Failed to log activity', {
      tenantId,
      userId,
      action,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
