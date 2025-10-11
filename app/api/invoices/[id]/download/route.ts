import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { generateInvoicePDF, InvoiceData, DEFAULT_SUPPLIER } from '@/lib/invoice/invoice-generator'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export async function GET(
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

      // PDF 생성
      const pdfBlob = await generateInvoicePDF(invoiceData)
      const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

      logger.info('Invoice PDF generated', {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        userId: user.id,
      })

      // PDF 응답
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
          'Cache-Control': 'no-cache',
        },
      })
    } catch (error) {
      logger.error('Invoice PDF generation failed', {
        invoiceId: params.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        { error: 'PDF 생성 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  })
}