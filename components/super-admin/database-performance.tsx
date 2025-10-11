'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface QueryPerformance {
  query: string;
  avgTime: number;
  execCount: number;
  slowestTime: number;
  table: string;
}

export function DatabasePerformance() {
  const [queries, setQueries] = useState<QueryPerformance[]>([]);
  const [dbMetrics, setDbMetrics] = useState({
    connectionPoolUsage: 0,
    cacheHitRate: 0,
    activeConnections: 0,
    totalConnections: 0,
  });

  useEffect(() => {
    // Mock data - 실제로는 API에서 가져와야 함
    const mockQueries: QueryPerformance[] = [
      {
        query: 'SELECT * FROM companies WHERE tenant_id = ?',
        avgTime: 12.5,
        execCount: 8934,
        slowestTime: 85.3,
        table: 'companies',
      },
      {
        query: 'SELECT * FROM notification_logs WHERE created_at > ?',
        avgTime: 45.2,
        execCount: 5621,
        slowestTime: 234.7,
        table: 'notification_logs',
      },
      {
        query: 'UPDATE subscriptions SET status = ? WHERE id = ?',
        avgTime: 8.3,
        execCount: 3456,
        slowestTime: 42.1,
        table: 'subscriptions',
      },
      {
        query: 'INSERT INTO email_logs (tenant_id, subject, ...)',
        avgTime: 15.7,
        execCount: 2891,
        slowestTime: 67.8,
        table: 'email_logs',
      },
      {
        query: 'SELECT COUNT(*) FROM tenants WHERE status = ?',
        avgTime: 6.2,
        execCount: 1234,
        slowestTime: 23.4,
        table: 'tenants',
      },
    ];

    setQueries(mockQueries);
    setDbMetrics({
      connectionPoolUsage: 45,
      cacheHitRate: 92.5,
      activeConnections: 18,
      totalConnections: 40,
    });
  }, []);

  const getPerformanceColor = (avgTime: number) => {
    if (avgTime > 100) return 'text-red-600';
    if (avgTime > 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>쿼리 성능 분석</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>쿼리</TableHead>
                <TableHead className="text-right">평균 시간</TableHead>
                <TableHead className="text-right">실행 횟수</TableHead>
                <TableHead className="text-right">최대 시간</TableHead>
                <TableHead>테이블</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.map((query, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs max-w-xs truncate">
                    {query.query}
                  </TableCell>
                  <TableCell className={`text-right font-bold ${getPerformanceColor(query.avgTime)}`}>
                    {query.avgTime.toFixed(1)}ms
                  </TableCell>
                  <TableCell className="text-right">
                    {query.execCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-gray-500">
                    {query.slowestTime.toFixed(1)}ms
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{query.table}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>데이터베이스 메트릭</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">연결 풀 사용률</span>
              <span className="text-sm font-bold">{dbMetrics.connectionPoolUsage}%</span>
            </div>
            <Progress value={dbMetrics.connectionPoolUsage} className="bg-blue-500" />
            <p className="text-xs text-gray-500 mt-1">
              {dbMetrics.activeConnections} / {dbMetrics.totalConnections} 연결 활성
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">캐시 적중률</span>
              <span className="text-sm font-bold text-green-600">{dbMetrics.cacheHitRate}%</span>
            </div>
            <Progress value={dbMetrics.cacheHitRate} className="bg-green-500" />
            <p className="text-xs text-gray-500 mt-1">
              목표: &gt; 90%
            </p>
          </div>

          <div className="pt-4 border-t space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">활성 트랜잭션</span>
              <span className="font-medium">23</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">대기 중인 쿼리</span>
              <span className="font-medium">5</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">잠금 대기</span>
              <span className="font-medium">0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">데드락 (24h)</span>
              <span className="font-medium text-green-600">0</span>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">테이블 크기 (상위 5개)</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">notification_logs</span>
                <span className="font-medium">2.3 GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">email_logs</span>
                <span className="font-medium">1.8 GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">usage_records</span>
                <span className="font-medium">890 MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">companies</span>
                <span className="font-medium">340 MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">contacts</span>
                <span className="font-medium">210 MB</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
