'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { Activity, Clock, Zap, TrendingDown, TrendingUp } from 'lucide-react';

// Recharts를 사용하는 컴포넌트는 dynamic import로 처리
const PerformanceCharts = dynamic(
  () => import('@/components/super-admin/performance-charts').then((mod) => ({ default: mod.PerformanceCharts })),
  { ssr: false }
);

const DatabasePerformance = dynamic(
  () => import('@/components/super-admin/database-performance').then((mod) => ({ default: mod.DatabasePerformance })),
  { ssr: false }
);

interface PerformanceSummary {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  changes: {
    avg: number;
    p99: number;
  };
}

export default function PerformancePage() {
  const [summary, setSummary] = useState<PerformanceSummary>({
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    throughput: 0,
    changes: { avg: 0, p99: 0 },
  });

  useEffect(() => {
    fetchPerformanceSummary();
    const interval = setInterval(fetchPerformanceSummary, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, []);

  const fetchPerformanceSummary = async () => {
    try {
      const response = await fetch('/api/super-admin/monitoring/performance?hours=1');
      if (!response.ok) throw new Error('성능 메트릭 조회 실패');

      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      console.error('성능 메트릭 로드 실패:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">성능 메트릭</h2>
        <p className="text-gray-500 mt-2">시스템 성능 지표를 실시간으로 모니터링합니다</p>
      </div>

      {/* 성능 요약 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              평균 응답 시간
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(summary.avgResponseTime)}ms</div>
            <p className={`text-xs mt-1 flex items-center gap-1 ${summary.changes.avg < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.changes.avg < 0 ? (
                <>
                  <TrendingDown className="w-3 h-3" />
                  ↓ {Math.abs(summary.changes.avg)}%
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3" />
                  ↑ {summary.changes.avg}%
                </>
              )}
              {' '}from last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              P95 응답 시간
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(summary.p95ResponseTime)}ms</div>
            <p className="text-xs text-gray-500 mt-1">목표: &lt; 200ms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              P99 응답 시간
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.p99ResponseTime > 500 ? 'text-red-600' : summary.p99ResponseTime > 300 ? 'text-yellow-600' : ''}`}>
              {Math.round(summary.p99ResponseTime)}ms
            </div>
            <p className={`text-xs mt-1 flex items-center gap-1 ${summary.changes.p99 < 0 ? 'text-green-600' : 'text-yellow-600'}`}>
              {summary.changes.p99 < 0 ? (
                <>
                  <TrendingDown className="w-3 h-3" />
                  ↓ {Math.abs(summary.changes.p99)}%
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3" />
                  ↑ {summary.changes.p99}%
                </>
              )}
              {' '}from last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">처리량</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.throughput >= 1000
                ? `${(summary.throughput / 1000).toFixed(1)}K`
                : summary.throughput}
              {' '}
              <span className="text-sm font-normal text-gray-500">/min</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">requests per minute</p>
          </CardContent>
        </Card>
      </div>

      {/* 성능 차트 */}
      <PerformanceCharts />

      {/* 데이터베이스 성능 */}
      <DatabasePerformance />
    </div>
  );
}
