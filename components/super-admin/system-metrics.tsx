'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
}

export function SystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/super-admin/system-metrics');
        if (!response.ok) throw new Error('Failed to fetch metrics');

        const result = await response.json();

        if (result.success) {
          setMetrics({
            cpu: result.data.cpu.usage,
            memory: result.data.memory.usagePercent,
            disk: 0, // Serverless 환경에서는 디스크 사용률 의미 없음
          });
        } else {
          throw new Error(result.error || 'Failed to fetch metrics');
        }
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    // 10초마다 갱신
    const interval = setInterval(fetchMetrics, 10000);

    return () => clearInterval(interval);
  }, []);

  const getProgressColor = (value: number) => {
    if (value < 60) return 'bg-green-600';
    if (value < 80) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>시스템 리소스</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>시스템 리소스</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">
            {error || '메트릭을 불러올 수 없습니다.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>시스템 리소스</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>CPU 사용률</span>
              <span>{metrics.cpu}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${getProgressColor(metrics.cpu)} h-2 rounded-full transition-all`}
                style={{ width: `${metrics.cpu}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>메모리 사용률</span>
              <span>{metrics.memory}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${getProgressColor(metrics.memory)} h-2 rounded-full transition-all`}
                style={{ width: `${metrics.memory}%` }}
              ></div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            10초마다 자동 갱신 • Serverless 환경
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
