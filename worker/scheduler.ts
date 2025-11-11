// Railway Worker Entry Point
// Express API 서버로 통합됨
import { startApiServer } from './api-server'

startApiServer().catch((error) => {
  console.error('[Worker] 치명적 오류:', error)
  process.exit(1)
})
