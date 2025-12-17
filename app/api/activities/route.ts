import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { withTenantContext, requireTenant } from '@/lib/middleware/tenant-context'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/validation'

export const dynamic = 'force-dynamic'

// Dashboard에서 기대하는 ActivityLog 형식
interface Activity {
  id: string
  action: string
  description: string
  timestamp: string
  type: 'email' | 'notification' | 'subscription' | 'system'
}

async function getActivities(request: NextRequest) {
  try {
    const tenantId = requireTenant()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // 최근 활동 로그 조회 (여러 소스에서)
    const [notificationLogs, emailLogs, recentCompanies, recentContacts] = await Promise.all([
      // 알림 발송 이력
      prisma.notificationLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          company: {
            select: { name: true },
          },
        },
      }),
      // 이메일 수신 이력
      prisma.emailLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          company: {
            select: { name: true },
          },
        },
      }),
      // 최근 생성된 업체
      prisma.company.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // 최근 생성된 담당자
      prisma.contact.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          company: {
            select: { name: true },
          },
        },
      }),
    ])

    // 활동 로그 통합 및 변환
    const activities: Activity[] = []

    // 알림 발송 이력 추가
    for (const log of notificationLogs) {
      const typeLabel = log.type === 'SMS' ? 'SMS' : '카카오톡'
      const statusLabel = getNotificationStatusLabel(log.status)

      activities.push({
        id: log.id,
        type: 'notification',
        action: `${typeLabel} ${statusLabel}`,
        description: log.company?.name
          ? `${log.company.name} - ${log.recipient}`
          : log.recipient,
        timestamp: log.createdAt.toISOString(),
      })
    }

    // 이메일 수신 이력 추가
    for (const log of emailLogs) {
      const statusLabel = getEmailStatusLabel(log.status)

      activities.push({
        id: log.id,
        type: 'email',
        action: `메일 ${statusLabel}`,
        description: log.company?.name
          ? `${log.company.name} - ${log.subject}`
          : log.subject,
        timestamp: log.createdAt.toISOString(),
      })
    }

    // 업체 생성 이력 추가
    for (const company of recentCompanies) {
      activities.push({
        id: `company-${company.id}`,
        type: 'system',
        action: '업체 등록',
        description: company.name,
        timestamp: company.createdAt.toISOString(),
      })
    }

    // 담당자 생성 이력 추가
    for (const contact of recentContacts) {
      activities.push({
        id: `contact-${contact.id}`,
        type: 'system',
        action: '담당자 등록',
        description: `${contact.name} (${contact.company?.name || '미지정'})`,
        timestamp: contact.createdAt.toISOString(),
      })
    }

    // 시간순 정렬 (최신순)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // 페이지네이션 적용
    const paginatedActivities = activities.slice(offset, offset + limit)

    logger.info('활동 로그 조회 완료', {
      tenantId,
      totalCount: activities.length,
      returnedCount: paginatedActivities.length,
    })

    return createSuccessResponse(paginatedActivities, '활동 로그를 성공적으로 조회했습니다.')
  } catch (error) {
    logger.error('활동 로그 조회 실패', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '활동 로그 조회에 실패했습니다.'
    )
  }
}

function getNotificationStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return '대기 중'
    case 'SENDING':
      return '발송 중'
    case 'SENT':
      return '발송 완료'
    case 'DELIVERED':
      return '전달됨'
    case 'FAILED':
      return '실패'
    case 'CANCELLED':
      return '취소됨'
    default:
      return status
  }
}

function getEmailStatusLabel(status: string): string {
  switch (status) {
    case 'RECEIVED':
      return '수신됨'
    case 'PROCESSED':
      return '처리됨'
    case 'MATCHED':
      return '매칭됨'
    case 'FAILED':
      return '처리 실패'
    case 'IGNORED':
      return '무시됨'
    default:
      return status
  }
}

export async function GET(request: NextRequest) {
  return withTenantContext(request, getActivities)
}
