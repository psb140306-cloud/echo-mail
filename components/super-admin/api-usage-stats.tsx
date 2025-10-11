'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ApiEndpoint {
  endpoint: string;
  method: string;
  requests: number;
  avgResponseTime: number;
  errorRate: number;
}

export function ApiUsageStats() {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApiStats = async () => {
    try {
      const response = await fetch('/api/super-admin/monitoring/api-stats?hours=24');
      if (!response.ok) throw new Error('API 통계 조회 실패');

      const data = await response.json();

      setEndpoints(data.endpoints || []);
      setChartData(data.hourlyStats || []);
    } catch (err) {
      console.error('API 통계 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 초기 로드
    fetchApiStats();

    // 30초마다 업데이트
    const interval = setInterval(fetchApiStats, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>API 엔드포인트 사용량</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {endpoints.map((endpoint, idx) => (
              <div key={idx} className="border-b pb-3 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {endpoint.method}
                    </span>
                    <span className="text-sm font-medium">{endpoint.endpoint}</span>
                  </div>
                  <span className="text-sm font-bold">{endpoint.requests.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>평균 응답: {endpoint.avgResponseTime}ms</span>
                  <span className={endpoint.errorRate > 0.5 ? 'text-red-600' : 'text-green-600'}>
                    에러율: {endpoint.errorRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>시간대별 API 요청 (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="requests" fill="#3b82f6" name="요청 수" />
              <Bar dataKey="errors" fill="#ef4444" name="에러 수" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span>총 요청: {chartData.reduce((sum, d) => sum + d.requests, 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span>총 에러: {chartData.reduce((sum, d) => sum + d.errors, 0).toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
