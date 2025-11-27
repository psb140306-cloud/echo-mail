import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withTenantContext, requireTenant } from '@/lib/middleware/tenant-context'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

interface RecipientSummary {
  recipient: string
  companyName: string | null
  contactName: string | null
  totalSent: number
  successCount: number
  failedCount: number
  lastSentAt: Date | null
  lastStatus: string | null
  isBlocked: boolean
}

async function getRecipients(request: NextRequest) {
  try {
    const tenantId = requireTenant()

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // all, failed, blocked
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // 기본 조건
    const whereCondition: any = { tenantId }

    // 검색 조건
    if (search) {
      whereCondition.recipient = { contains: search }
    }

    // 수신자별 통계 조회
    const recipientStats = await prisma.notificationLog.groupBy({
      by: ['recipient'],
      where: whereCondition,
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _count: { recipient: 'desc' } },
      skip: offset,
      take: limit,
    })

    // 총 수신자 수
    const totalRecipients = await prisma.notificationLog.groupBy({
      by: ['recipient'],
      where: whereCondition,
      _count: true,
    })

    // 각 수신자의 상세 정보 조회
    const recipients: RecipientSummary[] = await Promise.all(
      recipientStats.map(async (stat) => {
        // 최근 발송 내역
        const lastLog = await prisma.notificationLog.findFirst({
          where: {
            tenantId,
            recipient: stat.recipient,
          },
          orderBy: { createdAt: 'desc' },
          include: {
            company: { select: { name: true } },
          },
        })

        // 성공/실패 건수
        const [successCount, failedCount] = await Promise.all([
          prisma.notificationLog.count({
            where: {
              tenantId,
              recipient: stat.recipient,
              status: { in: ['SENT', 'DELIVERED'] },
            },
          }),
          prisma.notificationLog.count({
            where: {
              tenantId,
              recipient: stat.recipient,
              status: 'FAILED',
            },
          }),
        ])

        // 담당자 정보 조회
        let contactName: string | null = null
        if (lastLog?.contactId) {
          const contact = await prisma.contact.findUnique({
            where: { id: lastLog.contactId },
            select: { name: true },
          })
          contactName = contact?.name || null
        }

        return {
          recipient: stat.recipient,
          companyName: lastLog?.company?.name || null,
          contactName,
          totalSent: stat._count._all,
          successCount,
          failedCount,
          lastSentAt: lastLog?.createdAt || null,
          lastStatus: lastLog?.status || null,
          isBlocked: false, // 추후 블록 리스트 테이블 구현 시 연동
        }
      })
    )

    // 필터 적용
    let filteredRecipients = recipients
    if (filter === 'failed') {
      filteredRecipients = recipients.filter((r) => r.failedCount > 0)
    }

    // 실패율 높은 번호 (3회 이상 실패)
    const problematicRecipients = recipients.filter((r) => r.failedCount >= 3)

    const result = {
      recipients: filteredRecipients,
      pagination: {
        page,
        limit,
        total: totalRecipients.length,
        totalPages: Math.ceil(totalRecipients.length / limit),
      },
      summary: {
        totalRecipients: totalRecipients.length,
        problematicCount: problematicRecipients.length,
      },
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.error('수신자 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '수신자 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 특정 수신자의 발송 내역 조회
async function getRecipientHistory(request: NextRequest) {
  try {
    const tenantId = requireTenant()

    const { searchParams } = new URL(request.url)
    const recipient = searchParams.get('recipient')

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient is required' }, { status: 400 })
    }

    const logs = await prisma.notificationLog.findMany({
      where: {
        tenantId,
        recipient,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        company: { select: { name: true } },
      },
    })

    return NextResponse.json({ success: true, data: logs })
  } catch (error) {
    logger.error('수신자 발송 내역 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '발송 내역 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'history') {
    return withTenantContext(request, async () => getRecipientHistory(request))
  }

  return withTenantContext(request, async () => getRecipients(request))
}
