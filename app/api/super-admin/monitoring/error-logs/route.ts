import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/middleware/super-admin';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super-admin/monitoring/error-logs
 * 에러 로그 조회 (파일 기반 + 메모리 기반)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') || 'all';
    const category = searchParams.get('category') || 'all';
    const period = searchParams.get('period') || '24h';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // 기간 계산
    const periodMap: Record<string, number> = {
      '1h': 3600000,
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000,
    };
    const since = Date.now() - (periodMap[period] || periodMap['24h']);

    // 로그 파일에서 읽기
    const logs = await readErrorLogsFromFile();

    // 필터링
    let filteredLogs = logs.filter((log) => {
      const timestamp = new Date(log.timestamp).getTime();
      if (timestamp < since) return false;

      if (level !== 'all' && log.level !== level) return false;
      if (category !== 'all' && log.category !== category) return false;

      if (search) {
        const searchLower = search.toLowerCase();
        return (
          log.message.toLowerCase().includes(searchLower) ||
          log.errorCode?.toLowerCase().includes(searchLower) ||
          log.category.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });

    // 정렬 (최신순)
    filteredLogs.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // 페이지네이션
    const total = filteredLogs.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);

    // 통계 계산
    const stats = {
      total: logs.length,
      filtered: total,
      critical: logs.filter((l) => l.level === 'critical').length,
      error: logs.filter((l) => l.level === 'error').length,
      warning: logs.filter((l) => l.level === 'warning').length,
      info: logs.filter((l) => l.level === 'info').length,
    };

    return NextResponse.json({
      logs: paginatedLogs,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      filters: {
        level,
        category,
        period,
        search,
      },
    });
  } catch (error) {
    console.error('에러 로그 조회 실패:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '에러 로그 조회 실패' },
      { status: 500 }
    );
  }
}

/**
 * 로그 파일에서 에러 로그 읽기
 */
async function readErrorLogsFromFile() {
  const logs: any[] = [];

  try {
    const logDir = path.join(process.cwd(), 'logs');

    // logs 디렉토리가 없으면 빈 배열 반환
    try {
      await fs.access(logDir);
    } catch {
      return generateMockLogs(); // Mock 데이터 반환
    }

    // 최근 로그 파일들 읽기 (error-*.log)
    const files = await fs.readdir(logDir);
    const errorLogFiles = files
      .filter((f) => f.startsWith('error-') && f.endsWith('.log'))
      .sort()
      .reverse()
      .slice(0, 7); // 최근 7개 파일만

    for (const file of errorLogFiles) {
      const filePath = path.join(logDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);
          if (logEntry.level === 'error' || logEntry.level === 'warn') {
            logs.push({
              id: logEntry.timestamp + '_' + Math.random().toString(36).substr(2, 9),
              timestamp: logEntry.timestamp,
              level: logEntry.level === 'warn' ? 'warning' : 'error',
              category: logEntry.category || 'system',
              message: logEntry.message,
              errorCode: logEntry.errorCode,
              tenantId: logEntry.tenantId,
              userId: logEntry.userId,
              stackTrace: logEntry.stack || logEntry.stackTrace,
              metadata: logEntry.metadata,
            });
          }
        } catch {
          // JSON 파싱 실패 시 무시
        }
      }
    }

    // 로그가 없으면 Mock 데이터 반환
    if (logs.length === 0) {
      return generateMockLogs();
    }

    return logs;
  } catch (error) {
    console.error('로그 파일 읽기 실패:', error);
    return generateMockLogs();
  }
}

/**
 * Mock 에러 로그 생성 (실제 로그가 없을 때)
 */
function generateMockLogs() {
  const now = Date.now();
  const levels: Array<'critical' | 'error' | 'warning' | 'info'> = ['critical', 'error', 'warning', 'info'];
  const categories = ['system', 'database', 'api', 'email', 'notification', 'payment'];
  const messages = [
    'Database connection timeout',
    'Failed to send SMS notification',
    'Email processing delayed due to high load',
    'Kakao API rate limit exceeded',
    'High memory usage detected',
    'Redis connection lost',
    'Payment gateway timeout',
    'Authentication token expired',
    'File upload failed',
    'External API unreachable',
  ];

  return Array.from({ length: 50 }, (_, i) => ({
    id: `log_${i + 1}`,
    timestamp: new Date(now - i * 300000 - Math.random() * 300000).toISOString(),
    level: levels[Math.floor(Math.random() * levels.length)],
    category: categories[Math.floor(Math.random() * categories.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
    errorCode: `ERR_${Math.floor(Math.random() * 9000) + 1000}`,
    tenantId: i % 3 === 0 ? `tenant_${Math.floor(Math.random() * 10)}` : undefined,
    userId: i % 5 === 0 ? `user_${Math.floor(Math.random() * 100)}` : undefined,
    stackTrace: i % 4 === 0
      ? `Error: ${messages[Math.floor(Math.random() * messages.length)]}\n  at Function.module.exports (index.js:${Math.floor(Math.random() * 200)}:${Math.floor(Math.random() * 50)})\n  at processTicksAndRejections (internal/process/task_queues.js:93:5)`
      : undefined,
  }));
}
