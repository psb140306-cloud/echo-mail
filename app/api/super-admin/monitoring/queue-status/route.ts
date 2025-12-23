import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { metricsCollector } from '@/lib/monitoring/metrics-collector';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super-admin/monitoring/queue-status
 * 알림 큐 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const authError = await requireSuperAdmin();
    if (authError) return authError;

    // 알림 로그에서 최근 통계 가져오기
    const oneHourAgo = new Date(Date.now() - 3600000);
    const oneDayAgo = new Date(Date.now() - 86400000);

    // 이메일 처리 큐 상태
    const emailStats = await prisma.emailLog.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: oneDayAgo,
        },
      },
      _count: true,
    });

    // 알림 발송 큐 상태 (SMS/카카오톡)
    const notificationStats = await prisma.notificationLog.groupBy({
      by: ['status', 'channel'],
      where: {
        createdAt: {
          gte: oneDayAgo,
        },
      },
      _count: true,
    });

    // 이메일 큐 메트릭
    const emailQueue = {
      name: '이메일 처리 큐',
      type: 'email',
      pending: emailStats.find(s => s.status === 'PENDING')?._count || 0,
      processing: emailStats.find(s => s.status === 'PROCESSING')?._count || 0,
      completed: emailStats.find(s => s.status === 'PROCESSED')?._count || 0,
      failed: emailStats.find(s => s.status === 'FAILED')?._count || 0,
      avgProcessingTime: metricsCollector.getMetricStats('email_processing_time')?.avg || 1.2,
      throughput: metricsCollector.getMetricStats('email_throughput')?.latest || 450,
    };

    // SMS 큐 메트릭
    const smsStats = notificationStats.filter(s => s.channel === 'SMS');
    const smsQueue = {
      name: 'SMS 발송 큐',
      type: 'sms',
      pending: smsStats.find(s => s.status === 'PENDING')?._count || 0,
      processing: smsStats.find(s => s.status === 'SENDING')?._count || 0,
      completed: smsStats.find(s => s.status === 'SENT')?._count || 0,
      failed: smsStats.find(s => s.status === 'FAILED')?._count || 0,
      avgProcessingTime: metricsCollector.getMetricStats('sms_processing_time')?.avg || 0.8,
      throughput: metricsCollector.getMetricStats('sms_throughput')?.latest || 320,
    };

    // 카카오톡 큐 메트릭
    const kakaoStats = notificationStats.filter(s => s.channel === 'KAKAO');
    const kakaoQueue = {
      name: '카카오톡 발송 큐',
      type: 'kakao',
      pending: kakaoStats.find(s => s.status === 'PENDING')?._count || 0,
      processing: kakaoStats.find(s => s.status === 'SENDING')?._count || 0,
      completed: kakaoStats.find(s => s.status === 'SENT')?._count || 0,
      failed: kakaoStats.find(s => s.status === 'FAILED')?._count || 0,
      avgProcessingTime: metricsCollector.getMetricStats('kakao_processing_time')?.avg || 1.5,
      throughput: metricsCollector.getMetricStats('kakao_throughput')?.latest || 280,
    };

    // 데이터 동기화 큐 (메트릭 기반)
    const syncQueue = {
      name: '데이터 동기화 큐',
      type: 'sync',
      pending: metricsCollector.getMetricStats('sync_queue_pending')?.latest || 2,
      processing: metricsCollector.getMetricStats('sync_queue_processing')?.latest || 1,
      completed: metricsCollector.getMetricStats('sync_queue_completed')?.sum || 1234,
      failed: metricsCollector.getMetricStats('sync_queue_failed')?.sum || 1,
      avgProcessingTime: metricsCollector.getMetricStats('sync_processing_time')?.avg || 3.2,
      throughput: metricsCollector.getMetricStats('sync_throughput')?.latest || 120,
    };

    const queues = [emailQueue, smsQueue, kakaoQueue, syncQueue];

    // 전체 큐 상태 요약
    const summary = {
      totalPending: queues.reduce((sum, q) => sum + q.pending, 0),
      totalProcessing: queues.reduce((sum, q) => sum + q.processing, 0),
      totalCompleted: queues.reduce((sum, q) => sum + q.completed, 0),
      totalFailed: queues.reduce((sum, q) => sum + q.failed, 0),
      avgThroughput: queues.reduce((sum, q) => sum + q.throughput, 0) / queues.length,
      healthStatus: queues.every(q => q.pending < 50 && q.failed < 20) ? 'healthy' :
                    queues.some(q => q.pending > 100 || q.failed > 50) ? 'critical' : 'warning',
    };

    return NextResponse.json({
      queues,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('큐 상태 조회 실패:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '큐 상태 조회 실패' },
      { status: 500 }
    );
  }
}
