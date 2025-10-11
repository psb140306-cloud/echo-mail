'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface ErrorLog {
  id: string;
  timestamp: Date;
  level: 'critical' | 'error' | 'warning' | 'info';
  category: string;
  message: string;
  errorCode?: string;
  tenantId?: string;
  userId?: string;
  stackTrace?: string;
}

interface ErrorLogTableProps {
  filters: {
    level: string;
    category: string;
    period: string;
    search: string;
  };
}

export function ErrorLogTable({ filters }: ErrorLogTableProps) {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        level: filters.level,
        category: filters.category,
        period: filters.period,
        search: filters.search,
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      const response = await fetch(`/api/super-admin/monitoring/error-logs?${params}`);
      if (!response.ok) throw new Error('에러 로그 조회 실패');

      const data = await response.json();
      setLogs(
        data.logs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }))
      );
      setPagination(data.pagination);
    } catch (err) {
      console.error('에러 로그 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchLogs(newPage);
  };

  const getLevelColor = (level: ErrorLog['level']) => {
    switch (level) {
      case 'critical':
        return 'destructive';
      case 'error':
        return 'destructive';
      case 'warning':
        return 'outline';
      case 'info':
        return 'default';
    }
  };

  const getLevelText = (level: ErrorLog['level']) => {
    switch (level) {
      case 'critical':
        return 'CRITICAL';
      case 'error':
        return 'ERROR';
      case 'warning':
        return 'WARNING';
      case 'info':
        return 'INFO';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>에러 로그 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">로그를 불러오는 중...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>에러 로그 목록</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            선택한 필터 조건에 해당하는 에러 로그가 없습니다.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">시간</TableHead>
                  <TableHead className="w-[100px]">레벨</TableHead>
                  <TableHead className="w-[120px]">카테고리</TableHead>
                  <TableHead>메시지</TableHead>
                  <TableHead className="w-[150px]">테넌트</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <>
                    <TableRow key={log.id} className="cursor-pointer hover:bg-gray-50">
                      <TableCell className="font-mono text-xs">
                        {log.timestamp.toLocaleString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getLevelColor(log.level)}>
                          {getLevelText(log.level)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded">
                          {log.category}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{log.message}</span>
                          {log.errorCode && (
                            <span className="text-xs text-gray-500 font-mono">
                              {log.errorCode}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {log.tenantId || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                        >
                          {expandedRow === log.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRow === log.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-gray-50">
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-500">에러 ID:</span>{' '}
                                <span className="font-mono">{log.id}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">사용자 ID:</span>{' '}
                                <span className="font-mono">{log.userId || '-'}</span>
                              </div>
                            </div>
                            {log.stackTrace && (
                              <div>
                                <div className="font-medium text-gray-500 mb-2">스택 트레이스:</div>
                                <pre className="bg-black text-green-400 p-4 rounded-lg text-xs overflow-x-auto font-mono">
                                  {log.stackTrace}
                                </pre>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                상세 보기
                              </Button>
                              <Button size="sm" variant="outline">
                                관련 로그 보기
                              </Button>
                              <Button size="sm" variant="outline">
                                해결됨으로 표시
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                총 {pagination.total.toLocaleString()}개 중 {((pagination.page - 1) * pagination.limit) + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrev}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  이전
                </Button>
                <span className="text-sm text-gray-600">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNext}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  다음
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
