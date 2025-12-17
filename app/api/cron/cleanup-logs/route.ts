import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify cron job authentication
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    logger.info('Cron job: Cleanup logs started')

    // Clean up old logs (older than 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Clean up old email logs
    const deletedEmailLogs = await prisma.emailLog.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo
        },
        status: {
          in: ['PROCESSED', 'IGNORED', 'FAILED']
        }
      }
    })

    // Clean up old notification logs
    const deletedNotificationLogs = await prisma.notificationLog.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo
        },
        status: {
          in: ['SENT', 'FAILED']
        }
      }
    })

    // Clean up old team activity logs (older than 90 days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const deletedActivityLogs = await prisma.teamActivity.deleteMany({
      where: {
        createdAt: {
          lt: ninetyDaysAgo
        }
      }
    })

    // Clean up expired team invitations (older than 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const deletedInvitations = await prisma.teamInvitation.deleteMany({
      where: {
        expiresAt: {
          lt: sevenDaysAgo
        },
        status: {
          in: ['PENDING', 'CANCELLED', 'DECLINED']
        }
      }
    })

    // Clean up old usage records (older than 12 months for detailed records)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const deletedUsageRecords = await prisma.usageRecord.deleteMany({
      where: {
        createdAt: {
          lt: twelveMonthsAgo
        }
      }
    })

    const summary = {
      emailLogs: deletedEmailLogs.count,
      notificationLogs: deletedNotificationLogs.count,
      activityLogs: deletedActivityLogs.count,
      invitations: deletedInvitations.count,
      usageRecords: deletedUsageRecords.count,
      timestamp: new Date().toISOString()
    }

    logger.info('Cron job: Cleanup logs completed', summary)

    return NextResponse.json({
      success: true,
      message: 'Log cleanup completed',
      data: summary
    })

  } catch (error) {
    logger.error('Cron job: Cleanup logs failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Log cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Support POST method for manual triggering
export async function POST(request: NextRequest) {
  return GET(request)
}