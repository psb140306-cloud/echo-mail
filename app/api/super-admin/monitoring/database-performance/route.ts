import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super-admin/monitoring/database-performance
 * 데이터베이스 성능 메트릭 조회
 */
export async function GET(request: NextRequest) {
  try {
    const authError = await requireSuperAdmin();
    if (authError) return authError;

    // Mock 쿼리 성능 데이터 (실제로는 PostgreSQL의 pg_stat_statements 사용)
    const queryPerformance = [
      {
        query: 'SELECT * FROM companies WHERE tenant_id = $1',
        avgTime: 12.5,
        execCount: 8934,
        slowestTime: 85.3,
        table: 'companies',
      },
      {
        query: 'SELECT * FROM notification_logs WHERE created_at > $1',
        avgTime: 45.2,
        execCount: 5621,
        slowestTime: 234.7,
        table: 'notification_logs',
      },
      {
        query: 'UPDATE subscriptions SET status = $1 WHERE id = $2',
        avgTime: 8.3,
        execCount: 3456,
        slowestTime: 42.1,
        table: 'subscriptions',
      },
      {
        query: 'INSERT INTO email_logs (tenant_id, subject, body, ...)',
        avgTime: 15.7,
        execCount: 2891,
        slowestTime: 67.8,
        table: 'email_logs',
      },
      {
        query: 'SELECT COUNT(*) FROM tenants WHERE status = $1',
        avgTime: 6.2,
        execCount: 1234,
        slowestTime: 23.4,
        table: 'tenants',
      },
    ];

    // 연결 풀 정보 (Mock)
    const connectionPool = {
      total: 40,
      active: 18,
      idle: 22,
      waiting: 5,
      usage: 45,
    };

    // 캐시 통계 (Mock)
    const cacheStats = {
      hitRate: 92.5,
      hits: 45678,
      misses: 3542,
      evictions: 234,
    };

    // 트랜잭션 통계
    const transactionStats = {
      active: 23,
      waiting: 5,
      locks: 0,
      deadlocks: 0,
    };

    // 테이블 크기 정보 (실제로는 Prisma를 통해 조회)
    try {
      // PostgreSQL 테이블 크기 조회 쿼리
      const tableSizes: any[] = await prisma.$queryRaw`
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
          pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 5
      `;

      const formattedTableSizes = tableSizes.map(t => ({
        name: t.tablename,
        size: t.size,
        sizeBytes: Number(t.size_bytes),
      }));

      return NextResponse.json({
        queries: queryPerformance,
        connectionPool,
        cacheStats,
        transactionStats,
        tableSizes: formattedTableSizes,
        timestamp: new Date().toISOString(),
      });
    } catch (dbError) {
      // DB 쿼리 실패 시 Mock 데이터 반환
      console.warn('데이터베이스 통계 조회 실패, Mock 데이터 사용:', dbError);

      return NextResponse.json({
        queries: queryPerformance,
        connectionPool,
        cacheStats,
        transactionStats,
        tableSizes: [
          { name: 'notification_logs', size: '2.3 GB', sizeBytes: 2300000000 },
          { name: 'email_logs', size: '1.8 GB', sizeBytes: 1800000000 },
          { name: 'usage_records', size: '890 MB', sizeBytes: 890000000 },
          { name: 'companies', size: '340 MB', sizeBytes: 340000000 },
          { name: 'contacts', size: '210 MB', sizeBytes: 210000000 },
        ],
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('데이터베이스 성능 조회 실패:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '데이터베이스 성능 조회 실패' },
      { status: 500 }
    );
  }
}
