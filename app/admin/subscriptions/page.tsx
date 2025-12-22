export const dynamic = 'force-dynamic';
import { createAdminClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default async function SubscriptionsPage() {
  const supabase = createAdminClient();

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select(`
      *,
      tenants (
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">구독 현황</h2>
        <p className="text-gray-500 mt-2">모든 구독을 모니터링합니다</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>구독 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">테넌트</th>
                  <th className="text-left p-2">플랜</th>
                  <th className="text-left p-2">상태</th>
                  <th className="text-left p-2">갱신일</th>
                  <th className="text-left p-2">월 요금</th>
                  <th className="text-left p-2">작업</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions?.map((subscription) => (
                  <tr key={subscription.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{subscription.tenants?.name || 'N/A'}</td>
                    <td className="p-2">{subscription.plan_id}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          subscription.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : subscription.status === 'trialing'
                            ? 'bg-blue-100 text-blue-800'
                            : subscription.status === 'past_due'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {subscription.status}
                      </span>
                    </td>
                    <td className="p-2">
                      {subscription.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString('ko-KR')
                        : 'N/A'}
                    </td>
                    <td className="p-2">
                      {subscription.price_per_month
                        ? `${subscription.price_per_month.toLocaleString()}원`
                        : 'N/A'}
                    </td>
                    <td className="p-2">
                      <Link
                        href={`/admin/subscriptions/${subscription.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        관리
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
