import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * 간단한 DB 연결 상태 체크 (핵심만)
 */
export async function GET() {
  try {
    const authError = await requireSuperAdmin()
    if (authError) return authError

    const startTime = Date.now()

    // 간단한 쿼리로 DB 연결 확인
    await prisma.$queryRaw`SELECT 1`

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      status: responseTime < 100 ? 'healthy' : 'degraded',
      responseTime,
      message: responseTime < 100
        ? 'Database connection healthy'
        : `Database response slow (${responseTime}ms)`,
    })
  } catch (error) {
    console.error('[DB Status] Error:', error)
    return NextResponse.json({
      status: 'down',
      message: error instanceof Error ? error.message : 'Database connection failed',
    })
  }
}
