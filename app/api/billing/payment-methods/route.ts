import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

      if (!tenantId) {
        return NextResponse.json({ error: '테넌트 정보가 필요합니다.' }, { status: 400 })
      }

      // 결제 수단 조회
      const paymentMethods = await prisma.paymentMethod.findMany({
        where: {
          tenantId,
          isActive: true,
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      })

      logger.info('Payment methods retrieved', {
        tenantId,
        count: paymentMethods.length,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        data: paymentMethods.map(method => ({
          id: method.id,
          type: method.type,
          last4: method.last4,
          brand: method.brand,
          expiryMonth: method.expiryMonth,
          expiryYear: method.expiryYear,
          isDefault: method.isDefault,
          createdAt: method.createdAt.toISOString(),
        })),
      })
    } catch (error) {
      logger.error('Failed to retrieve payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '결제 수단 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}

export async function POST(request: NextRequest) {
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

      if (!tenantId) {
        return NextResponse.json({ error: '테넌트 정보가 필요합니다.' }, { status: 400 })
      }

      // 테넌트 정보 조회
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            take: 1,
          },
        },
      })

      if (!tenant) {
        return NextResponse.json({ error: '테넌트를 찾을 수 없습니다.' }, { status: 404 })
      }

      // 토스페이먼츠 결제 위젯 URL 생성
      // 실제 구현에서는 토스페이먼츠 SDK를 사용하여 위젯 URL을 생성
      const widgetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/billing/add-payment-method?tenantId=${tenantId}&userId=${user.id}`

      logger.info('Payment method addition initiated', {
        tenantId,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        widgetUrl,
        message: '결제 수단 추가 페이지로 이동합니다.',
      })
    } catch (error) {
      logger.error('Failed to initiate payment method addition', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '결제 수단 추가 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}