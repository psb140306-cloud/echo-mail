export const dynamic = 'force-dynamic';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default async function TenantsPage() {
  const supabase = createServerClient();

  const { data: tenants } = await supabase
    .from('tenants')
    .select(`
      *,
      subscriptions (
        plan_id,
        status,
        current_period_end
      )
    `)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">테넌트 관리</h2>
        <p className="text-gray-500 mt-2">모든 테넌트를 관리합니다</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>테넌트 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">테넌트 이름</th>
                  <th className="text-left p-2">슬러그</th>
                  <th className="text-left p-2">상태</th>
                  <th className="text-left p-2">구독 플랜</th>
                  <th className="text-left p-2">생성일</th>
                  <th className="text-left p-2">작업</th>
                </tr>
              </thead>
              <tbody>
                {tenants?.map((tenant) => (
                  <tr key={tenant.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{tenant.name}</td>
                    <td className="p-2">{tenant.slug}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          tenant.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {tenant.status}
                      </span>
                    </td>
                    <td className="p-2">
                      {tenant.subscriptions?.[0]?.plan_id || 'N/A'}
                    </td>
                    <td className="p-2">
                      {new Date(tenant.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="p-2">
                      <Link
                        href={`/super-admin/tenants/${tenant.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        상세보기
                      </Link>
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
