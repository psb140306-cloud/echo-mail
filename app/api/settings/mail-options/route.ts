import { NextRequest, NextResponse } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { withTenantContext, canModifySettings } from '@/lib/middleware/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionPlan } from '@/lib/subscription/plans'
import {
  isValidMailMode,
  isValidMailSendingEnabled,
  getUpgradeMessage,
  MailMode,
} from '@/lib/subscription/plan-checker'
import { logActivity } from '@/lib/activity/log-activity'

export const dynamic = 'force-dynamic'

// 메일 옵션 스키마
const mailOptionsSchema = z.object({
  mailMode: z.enum(['ORDER_ONLY', 'FULL_INBOX']),
  mailSendingEnabled: z.boolean(),
})

/**
 * GET: 현재 테넌트의 메일 옵션 조회
 */
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          mailMode: true,
          mailSendingEnabled: true,
          subscriptionPlan: true,
        },
      })

      if (!tenant) {
        return createErrorResponse('테넌트를 찾을 수 없습니다.', 404)
      }

      const plan = tenant.subscriptionPlan as SubscriptionPlan

      return createSuccessResponse({
        mailMode: tenant.mailMode || 'ORDER_ONLY',
        mailSendingEnabled: tenant.mailSendingEnabled || false,
        // 플랜별 권한 정보도 함께 반환
        permissions: {
          canChangeMailMode: isValidMailMode(plan, 'FULL_INBOX'),
          canEnableMailSending: isValidMailSendingEnabled(plan, true),
        },
        currentPlan: plan,
      })
    } catch (error) {
      logger.error('메일 옵션 조회 실패:', error)
      return createErrorResponse('메일 옵션을 불러오는데 실패했습니다.')
    }
  })
}

/**
 * PUT: 메일 옵션 업데이트
 * - OWNER 또는 ADMIN만 변경 가능
 * - 플랜에 따른 권한 검증
 */
export async function PUT(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // 사용자 인증 확인
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return createErrorResponse('인증이 필요합니다.', 401)
      }

      // 역할 검증: OWNER 또는 ADMIN만 허용
      const canModify = await canModifySettings(user.id, tenantId)
      if (!canModify) {
        logger.warn('메일 옵션 변경 권한 없음', { userId: user.id, tenantId })
        return createErrorResponse(
          '메일 옵션을 변경할 권한이 없습니다. OWNER 또는 ADMIN 권한이 필요합니다.',
          403
        )
      }

      // 요청 데이터 파싱 및 검증
      const { data, error } = await parseAndValidate(request, mailOptionsSchema)
      if (error) return error

      // 현재 테넌트 정보 조회
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          subscriptionPlan: true,
          mailMode: true,
          mailSendingEnabled: true,
        },
      })

      if (!tenant) {
        return createErrorResponse('테넌트를 찾을 수 없습니다.', 404)
      }

      const plan = tenant.subscriptionPlan as SubscriptionPlan

      // 플랜별 권한 검증
      // 1. mailMode 변경 검증
      if (data.mailMode === 'FULL_INBOX' && !isValidMailMode(plan, 'FULL_INBOX')) {
        const upgradeInfo = getUpgradeMessage('fullMailbox')
        return createErrorResponse(
          `${upgradeInfo.description} 현재 플랜: ${plan}, 필요 플랜: ${upgradeInfo.requiredPlan}`,
          403
        )
      }

      // 2. mailSendingEnabled 변경 검증
      if (data.mailSendingEnabled && !isValidMailSendingEnabled(plan, true)) {
        const upgradeInfo = getUpgradeMessage('mailSending')
        return createErrorResponse(
          `${upgradeInfo.description} 현재 플랜: ${plan}, 필요 플랜: ${upgradeInfo.requiredPlan}`,
          403
        )
      }

      // 변경 사항 기록을 위한 이전 값 저장
      const previousMailMode = tenant.mailMode || 'ORDER_ONLY'
      const previousMailSendingEnabled = tenant.mailSendingEnabled || false

      // 테넌트 업데이트
      const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          mailMode: data.mailMode,
          mailSendingEnabled: data.mailSendingEnabled,
        },
        select: {
          mailMode: true,
          mailSendingEnabled: true,
        },
      })

      // 활동 로그 기록
      if (previousMailMode !== data.mailMode) {
        await logActivity({
          type: 'SETTINGS_CHANGED',
          description: `메일 모드가 '${previousMailMode}'에서 '${data.mailMode}'(으)로 변경되었습니다.`,
          metadata: {
            setting: 'mailMode',
            previousValue: previousMailMode,
            newValue: data.mailMode,
          },
        })
      }

      if (previousMailSendingEnabled !== data.mailSendingEnabled) {
        await logActivity({
          type: 'SETTINGS_CHANGED',
          description: `메일 발신 기능이 '${previousMailSendingEnabled ? '활성화' : '비활성화'}'에서 '${data.mailSendingEnabled ? '활성화' : '비활성화'}'(으)로 변경되었습니다.`,
          metadata: {
            setting: 'mailSendingEnabled',
            previousValue: previousMailSendingEnabled,
            newValue: data.mailSendingEnabled,
          },
        })
      }

      logger.info('메일 옵션 업데이트 완료', {
        tenantId,
        userId: user.id,
        mailMode: data.mailMode,
        mailSendingEnabled: data.mailSendingEnabled,
      })

      return createSuccessResponse(
        {
          mailMode: updatedTenant.mailMode,
          mailSendingEnabled: updatedTenant.mailSendingEnabled,
        },
        '메일 옵션이 저장되었습니다.'
      )
    } catch (error) {
      logger.error('메일 옵션 업데이트 실패:', error)

      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      const isDev = process.env.NODE_ENV === 'development'

      return createErrorResponse(
        isDev ? `메일 옵션 저장 실패: ${errorMessage}` : '메일 옵션 저장에 실패했습니다.'
      )
    }
  })
}
