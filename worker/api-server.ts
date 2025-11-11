import express from 'express'
import { PrismaClient } from '@prisma/client'
import { mailScheduler } from '../lib/scheduler/mail-scheduler'
import { logger } from '../lib/utils/logger'

const app = express()
const prisma = new PrismaClient()

// JSON 파싱
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'echo-mail-worker',
    timestamp: new Date().toISOString()
  })
})

// 스케줄러 재로드 엔드포인트
app.post('/reload-scheduler', async (req, res) => {
  try {
    // 인증 체크
    const authHeader = req.headers.authorization
    const expectedSecret = process.env.RAILWAY_WORKER_SECRET

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      logger.warn('[API] 인증 실패: 잘못된 시크릿')
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    logger.info('[API] 스케줄러 재로드 요청 수신')

    // 스케줄러 재로드
    await mailScheduler.reloadAllSchedules()

    logger.info('[API] 스케줄러 재로드 완료')

    res.json({
      success: true,
      message: '스케줄러가 성공적으로 재로드되었습니다.',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('[API] 스케줄러 재로드 실패:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

// 스케줄러 상태 조회
app.get('/scheduler/status', async (req, res) => {
  try {
    // 인증 체크
    const authHeader = req.headers.authorization
    const expectedSecret = process.env.RAILWAY_WORKER_SECRET

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    const status = mailScheduler.getStatus()

    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('[API] 스케줄러 상태 조회 실패:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// 수동 메일 체크 (테스트용)
app.post('/check-mail-now', async (req, res) => {
  try {
    // 인증 체크
    const authHeader = req.headers.authorization
    const expectedSecret = process.env.RAILWAY_WORKER_SECRET

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    logger.info('[API] 수동 메일 체크 요청 수신')

    const { mailMonitorService } = await import('../lib/mail/mail-monitor-service')
    const results = await mailMonitorService.checkAllTenants()

    const summary = Array.from(results.entries()).map(([tenantId, result]) => ({
      tenantId,
      success: result.success,
      newMails: result.newMailsCount,
      processed: result.processedCount,
      failed: result.failedCount,
      errors: result.errors
    }))

    logger.info('[API] 수동 메일 체크 완료', { summary })

    res.json({
      success: true,
      message: '메일 체크 완료',
      results: summary,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('[API] 수동 메일 체크 실패:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  })
})

// 서버 시작
export async function startApiServer() {
  const PORT = process.env.PORT || 8080

  // 스케줄러 초기화
  logger.info('[Worker] 메일 스케줄러 워커 시작')
  await mailScheduler.reloadAllSchedules()
  logger.info('[Worker] 스케줄러 초기화 완료')

  // API 서버 시작
  app.listen(PORT, () => {
    logger.info(`[API] 워커 API 서버 시작: 포트 ${PORT}`)
  })

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('[Worker] 종료 신호 수신, 종료 중...')
    mailScheduler.stopAll()
    await prisma.$disconnect()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  // Keep alive
  setInterval(() => {
    logger.debug('[Worker] Heartbeat')
  }, 60000) // 1분마다
}

// 직접 실행시
if (require.main === module) {
  startApiServer().catch((error) => {
    logger.error('[Worker] 치명적 오류:', error)
    process.exit(1)
  })
}
