'use client';

import { useEffect, useState } from 'react';
import { HealthStatusCard } from '@/components/super-admin/health-status-card';
import { SystemMetrics } from '@/components/super-admin/system-metrics';
import { ErrorLogs } from '@/components/super-admin/error-logs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  message?: string;
}

interface SystemHealth {
  database: HealthStatus;
  mail: HealthStatus;
  notifications: HealthStatus;
  api: HealthStatus;
  overall: 'healthy' | 'degraded' | 'down';
}

export default function HealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/super-admin/health');
        if (!response.ok) {
          throw new Error('Failed to fetch system health');
        }
        const data = await response.json();
        setHealth(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Health check error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const [uptimeData, setUptimeData] = useState({ hours: 0, minutes: 0, percentage: 99.9 });

  // Fetch uptime data
  useEffect(() => {
    const fetchUptime = async () => {
      try {
        const response = await fetch('/api/super-admin/system-metrics');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.system.uptime) {
            setUptimeData({
              hours: result.data.system.uptime.hours,
              minutes: result.data.system.uptime.minutes,
              percentage: 99.9, // SLA 목표값 (실제 uptime tracking이 필요하면 별도 구현)
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch uptime:', err);
      }
    };

    fetchUptime();
    const interval = setInterval(fetchUptime, 60000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">시스템 헬스</h2>
            <p className="text-gray-500 mt-2">시스템 상태를 실시간으로 모니터링합니다</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">시스템 헬스</h2>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">
              {error || '시스템 상태를 불러올 수 없습니다.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <div className="text-2xl font-bold">
              {uptimeData.hours}h {uptimeData.minutes}m
            </div>
            <p className="text-xs text-gray-500 mt-1">프로세스 가동 시간</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">가동률 (SLA 목표)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{uptimeData.percentage}%</div>
            <p className="text-xs text-gray-500 mt-1">목표 가동률</p>
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
            <p className="text-xs text-gray-500 mt-1">자동 갱신 (30초)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
