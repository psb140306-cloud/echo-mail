import { NextRequest, NextResponse } from 'next/server'
import { createMailServiceFromEnv } from '@/lib/mail/mail-service'
import { logger } from '@/lib/utils/logger'

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

    logger.info('Cron job: Check emails started')

    // Initialize mail service
    const mailService = createMailServiceFromEnv()

    // Check if mail service is running
    const status = mailService.getStatus()

    if (!status.isConnected) {
      logger.info('Mail service not connected, attempting to start')

      const started = await mailService.start()
      if (!started) {
        throw new Error('Failed to start mail service')
      }
    }

    // Check for new emails
    const processedEmails = await mailService.checkNow()

    logger.info('Cron job: Check emails completed', {
      processedCount: processedEmails.length,
      serviceStatus: mailService.getStatus()
    })

    return NextResponse.json({
      success: true,
      message: 'Email check completed',
      data: {
        processedCount: processedEmails.length,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    logger.error('Cron job: Check emails failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Email check failed',
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