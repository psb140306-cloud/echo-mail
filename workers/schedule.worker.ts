import { scheduleQueue, ScheduleJob } from '@/lib/queue'
import { prisma } from '@/lib/db'
import { cleanQueue, retryFailedJobs, getQueueStats } from '@/lib/queue'
import { cache } from '@/lib/redis'
import { getKSTStartOfDay, getKSTStartOfYesterday } from '@/lib/utils/date'

// 정리 작업
scheduleQueue.process('cleanup', async (job) => {
  console.log('[스케줄] 정리 작업 시작')

  try {
    // 오래된 로그 삭제
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const deletedEmails = await prisma.emailLog.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        status: { in: ['PROCESSED', 'IGNORED'] },
      },
    })

    const deletedNotifications = await prisma.notificationLog.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        status: { in: ['DELIVERED', 'CANCELLED'] },
      },
    })

    // 큐 정리
    await cleanQueue('notification')
    await cleanQueue('email')
    await cleanQueue('schedule')

    // 캐시 정리
    await cache.deletePattern('temp:*')
    await cache.deletePattern('expired:*')

    console.log(
      `[스케줄] 정리 완료 - 메일: ${deletedEmails.count}건, 알림: ${deletedNotifications.count}건`
    )

    return {
      deletedEmails: deletedEmails.count,
      deletedNotifications: deletedNotifications.count,
    }
  } catch (error) {
    console.error('[스케줄] 정리 작업 실패:', error)
    throw error
  }
})

// 헬스체크
scheduleQueue.process('health-check', async (job) => {
  console.log('[스케줄] 헬스체크 시작')

  try {
    // 데이터베이스 체크
    const dbCheck = await prisma.$queryRaw`SELECT 1 as check`

    // Redis 체크
    const redisCheck = await cache.set('health:check', Date.now(), 10)

    // 큐 상태 체크
    const queueStats = await getQueueStats()

    // 실패한 작업 재시도
    let retriedJobs = 0
    if (queueStats.notification.failed > 0) {
      retriedJobs += await retryFailedJobs('notification')
    }
    if (queueStats.email.failed > 0) {
      retriedJobs += await retryFailedJobs('email')
    }

    // 시스템 상태 저장
    await cache.set(
      'system:health',
      {
        timestamp: new Date().toISOString(),
        database: 'healthy',
        redis: 'healthy',
        queues: queueStats,
        retriedJobs,
      },
      300
    ) // 5분간 유지

    console.log(`[스케줄] 헬스체크 완료 - 재시도된 작업: ${retriedJobs}개`)

    return {
      status: 'healthy',
      retriedJobs,
      queueStats,
    }
  } catch (error) {
    console.error('[스케줄] 헬스체크 실패:', error)

    // 실패 상태 저장
    await cache.set(
      'system:health',
      {
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      300
    )

    throw error
  }
})

// 일일 리포트
scheduleQueue.process('daily-report', async (job) => {
  console.log('[스케줄] 일일 리포트 생성 시작')

  try {
    // KST 기준 어제/오늘
    const yesterday = getKSTStartOfYesterday()
    const today = getKSTStartOfDay()

    // 어제 처리된 메일 통계
    const emailStats = await prisma.emailLog.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
      _count: true,
    })

    // 어제 발송된 알림 통계
    const notificationStats = await prisma.notificationLog.groupBy({
      by: ['type', 'status'],
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
      _count: true,
    })

    // 업체별 통계
    const companyStats = await prisma.notificationLog.groupBy({
      by: ['companyId'],
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
      _count: true,
    })

    // 리포트 생성
    const report = {
      date: yesterday.toISOString().split('T')[0],
      emails: {
        total: emailStats.reduce((sum, stat) => sum + stat._count, 0),
        byStatus: emailStats.reduce(
          (acc, stat) => {
            acc[stat.status] = stat._count
            return acc
          },
          {} as Record<string, number>
        ),
      },
      notifications: {
        total: notificationStats.reduce((sum, stat) => sum + stat._count, 0),
        byTypeAndStatus: notificationStats.map((stat) => ({
          type: stat.type,
          status: stat.status,
          count: stat._count,
        })),
      },
      topCompanies: await Promise.all(
        companyStats
          .sort((a, b) => b._count - a._count)
          .slice(0, 5)
          .map(async (stat) => {
            if (!stat.companyId) return null
            const company = await prisma.company.findUnique({
              where: { id: stat.companyId },
              select: { name: true },
            })
            return {
              name: company?.name || 'Unknown',
              count: stat._count,
            }
          })
      ).then((results) => results.filter(Boolean)),
    }

    // 리포트 저장
    await cache.set(`report:daily:${report.date}`, report, 30 * 24 * 60 * 60) // 30일간 보관

    // 관리자에게 리포트 발송
    await sendDailyReportToAdmin(report)

    console.log('[스케줄] 일일 리포트 생성 완료')

    return report
  } catch (error) {
    console.error('[스케줄] 일일 리포트 생성 실패:', error)
    throw error
  }
})

// 관리자에게 리포트 발송
async function sendDailyReportToAdmin(report: any): Promise<void> {
  // TODO: 실제 구현 시 이메일 또는 메시지로 발송
  console.log('[리포트] 관리자에게 발송:', report)

  const adminConfig = await prisma.systemConfig.findUnique({
    where: { key: 'ADMIN_EMAIL' },
  })

  if (adminConfig?.value) {
    // 이메일 발송 로직 구현
    console.log(`[리포트] ${adminConfig.value}로 일일 리포트 발송`)
  }
}

// 큐 이벤트 리스너
scheduleQueue.on('completed', (job, result) => {
  console.log(`✅ 스케줄 작업 완료: ${job.name}`, result)
})

scheduleQueue.on('failed', (job, err) => {
  console.error(`❌ 스케줄 작업 실패: ${job.name}`, err)
})

export default scheduleQueue
