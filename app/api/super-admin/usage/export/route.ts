import { NextRequest, NextResponse } from 'next/server';
import { superAdminGuard } from '@/lib/api/super-admin-guard';

export async function GET(request: NextRequest) {
  try {
    const guardResult = await superAdminGuard();
    if (guardResult.error) {
      return guardResult.error;
    }

    const { supabase } = guardResult;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    let query = supabase
      .from('usage_records')
      .select(`
        *,
        tenants (
          name,
          slug
        )
      `)
      .order('period_start', { ascending: false });

    if (startDate) {
      query = query.gte('period_start', startDate);
    }
    if (endDate) {
      query = query.lte('period_end', endDate);
    }

    const { data: usageRecords, error } = await query;

    if (error) {
      throw error;
    }

    // Convert to CSV
    const csvHeader = 'Tenant,Period Start,Period End,Email Count,Notification Count,API Calls,Storage Used (MB)\n';
    const csvRows = usageRecords?.map((record) => {
      return [
        record.tenants?.name || 'N/A',
        new Date(record.period_start).toLocaleDateString('ko-KR'),
        new Date(record.period_end).toLocaleDateString('ko-KR'),
        record.email_count || 0,
        record.notification_count || 0,
        record.api_calls || 0,
        record.storage_used ? (record.storage_used / (1024 * 1024)).toFixed(2) : 0,
      ].join(',');
    }).join('\n') || '';

    const csv = csvHeader + csvRows;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="usage-report-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting usage data:', error);
    return NextResponse.json(
      { error: 'Failed to export usage data' },
      { status: 500 }
    );
  }
}
