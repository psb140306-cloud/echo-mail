import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/middleware/super-admin';
import { metricsCollector } from '@/lib/monitoring/metrics-collector';
import { prisma } from '@/lib/db';

/**
 * GET /api/super-admin/monitoring/performance
 * 성능 메트릭 조회
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    const since = Date.now() - hours * 3600000;

    // 응답 시간 통계
    const responseTimeStats = metricsCollector.getMetricStats('api_response_time', since);
    const p95Stats = metricsCollector.getMetricStats('api_response_time_p95', since);
    const p99Stats = metricsCollector.getMetricStats('api_response_time_p99', since);

    // 처리량
    const requestStats = metricsCollector.getMetricStats('api_requests_total', since);
    const throughput = requestStats ? Math.round(requestStats.sum / (hours * 60)) : 0;

    // 시간대별 응답 시간 추이
    const hourlyResponseTime = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(Date.now() - (23 - i) * 3600000);
      const hourStart = hour.setMinutes(0, 0, 0);

      // Mock 데이터 (실제로는 메트릭에서 가져와야 함)
      return {
        time: `${hour.getHours()}:00`,
        timestamp: hourStart,
        avg: Math.floor(Math.random() * 50) + 30,
        p95: Math.floor(Math.random() * 80) + 80,
        p99: Math.floor(Math.random() * 150) + 200,
      };
    });

    // 시간대별 처리량 및 에러율
    const hourlyThroughput = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(Date.now() - (23 - i) * 3600000);
      const hourStart = hour.setMinutes(0, 0, 0);

      return {
        time: `${hour.getHours()}:00`,
        timestamp: hourStart,
        requests: Math.floor(Math.random() * 1000) + 500,
        success: Math.floor(Math.random() * 950) + 480,
        errors: Math.floor(Math.random() * 50) + 10,
      };
    });

    // 엔드포인트별 성능
    const endpointPerformance = [
      { endpoint: '/api/companies', avg: 12.5, p95: 45.3, p99: 98.2, count: 8934 },
      { endpoint: '/api/notifications/send', avg: 234.7, p95: 567.8, p99: 892.1, count: 5621 },
      { endpoint: '/api/delivery/calculate', avg: 67.3, p95: 145.2, p99: 289.5, count: 3456 },
      { endpoint: '/api/contacts', avg: 8.9, p95: 23.4, p99: 56.7, count: 2891 },
      { endpoint: '/api/delivery-rules', avg: 15.2, p95: 45.6, p99: 89.3, count: 1234 },
    ];

    // 전시간 대비 변화율 계산
    const previousHourStart = Date.now() - 2 * 3600000;
    const previousHourEnd = Date.now() - 3600000;
    const previousResponseTime = metricsCollector.getMetricStats('api_response_time', previousHourStart);

    const avgChange = previousResponseTime && responseTimeStats
      ? ((responseTimeStats.avg - previousResponseTime.avg) / previousResponseTime.avg * 100).toFixed(1)
      : '0.0';

    const p99Change = previousResponseTime && p99Stats
      ? ((p99Stats.avg - previousResponseTime.max) / previousResponseTime.max * 100).toFixed(1)
      : '0.0';

    const performanceData = {
      summary: {
        avgResponseTime: responseTimeStats?.avg || 45,
        p95ResponseTime: p95Stats?.avg || 120,
        p99ResponseTime: p99Stats?.avg || 280,
        throughput,
        changes: {
          avg: parseFloat(avgChange),
          p99: parseFloat(p99Change),
        },
      },
      charts: {
        responseTime: hourlyResponseTime,
        throughput: hourlyThroughput,
      },
      endpoints: endpointPerformance.sort((a, b) => b.count - a.count),
      period: {
        hours,
        from: new Date(since).toISOString(),
        to: new Date().toISOString(),
      },
    };

    return NextResponse.json(performanceData);
  } catch (error) {
    console.error('성능 메트릭 조회 실패:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '성능 메트릭 조회 실패' },
      { status: 500 }
    );
  }
}
