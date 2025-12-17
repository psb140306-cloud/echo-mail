import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { sendInvoiceEmail } from '@/lib/invoice/invoice-email'
import { InvoiceData, DEFAULT_SUPPLIER } from '@/lib/invoice/invoice-generator'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function POST(
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

      const { recipientEmail } = await request.json()

      if (!recipientEmail) {
        return NextResponse.json({ error: '수신자 이메일이 필요합니다.' }, { status: 400 })
      }

      const invoiceId = params.id

      // 인보이스 조회
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          tenantId: user.user_metadata?.tenantId,
        },
        include: {
          tenant: true,
          subscription: {
            include: {
              plan: true,
            },
          },
          invoiceItems: true,
        },
      })

      if (!invoice) {
        return NextResponse.json({ error: '인보이스를 찾을 수 없습니다.' }, { status: 404 })
      }

      // 인보이스 데이터 변환
      const invoiceData: InvoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.createdAt.toLocaleDateString('ko-KR'),
        dueDate: invoice.dueDate.toLocaleDateString('ko-KR'),
        status: invoice.status as 'PAID' | 'PENDING' | 'OVERDUE',

        supplier: DEFAULT_SUPPLIER,

        customer: {
          name: invoice.tenant.name,
          address: invoice.billingAddress || '주소 미입력',
          phone: invoice.billingPhone || '전화번호 미입력',
          email: invoice.billingEmail || user.email || '',
          businessNumber: invoice.businessNumber,
        },

        items: invoice.invoiceItems.map(item => ({
          description: item.description,
          period: item.period || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice.toNumber(),
          amount: item.amount.toNumber(),
        })),

        subtotal: invoice.subtotal.toNumber(),
        vatRate: invoice.vatRate.toNumber(),
        vatAmount: invoice.vatAmount.toNumber(),
        total: invoice.total.toNumber(),
      }

      // 이메일 발송
      const result = await sendInvoiceEmail(invoiceData, recipientEmail)

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || '이메일 발송에 실패했습니다.' },
          { status: 500 }
        )
      }

      // 발송 기록 업데이트
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          emailSentAt: new Date(),
          emailSentTo: recipientEmail,
        },
      })

      logger.info('Invoice email sent successfully', {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        recipient: recipientEmail,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        message: '인보이스 이메일이 성공적으로 발송되었습니다.',
      })
    } catch (error) {
      logger.error('Invoice email sending failed', {
        invoiceId: params.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: '이메일 발송 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}