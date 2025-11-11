import { startApiServer } from './api-server'
import { logger } from '../lib/utils/logger'

async function main() {
  try {
    logger.info('[Worker] Echo Mail Worker 시작')
    await startApiServer()
  } catch (error) {
    logger.error('[Worker] 시작 실패:', error)
    process.exit(1)
  }
}

main()
