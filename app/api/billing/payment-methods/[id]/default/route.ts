import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withTenantContext(request, async () => {
    try {
      // 사용자 인증 확인
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 })
      }

      const tenantId = user.user_metadata?.tenantId
      const methodId = params.id

      if (!tenantId) {
        return NextResponse.json({ error: '테넌트 정보가 필요합니다.' }, { status: 400 })
      }

      // 결제 수단 조회 및 권한 확인
      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: methodId,
          tenantId,
          isActive: true,
        },
      })

      if (!paymentMethod) {
        return NextResponse.json({ error: '결제 수단을 찾을 수 없습니다.' }, { status: 404 })
      }

      // 트랜잭션으로 기본 결제 수단 변경
      await prisma.$transaction(async (tx) => {
        // 기존 기본 결제 수단들을 모두 기본이 아니도록 변경
        await tx.paymentMethod.updateMany({
          where: {
            tenantId,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        })

        // 선택한 결제 수단을 기본으로 설정
        await tx.paymentMethod.update({
          where: { id: methodId },
          data: {
            isDefault: true,
          },
        })
      })

      // 실제 구현에서는 토스페이먼츠 API를 통해 기본 결제 수단 업데이트

      logger.info('Default payment method updated', {
        methodId,
        tenantId,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        message: '기본 결제 수단이 변경되었습니다.',
      })
    } catch (error) {
      logger.error('Failed to update default payment method', {
        methodId: params.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '기본 결제 수단 변경 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}