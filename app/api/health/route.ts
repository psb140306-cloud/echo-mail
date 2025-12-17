import { NextResponse } from 'next/server'
import { checkRedisConnection } from '@/lib/redis'
import { prisma } from '@/lib/db'
import { getQueueStats } from '@/lib/queue'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const startTime = Date.now()

    // 데이터베이스 연결 확인
    let dbStatus = 'healthy'
    let dbLatency = 0
    try {
      const dbStart = Date.now()
      await prisma.$queryRaw`SELECT 1`
      dbLatency = Date.now() - dbStart
    } catch (error) {
      dbStatus = 'unhealthy'
      console.error('Database health check failed:', error)
    }

    // Redis 연결 확인
    let redisStatus = 'healthy'
    let redisLatency = 0
    try {
      const redisStart = Date.now()
      const isConnected = await checkRedisConnection()
      redisLatency = Date.now() - redisStart
      if (!isConnected) {
        redisStatus = 'unhealthy'
      }
    } catch (error) {
      redisStatus = 'unhealthy'
      console.error('Redis health check failed:', error)
    }

    // 큐 상태 확인
    let queueStatus = 'healthy'
    let queueStats = null
    try {
      queueStats = await getQueueStats()
    } catch (error) {
      queueStatus = 'unhealthy'
      console.error('Queue health check failed:', error)
    }

    const totalLatency = Date.now() - startTime
    const overallStatus =
      dbStatus === 'healthy' && redisStatus === 'healthy' && queueStatus === 'healthy'
        ? 'healthy'
        : 'unhealthy'

    return NextResponse.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        uptime: process.uptime(),
        latency: totalLatency,
        services: {
          database: {
            status: dbStatus,
            latency: dbLatency,
          },
          redis: {
            status: redisStatus,
            latency: redisLatency,
          },
          queue: {
            status: queueStatus,
            stats: queueStats,
          },
        },
        environment: process.env.NODE_ENV,
        memory: process.memoryUsage(),
      },
      {
        status: overallStatus === 'healthy' ? 200 : 503,
      }
    )
  } catch (error) {
    console.error('Health check error:', error)

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      {
        status: 503,
      }
    )
  }
}
