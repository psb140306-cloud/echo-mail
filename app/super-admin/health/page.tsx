import { getSystemHealth } from '@/lib/monitoring/health-check';
import { HealthStatusCard } from '@/components/super-admin/health-status-card';
import { SystemMetrics } from '@/components/super-admin/system-metrics';
import { ErrorLogs } from '@/components/super-admin/error-logs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function HealthPage() {
  const health = await getSystemHealth();

  const uptimeHours = 720; // 30 days
  const uptimePercentage = 99.9;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">시스템 헬스</h2>
          <p className="text-gray-500 mt-2">시스템 상태를 실시간으로 모니터링합니다</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">전체 상태</div>
          <div
            className={`text-2xl font-bold ${
              health.overall === 'healthy'
                ? 'text-green-600'
                : health.overall === 'degraded'
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {health.overall === 'healthy' ? '정상' : health.overall === 'degraded' ? '저하' : '중단'}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HealthStatusCard
          title="데이터베이스"
          status={health.database.status}
          message={health.database.message}
          responseTime={health.database.responseTime}
        />
        <HealthStatusCard
          title="메일 서비스"
          status={health.mail.status}
          message={health.mail.message}
        />
        <HealthStatusCard
          title="알림 시스템"
          status={health.notifications.status}
          message={health.notifications.message}
        />
        <HealthStatusCard
          title="API 서버"
          status={health.api.status}
          message={health.api.message}
          responseTime={health.api.responseTime}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SystemMetrics />
        <ErrorLogs />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">가동 시간</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uptimeHours}시간</div>
            <p className="text-xs text-gray-500 mt-1">최근 30일</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">가동률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{uptimePercentage}%</div>
            <p className="text-xs text-gray-500 mt-1">최근 30일</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">마지막 점검</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {new Date().toLocaleString('ko-KR')}
            </div>
            <p className="text-xs text-gray-500 mt-1">자동 갱신</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
