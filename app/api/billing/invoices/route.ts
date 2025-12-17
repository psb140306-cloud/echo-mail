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

      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
      const status = searchParams.get('status')

      const skip = (page - 1) * limit

      // 조건 설정
      const where: any = {
        tenantId,
      }

      if (status) {
        where.status = status
      }

      // 인보이스 조회
      const [invoices, totalCount] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            subscription: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.invoice.count({ where }),
      ])

      logger.info('Invoices retrieved', {
        tenantId,
        count: invoices.length,
        totalCount,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        data: invoices.map(invoice => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          amount: invoice.total,
          subtotal: invoice.subtotal,
          tax: invoice.tax,
          currency: invoice.currency,
          periodStart: invoice.periodStart.toISOString(),
          periodEnd: invoice.periodEnd.toISOString(),
          paidAt: invoice.paidAt?.toISOString(),
          createdAt: invoice.createdAt.toISOString(),
          subscription: invoice.subscription ? {
            plan: invoice.subscription.plan,
          } : null,
        })),
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      })
    } catch (error) {
      logger.error('Failed to retrieve invoices', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '인보이스 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}