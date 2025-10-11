'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';

interface QueueStatus {
  name: string;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
  throughput: number;
}

export function QueueMonitor() {
  const [queues, setQueues] = useState<QueueStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/super-admin/monitoring/queue-status');
      if (!response.ok) throw new Error('큐 상태 조회 실패');

      const data = await response.json();
      setQueues(data.queues || []);
    } catch (err) {
      console.error('큐 상태 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 초기 로드
    fetchQueueStatus();

    // 5초마다 업데이트
    const interval = setInterval(fetchQueueStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const getQueueHealth = (queue: QueueStatus) => {
    const total = queue.pending + queue.processing + queue.failed;
    if (queue.pending > 100 || queue.failed > 50) return 'critical';
    if (queue.pending > 50 || queue.failed > 20) return 'warning';
    return 'healthy';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>알림 큐 상태</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {queues.map((queue, idx) => {
            const health = getQueueHealth(queue);
            const total = queue.pending + queue.processing + queue.completed + queue.failed;
            const successRate = total > 0 ? ((queue.completed / total) * 100).toFixed(1) : '0';

            return (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{queue.name}</h3>
                    <Badge
                      variant={health === 'critical' ? 'destructive' : health === 'warning' ? 'outline' : 'default'}
                      className={
                        health === 'healthy'
                          ? 'bg-green-100 text-green-700 hover:bg-green-100'
                          : health === 'warning'
                          ? 'border-yellow-500 text-yellow-700'
                          : ''
                      }
                    >
                      {health === 'critical' ? '위험' : health === 'warning' ? '주의' : '정상'}
                    </Badge>
                  </div>
                  <span className="text-sm text-gray-500">{queue.throughput} jobs/min</span>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-gray-500">대기 중</div>
                    <div className="text-lg font-bold text-blue-600">{queue.pending}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">처리 중</div>
                    <div className="text-lg font-bold text-yellow-600">{queue.processing}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">완료</div>
                    <div className="text-lg font-bold text-green-600">{queue.completed.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">실패</div>
                    <div className="text-lg font-bold text-red-600">{queue.failed}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">성공률</span>
                    <span className="font-medium">{successRate}%</span>
                  </div>
                  <Progress value={parseFloat(successRate)} className="bg-green-500" />

                  <div className="flex items-center justify-between text-sm text-gray-500 pt-1">
                    <span>평균 처리 시간: {queue.avgProcessingTime}s</span>
                    <span>처리량: {queue.throughput} jobs/min</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
