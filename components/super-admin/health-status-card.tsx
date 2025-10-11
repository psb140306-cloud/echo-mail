'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HealthStatusCardProps {
  title: string;
  status: 'healthy' | 'degraded' | 'down';
  message?: string;
  responseTime?: number;
}

export function HealthStatusCard({ title, status, message, responseTime }: HealthStatusCardProps) {
  const statusColors = {
    healthy: 'text-green-600',
    degraded: 'text-yellow-600',
    down: 'text-red-600',
  };

  const statusBgColors = {
    healthy: 'bg-green-100',
    degraded: 'bg-yellow-100',
    down: 'bg-red-100',
  };

  const statusLabels = {
    healthy: '정상',
    degraded: '저하',
    down: '중단',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${statusColors[status]}`}>
          {statusLabels[status]}
        </div>
        {message && (
          <p className="text-xs text-gray-500 mt-1">{message}</p>
        )}
        {responseTime !== undefined && (
          <p className="text-xs text-gray-500 mt-1">
            응답 시간: {responseTime}ms
          </p>
        )}
      </CardContent>
    </Card>
  );
}
