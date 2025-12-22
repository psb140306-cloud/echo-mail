'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Send,
  Building,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface CostStats {
  notifications: {
    total: number
    sms: number
    kakaoAlimtalk: number
    kakaoFriendtalk: number
    bySource: {
      order: { sms: number; kakaoAlimtalk: number; kakaoFriendtalk: number }
      announcement: { sms: number; kakaoAlimtalk: number; kakaoFriendtalk: number }
    }
  }
  costs: {
    sms: number
    kakaoAlimtalk: number
    kakaoFriendtalk: number
    totalApiCost: number
    unitCosts: {
      sms: number
      kakaoAlimtalk: number
      kakaoFriendtalk: number
    }
  }
  revenue: {
    subscriptionRevenue: number
    activeSubscriptions: number
    profit: number
    profitMargin: number
  }
  topTenants: Array<{
    tenantId: string
    tenantName: string
    count: number
    estimatedCost: number
  }>
  period: {
    start: string
    end: string
  }
}

export default function CostsPage() {
  const [stats, setStats] = useState<CostStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/super-admin/cost-stats')
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      } else {
        setError(data.error || '데이터를 불러오는데 실패했습니다.')
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-red-600">{error}</p>
        <Button onClick={loadStats} variant="outline">
          다시 시도
        </Button>
      </div>
    )
  }

  if (!stats) return null

  const profitColor = stats.revenue.profitMargin >= 50
    ? 'text-green-600'
    : stats.revenue.profitMargin >= 30
      ? 'text-yellow-600'
      : 'text-red-600'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">비용 통계</h2>
          <p className="text-gray-500 mt-2">
            {new Date(stats.period.start).toLocaleDateString('ko-KR')} ~{' '}
            {new Date(stats.period.end).toLocaleDateString('ko-KR')} 기준
          </p>
        </div>
        <Button onClick={loadStats} variant="outline" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          새로고침
        </Button>
      </div>

      {/* 수익 요약 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">구독 매출</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.revenue.subscriptionRevenue)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              활성 구독 {stats.revenue.activeSubscriptions}개
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API 원가</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.costs.totalApiCost)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              총 {formatNumber(stats.notifications.total)}건 발송
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">순이익</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.revenue.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(stats.revenue.profit)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              매출 - 원가
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">마진율</CardTitle>
            {stats.revenue.profitMargin >= 50 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-yellow-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitColor}`}>
              {stats.revenue.profitMargin}%
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.revenue.profitMargin >= 50 ? '양호' : stats.revenue.profitMargin >= 30 ? '주의' : '위험'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 발송 통계 상세 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              채널별 발송 현황
            </CardTitle>
            <CardDescription>이번 달 성공적으로 발송된 알림</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* SMS */}
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-blue-100 text-blue-700">SMS</Badge>
                  <span className="font-medium">{formatNumber(stats.notifications.sms)}건</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-600">
                    {formatCurrency(stats.costs.sms)}
                  </div>
                  <div className="text-xs text-gray-500">
                    @{stats.costs.unitCosts.sms}원/건
                  </div>
                </div>
              </div>

              {/* 카카오 알림톡 */}
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700">알림톡</Badge>
                  <span className="font-medium">{formatNumber(stats.notifications.kakaoAlimtalk)}건</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-600">
                    {formatCurrency(stats.costs.kakaoAlimtalk)}
                  </div>
                  <div className="text-xs text-gray-500">
                    @{stats.costs.unitCosts.kakaoAlimtalk}원/건
                  </div>
                </div>
              </div>

              {/* 카카오 친구톡 */}
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-orange-100 text-orange-700">친구톡</Badge>
                  <span className="font-medium">{formatNumber(stats.notifications.kakaoFriendtalk)}건</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-600">
                    {formatCurrency(stats.costs.kakaoFriendtalk)}
                  </div>
                  <div className="text-xs text-gray-500">
                    @{stats.costs.unitCosts.kakaoFriendtalk}원/건
                  </div>
                </div>
              </div>

              {/* 합계 */}
              <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg font-semibold">
                <span>합계</span>
                <div className="text-right">
                  <div className="text-red-600">{formatCurrency(stats.costs.totalApiCost)}</div>
                  <div className="text-xs text-gray-500">{formatNumber(stats.notifications.total)}건</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              발송 유형별 현황
            </CardTitle>
            <CardDescription>발주 알림 vs 대량 공지</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 발주 알림 */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Badge>발주 알림</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <div className="font-semibold">{formatNumber(stats.notifications.bySource.order.sms)}</div>
                    <div className="text-xs text-gray-500">SMS</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    <div className="font-semibold">{formatNumber(stats.notifications.bySource.order.kakaoAlimtalk)}</div>
                    <div className="text-xs text-gray-500">알림톡</div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                    <div className="font-semibold">{formatNumber(stats.notifications.bySource.order.kakaoFriendtalk)}</div>
                    <div className="text-xs text-gray-500">친구톡</div>
                  </div>
                </div>
              </div>

              {/* 대량 공지 */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">대량 공지</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <div className="font-semibold">{formatNumber(stats.notifications.bySource.announcement.sms)}</div>
                    <div className="text-xs text-gray-500">SMS</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    <div className="font-semibold">{formatNumber(stats.notifications.bySource.announcement.kakaoAlimtalk)}</div>
                    <div className="text-xs text-gray-500">알림톡</div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                    <div className="font-semibold">{formatNumber(stats.notifications.bySource.announcement.kakaoFriendtalk)}</div>
                    <div className="text-xs text-gray-500">친구톡</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 테넌트별 TOP 5 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            테넌트별 발송량 TOP 5
          </CardTitle>
          <CardDescription>가장 많이 발송한 테넌트 (발주 알림 기준)</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.topTenants.length === 0 ? (
            <p className="text-gray-500 text-center py-4">데이터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">순위</th>
                    <th className="text-left p-2">테넌트</th>
                    <th className="text-right p-2">발송 건수</th>
                    <th className="text-right p-2">예상 비용</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topTenants.map((tenant, index) => (
                    <tr key={tenant.tenantId} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-2">
                        <Badge variant={index === 0 ? 'default' : 'outline'}>
                          {index + 1}
                        </Badge>
                      </td>
                      <td className="p-2 font-medium">{tenant.tenantName}</td>
                      <td className="p-2 text-right">{formatNumber(tenant.count)}건</td>
                      <td className="p-2 text-right text-red-600">
                        {formatCurrency(tenant.estimatedCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 단가 안내 */}
      <Card className="bg-gray-50 dark:bg-gray-800/50">
        <CardHeader>
          <CardTitle className="text-sm">API 단가 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-500">SMS:</span>{' '}
              <span className="font-medium">{stats.costs.unitCosts.sms}원/건</span>
            </div>
            <div>
              <span className="text-gray-500">카카오 알림톡:</span>{' '}
              <span className="font-medium">{stats.costs.unitCosts.kakaoAlimtalk}원/건</span>
            </div>
            <div>
              <span className="text-gray-500">카카오 친구톡:</span>{' '}
              <span className="font-medium">{stats.costs.unitCosts.kakaoFriendtalk}원/건</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
