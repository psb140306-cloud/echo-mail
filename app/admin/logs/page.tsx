'use client';

export const dynamic = 'force-dynamic';

import { ErrorLogTable } from '@/components/super-admin/error-log-table';
import { LogFilter } from '@/components/super-admin/log-filter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, AlertOctagon, TrendingDown, TrendingUp } from 'lucide-react';

interface ErrorStats {
  summary: {
    total: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
    errorRate: number;
    change: number;
  };
}

export default function LogsPage() {
  const [stats, setStats] = useState<ErrorStats['summary']>({
    total: 0,
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
    errorRate: 0,
    change: 0,
  });
  const [filters, setFilters] = useState({
    level: 'all',
    category: 'all',
    period: '24h',
    search: '',
  });

  useEffect(() => {
    fetchErrorStats();
  }, []);

  const fetchErrorStats = async () => {
    try {
      const response = await fetch('/api/super-admin/monitoring/error-stats?period=24h');
      if (!response.ok) throw new Error('에러 통계 조회 실패');

      const data = await response.json();
      setStats(data.summary);
    } catch (err) {
      console.error('에러 통계 로드 실패:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">에러 로그</h2>
        <p className="text-gray-500 mt-2">시스템 에러 로그를 조회하고 분석합니다</p>
      </div>

      {/* 에러 통계 요약 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" />
              총 에러 (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            <p className={`text-xs mt-1 flex items-center gap-1 ${stats.change < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.change < 0 ? (
                <>
                  <TrendingDown className="w-3 h-3" />
                  ↓ {Math.abs(stats.change)}%
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3" />
                  ↑ {stats.change}%
                </>
              )}
              {' '}from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Critical 에러
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-xs text-gray-500 mt-1">즉시 조치 필요</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Warning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
            <p className="text-xs text-gray-500 mt-1">모니터링 필요</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">에러율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.errorRate > 1 ? 'text-red-600' : stats.errorRate > 0.5 ? 'text-yellow-600' : 'text-green-600'}`}>
              {stats.errorRate.toFixed(2)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">최근 1시간</p>
          </CardContent>
        </Card>
      </div>

      {/* 필터 */}
      <LogFilter filters={filters} setFilters={setFilters} />

      {/* 에러 로그 테이블 */}
      <ErrorLogTable filters={filters} />
    </div>
  );
}
