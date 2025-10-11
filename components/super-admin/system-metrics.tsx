'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
}

export function SystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 45,
    memory: 62,
    disk: 38,
  });

  useEffect(() => {
    // In a real implementation, fetch actual metrics
    const interval = setInterval(() => {
      setMetrics({
        cpu: Math.floor(Math.random() * 30) + 30,
        memory: Math.floor(Math.random() * 20) + 50,
        disk: Math.floor(Math.random() * 10) + 35,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getProgressColor = (value: number) => {
    if (value < 60) return 'bg-green-600';
    if (value < 80) return 'bg-yellow-600';
    return 'bg-red-600';
  };

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
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>디스크 사용률</span>
              <span>{metrics.disk}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${getProgressColor(metrics.disk)} h-2 rounded-full transition-all`}
                style={{ width: `${metrics.disk}%` }}
              ></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
