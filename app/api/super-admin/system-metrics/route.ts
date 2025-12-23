import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin'
import os from 'os'

export const dynamic = 'force-dynamic'

/**
 * 실제 시스템 메트릭 반환
 */
export async function GET() {
  try {
    const authError = await requireSuperAdmin()
    if (authError) return authError

    // CPU 사용률 계산
    const cpus = os.cpus()
    let totalIdle = 0
    let totalTick = 0

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times]
      }
      totalIdle += cpu.times.idle
    })

    const cpuUsage = 100 - Math.floor((totalIdle / totalTick) * 100)

    // 메모리 사용률 계산
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const memoryUsage = Math.floor((usedMemory / totalMemory) * 100)

    // 프로세스 uptime (서버 가동 시간)
    const uptimeSeconds = Math.floor(process.uptime())
    const uptimeHours = Math.floor(uptimeSeconds / 3600)
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60)

    return NextResponse.json({
      success: true,
      data: {
        cpu: {
          usage: cpuUsage,
          cores: cpus.length,
        },
        memory: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          usagePercent: memoryUsage,
        },
        system: {
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          uptime: {
            seconds: uptimeSeconds,
            hours: uptimeHours,
            minutes: uptimeMinutes,
            formatted: `${uptimeHours}h ${uptimeMinutes}m`,
          },
        },
        // 디스크는 serverless 환경에서 의미가 없으므로 제외
        // Vercel 같은 환경에서는 임시 파일시스템만 사용 가능
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[System Metrics API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
