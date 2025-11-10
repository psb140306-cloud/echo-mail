import { PrismaClient } from '@prisma/client'
import { mailScheduler } from '../lib/scheduler/mail-scheduler'
import { logger } from '../lib/utils/logger'

const prisma = new PrismaClient()

async function main() {
  logger.info('[Worker] 메일 스케줄러 워커 시작')

  // 스케줄러 초기화
  await mailScheduler.reloadAllSchedules()

  logger.info('[Worker] 스케줄러 초기화 완료')

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('[Worker] SIGTERM 수신, 종료 중...')
    mailScheduler.stopAll()
    await prisma.$disconnect()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    logger.info('[Worker] SIGINT 수신, 종료 중...')
    mailScheduler.stopAll()
    await prisma.$disconnect()
    process.exit(0)
  })

  // Keep alive
  setInterval(() => {
    logger.debug('[Worker] Heartbeat')
  }, 60000) // 1분마다
}

main().catch((error) => {
  logger.error('[Worker] 치명적 오류:', error)
  process.exit(1)
})
