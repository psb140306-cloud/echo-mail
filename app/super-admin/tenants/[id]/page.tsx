import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TenantActions } from '@/components/super-admin/tenant-actions';

interface TenantDetailPageProps {
  params: {
    id: string;
  };
}

export default async function TenantDetailPage({ params }: TenantDetailPageProps) {
  const supabase = createServerClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select(`
      *,
      subscriptions (
        id,
        plan_id,
        status,
        current_period_start,
        current_period_end,
        price_per_month
      )
    `)
    .eq('id', params.id)
    .single();

  if (!tenant) {
    notFound();
  }

  // Get tenant members
  const { data: members } = await supabase
    .from('tenant_members')
    .select(`
      *,
      profiles (
        email,
        full_name
      )
    `)
    .eq('tenant_id', params.id);

  // Get usage records
  const { data: usageRecords } = await supabase
    .from('usage_records')
    .select('*')
    .eq('tenant_id', params.id)
    .order('period_start', { ascending: false })
    .limit(12);

  const subscription = tenant.subscriptions?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/super-admin/tenants"
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← 테넌트 목록으로
          </Link>
          <h2 className="text-3xl font-bold tracking-tight">{tenant.name}</h2>
          <p className="text-gray-500 mt-2">테넌트 상세 정보</p>
        </div>
        <TenantActions tenantId={tenant.id} currentStatus={tenant.status} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">테넌트 ID</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-mono">{tenant.id}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">슬러그</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-mono">{tenant.slug}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">상태</CardTitle>
          </CardHeader>
          <CardContent>
            <span
              className={`px-2 py-1 rounded-full text-xs ${
                tenant.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {tenant.status}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>구독 정보</CardTitle>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">플랜</span>
                  <span className="text-sm font-medium">{subscription.plan_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">상태</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      subscription.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : subscription.status === 'trialing'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {subscription.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">월 요금</span>
                  <span className="text-sm font-medium">
                    {subscription.price_per_month?.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">갱신일</span>
                  <span className="text-sm font-medium">
                    {subscription.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString('ko-KR')
                      : 'N/A'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">구독 정보 없음</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>테넌트 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">생성일</span>
                <span className="text-sm font-medium">
                  {new Date(tenant.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">최종 수정</span>
                <span className="text-sm font-medium">
                  {new Date(tenant.updated_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">멤버 수</span>
                <span className="text-sm font-medium">{members?.length || 0}명</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>멤버 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">이름</th>
                  <th className="text-left p-2">이메일</th>
                  <th className="text-left p-2">역할</th>
                  <th className="text-left p-2">가입일</th>
                </tr>
              </thead>
              <tbody>
                {members?.map((member) => (
                  <tr key={member.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{member.profiles?.full_name || 'N/A'}</td>
                    <td className="p-2">{member.profiles?.email || 'N/A'}</td>
                    <td className="p-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                        {member.role}
                      </span>
                    </td>
                    <td className="p-2">
                      {new Date(member.created_at).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>사용량 기록 (최근 12개월)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">기간</th>
                  <th className="text-right p-2">이메일</th>
                  <th className="text-right p-2">알림</th>
                  <th className="text-right p-2">API 호출</th>
                  <th className="text-right p-2">스토리지</th>
                </tr>
              </thead>
              <tbody>
                {usageRecords?.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      {new Date(record.period_start).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </td>
                    <td className="p-2 text-right">{record.email_count || 0}</td>
                    <td className="p-2 text-right">{record.notification_count || 0}</td>
                    <td className="p-2 text-right">{record.api_calls || 0}</td>
                    <td className="p-2 text-right">
                      {record.storage_used
                        ? (record.storage_used / (1024 * 1024)).toFixed(2) + ' MB'
                        : '0 MB'}
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
