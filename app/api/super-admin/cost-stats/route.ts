import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin'
import { prisma } from '@/lib/db'

// SMS/카카오 API 단가 (원)
const COST_PER_SMS = 18
const COST_PER_KAKAO_ALIMTALK = 8
const COST_PER_KAKAO_FRIENDTALK = 15

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 슈퍼 어드민 권한 확인
    const authError = await requireSuperAdmin()
    if (authError) return authError

    // 이번 달 시작일
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // 1. 발주 알림 (NotificationLog) 통계
    const orderNotifications = await prisma.notificationLog.groupBy({
      by: ['type', 'status'],
      where: {
        createdAt: {
          gte: startOfMonth,
        },
        status: {
          in: ['SENT', 'DELIVERED'],
        },
      },
      _count: {
        id: true,
      },
    })

    // 2. 대량 공지 (AnnouncementRecipient) 통계
    const announcements = await prisma.announcement.findMany({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
      select: {
        id: true,
        channel: true,
        recipients: {
          where: {
            status: {
              in: ['SENT', 'DELIVERED'],
            },
          },
          select: {
            id: true,
          },
        },
      },
    })

    // 공지별 발송 건수 집계
    let announcementSmsCount = 0
    let announcementKakaoAlimtalkCount = 0
    let announcementKakaoFriendtalkCount = 0

    announcements.forEach((announcement) => {
      const count = announcement.recipients.length
      switch (announcement.channel) {
        case 'SMS':
          announcementSmsCount += count
          break
        case 'KAKAO_ALIMTALK':
          announcementKakaoAlimtalkCount += count
          break
        case 'KAKAO_FRIENDTALK':
          announcementKakaoFriendtalkCount += count
          break
      }
    })

    // 3. 발주 알림 건수 집계
    let orderSmsCount = 0
    let orderKakaoAlimtalkCount = 0
    let orderKakaoFriendtalkCount = 0

    orderNotifications.forEach((item) => {
      switch (item.type) {
        case 'SMS':
          orderSmsCount += item._count.id
          break
        case 'KAKAO_ALIMTALK':
          orderKakaoAlimtalkCount += item._count.id
          break
        case 'KAKAO_FRIENDTALK':
          orderKakaoFriendtalkCount += item._count.id
          break
      }
    })

    // 4. 총 발송 건수
    const totalSms = orderSmsCount + announcementSmsCount
    const totalKakaoAlimtalk = orderKakaoAlimtalkCount + announcementKakaoAlimtalkCount
    const totalKakaoFriendtalk = orderKakaoFriendtalkCount + announcementKakaoFriendtalkCount
    const totalNotifications = totalSms + totalKakaoAlimtalk + totalKakaoFriendtalk

    // 5. API 원가 계산
    const smsCost = totalSms * COST_PER_SMS
    const kakaoAlimtalkCost = totalKakaoAlimtalk * COST_PER_KAKAO_ALIMTALK
    const kakaoFriendtalkCost = totalKakaoFriendtalk * COST_PER_KAKAO_FRIENDTALK
    const totalApiCost = smsCost + kakaoAlimtalkCost + kakaoFriendtalkCost

    // 6. 구독 매출 계산 (활성 구독만)
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        priceAmount: true,
        tenantId: true,
      },
    })

    const totalSubscriptionRevenue = activeSubscriptions.reduce(
      (sum, sub) => sum + (sub.priceAmount || 0),
      0
    )
    const activeSubscriptionCount = activeSubscriptions.length

    // 7. 순이익 계산
    const profit = totalSubscriptionRevenue - totalApiCost
    const profitMargin = totalSubscriptionRevenue > 0
      ? Math.round((profit / totalSubscriptionRevenue) * 100)
      : 0

    // 8. 테넌트별 발송량 TOP 5
    const tenantUsage = await prisma.notificationLog.groupBy({
      by: ['tenantId'],
      where: {
        createdAt: {
          gte: startOfMonth,
        },
        status: {
          in: ['SENT', 'DELIVERED'],
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    })

    // 테넌트 정보 조회
    const tenantIds = tenantUsage.map((t) => t.tenantId)
    const tenants = await prisma.tenant.findMany({
      where: {
        id: {
          in: tenantIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    })

    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]))

    const topTenants = tenantUsage.map((t) => ({
      tenantId: t.tenantId,
      tenantName: tenantMap.get(t.tenantId) || 'Unknown',
      count: t._count.id,
      estimatedCost: t._count.id * COST_PER_SMS, // 대략적 비용 (SMS 기준)
    }))

    return NextResponse.json({
      success: true,
      data: {
        // 발송 통계
        notifications: {
          total: totalNotifications,
          sms: totalSms,
          kakaoAlimtalk: totalKakaoAlimtalk,
          kakaoFriendtalk: totalKakaoFriendtalk,
          // 소스별 분리
          bySource: {
            order: {
              sms: orderSmsCount,
              kakaoAlimtalk: orderKakaoAlimtalkCount,
              kakaoFriendtalk: orderKakaoFriendtalkCount,
            },
            announcement: {
              sms: announcementSmsCount,
              kakaoAlimtalk: announcementKakaoAlimtalkCount,
              kakaoFriendtalk: announcementKakaoFriendtalkCount,
            },
          },
        },
        // 비용 통계
        costs: {
          sms: smsCost,
          kakaoAlimtalk: kakaoAlimtalkCost,
          kakaoFriendtalk: kakaoFriendtalkCost,
          totalApiCost,
          // 단가 정보
          unitCosts: {
            sms: COST_PER_SMS,
            kakaoAlimtalk: COST_PER_KAKAO_ALIMTALK,
            kakaoFriendtalk: COST_PER_KAKAO_FRIENDTALK,
          },
        },
        // 수익 통계
        revenue: {
          subscriptionRevenue: totalSubscriptionRevenue,
          activeSubscriptions: activeSubscriptionCount,
          profit,
          profitMargin,
        },
        // 테넌트별 TOP 5
        topTenants,
        // 메타 정보
        period: {
          start: startOfMonth.toISOString(),
          end: now.toISOString(),
        },
      },
    })
  } catch (error) {
    console.error('Cost stats error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '비용 통계 조회 실패',
      },
      { status: 500 }
    )
  }
}
