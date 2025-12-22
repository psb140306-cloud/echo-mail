import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SubscriptionActions } from '@/components/super-admin/subscription-actions';

interface SubscriptionDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SubscriptionDetailPage({ params }: SubscriptionDetailPageProps) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select(`
      *,
      tenants (
        id,
        name,
        slug,
        status
      )
    `)
    .eq('id', id)
    .single();

  if (!subscription) {
    notFound();
  }

  // Get payment history
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('subscription_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('subscription_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/subscriptions"
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← 구독 목록으로
          </Link>
          <h2 className="text-3xl font-bold tracking-tight">
            {subscription.tenants?.name} 구독 정보
          </h2>
          <p className="text-gray-500 mt-2">구독 상세 정보 및 관리</p>
        </div>
        <SubscriptionActions
          subscriptionId={subscription.id}
          currentStatus={subscription.status}
          tenantId={subscription.tenant_id}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">플랜</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscription.plan_id}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">상태</CardTitle>
          </CardHeader>
          <CardContent>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">월 요금</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscription.price_per_month?.toLocaleString()}원
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">다음 결제일</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {subscription.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString('ko-KR')
                : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>구독 상세</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">구독 ID</span>
                <span className="text-sm font-mono">{subscription.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">테넌트</span>
                <Link
                  href={`/admin/tenants/${subscription.tenants?.id}`}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {subscription.tenants?.name}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">시작일</span>
                <span className="text-sm font-medium">
                  {subscription.current_period_start
                    ? new Date(subscription.current_period_start).toLocaleDateString('ko-KR')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">종료일</span>
                <span className="text-sm font-medium">
                  {subscription.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString('ko-KR')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">자동 갱신</span>
                <span className="text-sm font-medium">
                  {subscription.cancel_at_period_end ? '아니오' : '예'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>결제 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">총 결제 횟수</span>
                <span className="text-sm font-medium">{payments?.length || 0}회</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">총 결제 금액</span>
                <span className="text-sm font-medium">
                  {payments
                    ?.reduce((sum, p) => sum + (p.amount || 0), 0)
                    .toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">마지막 결제</span>
                <span className="text-sm font-medium">
                  {payments?.[0]?.created_at
                    ? new Date(payments[0].created_at).toLocaleDateString('ko-KR')
                    : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>결제 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">날짜</th>
                  <th className="text-left p-2">금액</th>
                  <th className="text-left p-2">상태</th>
                  <th className="text-left p-2">결제 수단</th>
                </tr>
              </thead>
              <tbody>
                {payments?.map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      {new Date(payment.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="p-2">{payment.amount?.toLocaleString()}원</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          payment.status === 'succeeded'
                            ? 'bg-green-100 text-green-800'
                            : payment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="p-2">{payment.payment_method || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>인보이스</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">인보이스 번호</th>
                  <th className="text-left p-2">날짜</th>
                  <th className="text-left p-2">금액</th>
                  <th className="text-left p-2">상태</th>
                  <th className="text-left p-2">작업</th>
                </tr>
              </thead>
              <tbody>
                {invoices?.map((invoice) => (
                  <tr key={invoice.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-sm">{invoice.invoice_number}</td>
                    <td className="p-2">
                      {new Date(invoice.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="p-2">{invoice.total_amount?.toLocaleString()}원</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="p-2">
                      <button className="text-blue-600 hover:text-blue-800 text-sm">
                        다운로드
                      </button>
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
