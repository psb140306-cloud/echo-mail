'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export function PerformanceCharts() {
  const [responseTimeData, setResponseTimeData] = useState<any[]>([]);
  const [throughputData, setThroughputData] = useState<any[]>([]);

  useEffect(() => {
    // Mock data - 실제로는 API에서 가져와야 함
    const mockResponseTime = Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      avg: Math.floor(Math.random() * 50) + 30,
      p95: Math.floor(Math.random() * 80) + 80,
      p99: Math.floor(Math.random() * 150) + 200,
    }));

    const mockThroughput = Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      requests: Math.floor(Math.random() * 1000) + 500,
      success: Math.floor(Math.random() * 950) + 480,
      errors: Math.floor(Math.random() * 50) + 10,
    }));

    setResponseTimeData(mockResponseTime);
    setThroughputData(mockThroughput);
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>응답 시간 추이 (24시간)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="avg" stroke="#3b82f6" name="평균" strokeWidth={2} />
              <Line type="monotone" dataKey="p95" stroke="#f59e0b" name="P95" strokeWidth={2} />
              <Line type="monotone" dataKey="p99" stroke="#ef4444" name="P99" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span>평균: {responseTimeData[responseTimeData.length - 1]?.avg || 0}ms</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded" />
              <span>P95: {responseTimeData[responseTimeData.length - 1]?.p95 || 0}ms</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span>P99: {responseTimeData[responseTimeData.length - 1]?.p99 || 0}ms</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>처리량 및 에러율 (24시간)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={throughputData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="requests"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
                name="총 요청"
              />
              <Area
                type="monotone"
                dataKey="errors"
                stackId="2"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.8}
                name="에러"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">총 요청 (24h):</span>{' '}
              <span className="font-bold">{throughputData.reduce((sum, d) => sum + d.requests, 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-500">총 에러 (24h):</span>{' '}
              <span className="font-bold text-red-600">{throughputData.reduce((sum, d) => sum + d.errors, 0).toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
