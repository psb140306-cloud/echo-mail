import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function DELETE(
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
        },
      })

      if (!paymentMethod) {
        return NextResponse.json({ error: '결제 수단을 찾을 수 없습니다.' }, { status: 404 })
      }

      // 기본 결제 수단인지 확인
      if (paymentMethod.isDefault) {
        const otherMethods = await prisma.paymentMethod.count({
          where: {
            tenantId,
            id: { not: methodId },
            isActive: true,
          },
        })

        if (otherMethods === 0) {
          return NextResponse.json(
            { error: '기본 결제 수단은 다른 결제 수단이 있을 때만 삭제할 수 있습니다.' },
            { status: 400 }
          )
        }

        // 다른 결제 수단을 기본으로 설정
        await prisma.paymentMethod.updateMany({
          where: {
            tenantId,
            id: { not: methodId },
            isActive: true,
          },
          data: { isDefault: true },
        })
      }

      // 결제 수단 비활성화 (소프트 삭제)
      await prisma.paymentMethod.update({
        where: { id: methodId },
        data: {
          isActive: false,
          isDefault: false,
        },
      })

      // 실제 구현에서는 토스페이먼츠 API를 통해 결제 수단 삭제

      logger.info('Payment method deleted', {
        methodId,
        tenantId,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        message: '결제 수단이 삭제되었습니다.',
      })
    } catch (error) {
      logger.error('Failed to delete payment method', {
        methodId: params.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '결제 수단 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}