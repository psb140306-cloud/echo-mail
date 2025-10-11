import { NextRequest, NextResponse } from 'next/server';
import { superAdminGuard } from '@/lib/api/super-admin-guard';
import { getSystemHealth } from '@/lib/monitoring/health-check';

export async function GET(request: NextRequest) {
  try {
    const guardResult = await superAdminGuard();
    if (guardResult.error) {
      return guardResult.error;
    }

    const health = await getSystemHealth();

    return NextResponse.json(health);
  } catch (error) {
    console.error('Error checking system health:', error);
    return NextResponse.json(
      { error: 'Failed to check system health' },
      { status: 500 }
    );
  }
}
