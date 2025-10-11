import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/middleware/super-admin';
import { metricsCollector } from '@/lib/monitoring/metrics-collector';
import os from 'os';

/**
 * GET /api/super-admin/monitoring/metrics
 * 실시간 서버 메트릭 조회
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    // 시스템 메트릭 수집
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // CPU 사용률 계산
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + (1 - idle / total) * 100;
    }, 0) / cpus.length;

    // 메모리 사용률
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    // 프로세스 메모리
    const processMemory = process.memoryUsage();

    // 네트워크 메트릭 (메트릭 컬렉터에서 가져오기)
    const networkInStats = metricsCollector.getMetricStats('system_network_in', Date.now() - 60000);
    const networkOutStats = metricsCollector.getMetricStats('system_network_out', Date.now() - 60000);

    // API 메트릭
    const apiMetrics = {
      totalRequests: metricsCollector.getMetricStats('api_requests_total', Date.now() - 3600000),
      errorRate: metricsCollector.getMetricStats('api_requests_error', Date.now() - 3600000),
      avgResponseTime: metricsCollector.getMetricStats('api_response_time', Date.now() - 3600000),
    };

    const metrics = {
      timestamp: Date.now(),
      system: {
        cpu: {
          usage: parseFloat(cpuUsage.toFixed(2)),
          cores: cpus.length,
        },
        memory: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          usagePercent: parseFloat(memoryUsagePercent.toFixed(2)),
        },
        process: {
          heapUsed: processMemory.heapUsed,
          heapTotal: processMemory.heapTotal,
          external: processMemory.external,
          rss: processMemory.rss,
        },
        uptime: {
          system: os.uptime(),
          process: process.uptime(),
        },
        network: {
          in: networkInStats?.latest || 0,
          out: networkOutStats?.latest || 0,
        },
      },
      api: {
        totalRequests: apiMetrics.totalRequests?.sum || 0,
        errorCount: apiMetrics.errorRate?.sum || 0,
        avgResponseTime: apiMetrics.avgResponseTime?.avg || 0,
      },
      collector: metricsCollector.getSummary(),
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('메트릭 조회 실패:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '메트릭 조회 실패' },
      { status: 500 }
    );
  }
}
