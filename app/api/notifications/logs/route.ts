import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { TenantContext, prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// 프론트엔드가 기대하는 NotificationLog 형식
interface NotificationLogResponse {
  id: string
  timestamp: string
  type: 'sms' | 'kakao'
  source: 'order' | 'announcement' // 발주알림 vs 대량공지
  companyName: string
  contactName: string
  phone: string
  status: 'success' | 'failed' | 'pending'
  message: string
  error?: string
  retryCount: number
}

// GET 통계: /api/notifications/logs?stats=true
async function getStats(tenantId: string) {
  try {
    // KST (UTC+9) 기준으로 오늘 시작 시간 계산
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000 // 9시간을 밀리초로
    const kstNow = new Date(now.getTime() + kstOffset)

    // KST 기준 오늘 00:00:00을 UTC로 변환
    const today = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 0, 0, 0, 0)
    )
    today.setTime(today.getTime() - kstOffset) // UTC 기준으로 변환

    // KST 기준 이번 달 1일 00:00:00을 UTC로 변환
    const thisMonth = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1, 0, 0, 0, 0)
    )
    thisMonth.setTime(thisMonth.getTime() - kstOffset) // UTC 기준으로 변환

    // NotificationLog 통계
    const [todayOrderStats, monthOrderStats, typeStats, statusStats] = await Promise.all([
      // 오늘 발주알림 통계 (성공한 것만: SENT 또는 DELIVERED)
      prisma.notificationLog.count({
        where: {
          tenantId,
          createdAt: { gte: today },
          status: { in: ['SENT', 'DELIVERED'] },
        },
      }),

      // 이번 달 발주알림 통계 (성공한 것만: SENT 또는 DELIVERED)
      prisma.notificationLog.count({
        where: {
          tenantId,
          createdAt: { gte: thisMonth },
          status: { in: ['SENT', 'DELIVERED'] },
        },
      }),

      // 타입별 통계
      prisma.notificationLog.groupBy({
        by: ['type'],
        where: { tenantId },
        _count: true,
      }),

      // 상태별 통계
      prisma.notificationLog.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
    ])

    // AnnouncementRecipient 통계
    const [todayAnnouncementStats, monthAnnouncementStats] = await Promise.all([
      prisma.announcementRecipient.count({
        where: {
          announcement: { tenantId },
          createdAt: { gte: today },
          status: { in: ['SENT', 'DELIVERED'] },
        },
      }),
      prisma.announcementRecipient.count({
        where: {
          announcement: { tenantId },
          createdAt: { gte: thisMonth },
          status: { in: ['SENT', 'DELIVERED'] },
        },
      }),
    ])

    return {
      today: todayOrderStats + todayAnnouncementStats,
      thisMonth: monthOrderStats + monthAnnouncementStats,
      byType: typeStats.reduce(
        (acc, item) => {
          acc[item.type] = item._count
          return acc
        },
        {} as Record<string, number>
      ),
      byStatus: statusStats.reduce(
        (acc, item) => {
          acc[item.status] = item._count
          return acc
        },
        {} as Record<string, number>
      ),
    }
  } catch (error) {
    logger.error('통계 조회 실패:', error)
    throw error
  }
}

// 상태 변환: DB 상태 → 프론트엔드 상태
function mapStatus(status: string): 'success' | 'failed' | 'pending' {
  switch (status) {
    case 'SENT':
    case 'DELIVERED':
      return 'success'
    case 'FAILED':
      return 'failed'
    case 'PENDING':
    default:
      return 'pending'
  }
}

// 타입 변환: DB 타입 → 프론트엔드 타입
function mapType(type: string): 'sms' | 'kakao' {
  return type === 'KAKAO_ALIMTALK' ? 'kakao' : 'sms'
}

// GET: 발송 내역 조회 또는 통계
export async function GET(request: NextRequest) {
  return withTenantContext(request, async (req) => {
    try {
      // TenantContext에서 tenantId 가져오기
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return NextResponse.json(
          { success: false, error: '테넌트 정보를 찾을 수 없습니다.' },
          { status: 401 }
        )
      }

      const { searchParams } = new URL(req.url)

      // 통계 조회
      if (searchParams.get('stats') === 'true') {
        const stats = await getStats(tenantId)
        return NextResponse.json({
          success: true,
          data: stats,
        })
      }

      // 발송 내역 조회
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '50')
      const type = searchParams.get('type') // SMS, KAKAO_ALIMTALK
      const status = searchParams.get('status') // SENT, FAILED, PENDING, DELIVERED
      const source = searchParams.get('source') // order, announcement, all (default: all)
      const search = searchParams.get('search')

      const skip = (page - 1) * limit

      const results: NotificationLogResponse[] = []
      let totalOrder = 0
      let totalAnnouncement = 0

      // 발주 알림 조회 (source가 'announcement'가 아닌 경우)
      if (source !== 'announcement') {
        const orderWhere: any = { tenantId }

        if (type) orderWhere.type = type
        if (status) orderWhere.status = status
        if (search) {
          orderWhere.OR = [
            { recipient: { contains: search } },
            { message: { contains: search } },
            { company: { name: { contains: search } } },
          ]
        }

        const [orderLogs, orderCount] = await Promise.all([
          prisma.notificationLog.findMany({
            where: orderWhere,
            orderBy: { createdAt: 'desc' },
            skip: source === 'order' ? skip : 0,
            take: source === 'order' ? limit : Math.ceil(limit / 2),
            include: {
              company: { select: { name: true } },
            },
          }),
          prisma.notificationLog.count({ where: orderWhere }),
        ])

        totalOrder = orderCount

        // 변환
        for (const log of orderLogs) {
          results.push({
            id: log.id,
            timestamp: log.createdAt.toISOString(),
            type: mapType(log.type),
            source: 'order',
            companyName: log.company?.name || '알 수 없음',
            contactName: '-', // NotificationLog에는 contactName이 없음
            phone: log.recipient,
            status: mapStatus(log.status),
            message: log.message,
            error: log.errorMessage || undefined,
            retryCount: log.retryCount,
          })
        }
      }

      // 대량 공지 조회 (source가 'order'가 아닌 경우)
      if (source !== 'order') {
        const announcementWhere: any = {
          announcement: { tenantId },
        }

        if (status) announcementWhere.status = status
        if (search) {
          announcementWhere.OR = [
            { phone: { contains: search } },
            { contactName: { contains: search } },
            { companyName: { contains: search } },
          ]
        }

        const [announcementLogs, announcementCount] = await Promise.all([
          prisma.announcementRecipient.findMany({
            where: announcementWhere,
            orderBy: { createdAt: 'desc' },
            skip: source === 'announcement' ? skip : 0,
            take: source === 'announcement' ? limit : Math.ceil(limit / 2),
            include: {
              announcement: {
                select: { channel: true, content: true, title: true },
              },
            },
          }),
          prisma.announcementRecipient.count({ where: announcementWhere }),
        ])

        totalAnnouncement = announcementCount

        // 타입 필터 적용 (AnnouncementRecipient 조회 후)
        for (const log of announcementLogs) {
          // type 필터가 있으면 announcement.channel과 비교
          if (type && log.announcement.channel !== type) continue

          results.push({
            id: log.id,
            timestamp: log.createdAt.toISOString(),
            type: mapType(log.announcement.channel),
            source: 'announcement',
            companyName: log.companyName,
            contactName: log.contactName,
            phone: log.phone,
            status: mapStatus(log.status),
            message: log.announcement.content.substring(0, 100) + (log.announcement.content.length > 100 ? '...' : ''),
            error: log.errorMessage || undefined,
            retryCount: log.retryCount,
          })
        }
      }

      // 시간순 정렬 (최신순)
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // 페이지네이션 적용 (source가 'all'인 경우에만)
      const total = source === 'order' ? totalOrder : source === 'announcement' ? totalAnnouncement : totalOrder + totalAnnouncement
      const paginatedResults = source ? results : results.slice(skip, skip + limit)

      return NextResponse.json({
        success: true,
        data: paginatedResults.slice(0, limit),
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error('발송 내역 조회 실패:', error)
      return NextResponse.json(
        {
          success: false,
          error: '발송 내역을 불러오는데 실패했습니다.',
        },
        { status: 500 }
      )
    }
  })
}
