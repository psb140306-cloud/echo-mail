import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { getSystemHealth } from '@/lib/monitoring/health-check';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 슈퍼어드민 권한 확인
    const authError = await requireSuperAdmin();
    if (authError) return authError;

    const health = await getSystemHealth();

    return NextResponse.json(health);
  } catch (error) {
    console.error('[Super Admin Health API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check system health',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
