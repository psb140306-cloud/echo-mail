import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UsageChart } from '@/components/super-admin/usage-chart';
import { UsageExportButton } from '@/components/super-admin/usage-export-button';

export default async function UsagePage() {
  const supabase = createServerClient();

  const { data: usageStats } = await supabase
    .from('usage_records')
    .select(`
      *,
      tenants (
        name,
        slug
      )
    `)
    .gte('period_start', new Date(new Date().setDate(1)).toISOString())
    .order('email_count', { ascending: false });

  // Get last 6 months data for trend chart
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: trendData } = await supabase
    .from('usage_records')
    .select('*')
    .gte('period_start', sixMonthsAgo.toISOString())
    .order('period_start', { ascending: true });

  // Aggregate by month
  const monthlyData = trendData?.reduce((acc: any[], record) => {
    const month = new Date(record.period_start).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
    });
    const existing = acc.find((item) => item.name === month);
    if (existing) {
      existing.email_count += record.email_count || 0;
      existing.notification_count += record.notification_count || 0;
      existing.api_calls += record.api_calls || 0;
    } else {
      acc.push({
        name: month,
        email_count: record.email_count || 0,
        notification_count: record.notification_count || 0,
        api_calls: record.api_calls || 0,
      });
    }
    return acc;
  }, []) || [];

  // Top 5 tenants by email count for pie chart
  const topTenants = usageStats?.slice(0, 5).map((record) => ({
    name: record.tenants?.name || 'N/A',
    value: record.email_count || 0,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">사용량 통계</h2>
          <p className="text-gray-500 mt-2">테넌트별 사용량을 확인합니다</p>
        </div>
        <UsageExportButton />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">총 이메일 처리</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageStats?.reduce((sum, record) => sum + (record.email_count || 0), 0) || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">이번 달</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">총 알림 발송</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageStats?.reduce((sum, record) => sum + (record.notification_count || 0), 0) || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">이번 달</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">총 API 호출</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageStats?.reduce((sum, record) => sum + (record.api_calls || 0), 0) || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">이번 달</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <UsageChart
          data={monthlyData}
          type="line"
          title="월별 사용량 추이 (최근 6개월)"
          xAxisKey="name"
        />
        <UsageChart
          data={topTenants}
          type="pie"
          title="테넌트별 이메일 처리 비율 (상위 5)"
          dataKey="value"
        />
      </div>

      <UsageChart
        data={usageStats?.slice(0, 10).map((record) => ({
          name: record.tenants?.name || 'N/A',
          email_count: record.email_count || 0,
          notification_count: record.notification_count || 0,
          api_calls: record.api_calls || 0,
        })) || []}
        type="bar"
        title="테넌트별 사용량 비교 (상위 10)"
        xAxisKey="name"
      />

      <Card>
        <CardHeader>
          <CardTitle>테넌트별 사용량 상세</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">테넌트</th>
                  <th className="text-right p-2">이메일</th>
                  <th className="text-right p-2">알림</th>
                  <th className="text-right p-2">API 호출</th>
                  <th className="text-right p-2">스토리지 (MB)</th>
                </tr>
              </thead>
              <tbody>
                {usageStats?.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{record.tenants?.name || 'N/A'}</td>
                    <td className="p-2 text-right">{record.email_count || 0}</td>
                    <td className="p-2 text-right">{record.notification_count || 0}</td>
                    <td className="p-2 text-right">{record.api_calls || 0}</td>
                    <td className="p-2 text-right">
                      {record.storage_used ? (record.storage_used / (1024 * 1024)).toFixed(2) : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
