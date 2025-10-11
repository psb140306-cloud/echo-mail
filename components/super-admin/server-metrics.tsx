'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    in: number;
    out: number;
  };
}

export function ServerMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: { in: 0, out: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/super-admin/monitoring/metrics');
      if (!response.ok) throw new Error('메트릭 조회 실패');

      const data = await response.json();

      setMetrics({
        cpu: data.system.cpu.usage || 0,
        memory: data.system.memory.usagePercent || 0,
        disk: 45.8, // TODO: 실제 디스크 사용률 구현 필요
        network: {
          in: data.system.network.in / 1024 / 1024 || 0, // bytes to MB
          out: data.system.network.out / 1024 / 1024 || 0,
        },
      });
      setError(null);
    } catch (err) {
      console.error('메트릭 로드 실패:', err);
      setError(err instanceof Error ? err.message : '메트릭 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 초기 로드
    fetchMetrics();

    // 5초마다 업데이트
    const interval = setInterval(fetchMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  const getCpuColor = (value: number) => {
    if (value > 80) return 'bg-red-500';
    if (value > 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getMemoryColor = (value: number) => {
    if (value > 85) return 'bg-red-500';
    if (value > 70) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>서버 리소스</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">CPU 사용률</span>
              <span className="text-sm font-bold">{metrics.cpu.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.cpu} className={getCpuColor(metrics.cpu)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">메모리 사용률</span>
              <span className="text-sm font-bold">{metrics.memory.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.memory} className={getMemoryColor(metrics.memory)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">디스크 사용률</span>
              <span className="text-sm font-bold">{metrics.disk.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.disk} className="bg-purple-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>네트워크 트래픽</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">인바운드</span>
              <span className="text-sm font-bold">{metrics.network.in.toFixed(1)} MB/s</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (metrics.network.in / 2000) * 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">아웃바운드</span>
              <span className="text-sm font-bold">{metrics.network.out.toFixed(1)} MB/s</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (metrics.network.out / 2000) * 100)}%` }}
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="text-sm text-gray-500">
              <div className="flex justify-between mb-1">
                <span>총 인바운드 (24h)</span>
                <span className="font-medium">142.3 GB</span>
              </div>
              <div className="flex justify-between">
                <span>총 아웃바운드 (24h)</span>
                <span className="font-medium">98.7 GB</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
