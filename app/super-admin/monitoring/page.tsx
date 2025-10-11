'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServerMetrics } from '@/components/super-admin/server-metrics';
import { ApiUsageStats } from '@/components/super-admin/api-usage-stats';
import { QueueMonitor } from '@/components/super-admin/queue-monitor';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { Activity, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

interface SystemOverview {
  uptime: number;
  activeConnections: number;
  requestRate: number;
  avgResponseTime: number;
  errorRate: number;
  status: 'healthy' | 'degraded' | 'critical';
}

export default function MonitoringPage() {
  const [overview, setOverview] = useState<SystemOverview>({
    uptime: 0,
    activeConnections: 0,
    requestRate: 0,
    avgResponseTime: 0,
    errorRate: 0,
    status: 'healthy',
  });

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const response = await fetch('/api/super-admin/monitoring/metrics');
        if (!response.ok) throw new Error('시스템 개요 조회 실패');

        const data = await response.json();

        setOverview({
          uptime: data.system.uptime.process || 0,
          activeConnections: 247, // TODO: 실제 연결 수 추가 필요
          requestRate: Math.round(data.api.totalRequests / 60) || 0,
          avgResponseTime: Math.round(data.api.avgResponseTime) || 0,
          errorRate: data.api.totalRequests > 0
            ? parseFloat(((data.api.errorCount / data.api.totalRequests) * 100).toFixed(2))
            : 0,
          status: data.api.errorCount / data.api.totalRequests > 0.05 ? 'critical' :
                  data.system.cpu.usage > 80 || data.system.memory.usagePercent > 85 ? 'degraded' : 'healthy',
        });
      } catch (err) {
        console.error('시스템 개요 로드 실패:', err);
      }
    };

    fetchOverview();
    const interval = setInterval(fetchOverview, 10000); // 10초마다 업데이트

    return () => clearInterval(interval);
  }, []);

  const uptimeHours = Math.floor(overview.uptime / 3600);
  const uptimeMinutes = Math.floor((overview.uptime % 3600) / 60);

  const getStatusBadge = () => {
    switch (overview.status) {
      case 'critical':
        return <Badge variant="destructive">시스템 위험</Badge>;
      case 'degraded':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700">성능 저하</Badge>;
      default:
        return <Badge variant="outline" className="text-green-600 border-green-600">시스템 정상</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">시스템 모니터링</h2>
          <p className="text-gray-500 mt-2">서버 상태, API 사용량, 큐 상태를 실시간으로 모니터링합니다</p>
        </div>
        {getStatusBadge()}
      </div>

      {/* 시스템 개요 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              시스템 가동 시간
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {uptimeHours}h {uptimeMinutes}m
            </div>
            <p className="text-xs text-gray-500 mt-1">
              마지막 재시작: {new Date(Date.now() - overview.uptime * 1000).toLocaleString('ko-KR')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              활성 연결
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.activeConnections}</div>
            <p className="text-xs text-gray-500 mt-1">테넌트별 활성 세션</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              요청 처리율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.requestRate.toLocaleString()} <span className="text-sm font-normal text-gray-500">/min</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">평균 응답 시간: {overview.avgResponseTime}ms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              에러율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overview.errorRate > 1 ? 'text-red-600' : overview.errorRate > 0.5 ? 'text-yellow-600' : 'text-green-600'}`}>
              {overview.errorRate.toFixed(2)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">최근 1시간</p>
          </CardContent>
        </Card>
      </div>

      {/* 서버 메트릭 */}
      <ServerMetrics />

      {/* API 사용량 통계 */}
      <ApiUsageStats />

      {/* 알림 큐 모니터링 */}
      <QueueMonitor />
    </div>
  );
}
