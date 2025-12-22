'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline'

interface CostStats {
  notifications: {
    total: number
    sms: number
    kakaoAlimtalk: number
    kakaoFriendtalk: number
    bySource: {
      order: {
        sms: number
        kakaoAlimtalk: number
        kakaoFriendtalk: number
      }
      announcement: {
        sms: number
        kakaoAlimtalk: number
        kakaoFriendtalk: number
      }
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

export default function AdminCostsPage() {
  const [stats, setStats] = useState<CostStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/super-admin/cost-stats')
        const data = await response.json()

        if (data.success) {
          setStats(data.data)
        } else {
          setError(data.error || '데이터를 불러오는데 실패했습니다.')
        }
      } catch (err) {
        setError('서버 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">비용 통계</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">비용 통계</h1>
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">비용 통계</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {new Date(stats.period.start).toLocaleDateString('ko-KR')} ~ {new Date(stats.period.end).toLocaleDateString('ko-KR')} (이번 달)
        </p>
      </div>

      {/* 수익 요약 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">구독 매출</CardTitle>
            <CurrencyDollarIcon className="h-4 w-4 text-gray-500" />
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
            <CardTitle className="text-sm font-medium">API 비용</CardTitle>
            <ChartBarIcon className="h-4 w-4 text-gray-500" />
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
            <BanknotesIcon className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.revenue.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(stats.revenue.profit)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              매출 - API 비용
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이익률</CardTitle>
            <ArrowTrendingUpIcon className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.revenue.profitMargin >= 30 ? 'text-green-600' : stats.revenue.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {stats.revenue.profitMargin}%
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.revenue.profitMargin >= 30 ? '양호' : stats.revenue.profitMargin >= 0 ? '주의' : '적자'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 채널별 비용 상세 */}
      <Card>
        <CardHeader>
          <CardTitle>채널별 발송 비용</CardTitle>
          <CardDescription>API 단가 기준 비용 계산</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">채널</th>
                  <th className="text-right p-3 font-medium">단가</th>
                  <th className="text-right p-3 font-medium">발송 건수</th>
                  <th className="text-right p-3 font-medium">비용</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3">SMS</td>
                  <td className="text-right p-3">{formatCurrency(stats.costs.unitCosts.sms)}</td>
                  <td className="text-right p-3">{formatNumber(stats.notifications.sms)}건</td>
                  <td className="text-right p-3 font-medium">{formatCurrency(stats.costs.sms)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">카카오 알림톡</td>
                  <td className="text-right p-3">{formatCurrency(stats.costs.unitCosts.kakaoAlimtalk)}</td>
                  <td className="text-right p-3">{formatNumber(stats.notifications.kakaoAlimtalk)}건</td>
                  <td className="text-right p-3 font-medium">{formatCurrency(stats.costs.kakaoAlimtalk)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">카카오 친구톡</td>
                  <td className="text-right p-3">{formatCurrency(stats.costs.unitCosts.kakaoFriendtalk)}</td>
                  <td className="text-right p-3">{formatNumber(stats.notifications.kakaoFriendtalk)}건</td>
                  <td className="text-right p-3 font-medium">{formatCurrency(stats.costs.kakaoFriendtalk)}</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <td className="p-3 font-bold" colSpan={2}>합계</td>
                  <td className="text-right p-3 font-bold">{formatNumber(stats.notifications.total)}건</td>
                  <td className="text-right p-3 font-bold">{formatCurrency(stats.costs.totalApiCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 발송 유형별 통계 */}
        <Card>
          <CardHeader>
            <CardTitle>발송 유형별 통계</CardTitle>
            <CardDescription>발주 알림 vs 대량 공지</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">발주 알림</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">SMS</p>
                    <p className="font-medium">{formatNumber(stats.notifications.bySource.order.sms)}건</p>
                  </div>
                  <div>
                    <p className="text-gray-500">알림톡</p>
                    <p className="font-medium">{formatNumber(stats.notifications.bySource.order.kakaoAlimtalk)}건</p>
                  </div>
                  <div>
                    <p className="text-gray-500">친구톡</p>
                    <p className="font-medium">{formatNumber(stats.notifications.bySource.order.kakaoFriendtalk)}건</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <h4 className="font-medium text-purple-700 dark:text-purple-300 mb-2">대량 공지</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">SMS</p>
                    <p className="font-medium">{formatNumber(stats.notifications.bySource.announcement.sms)}건</p>
                  </div>
                  <div>
                    <p className="text-gray-500">알림톡</p>
                    <p className="font-medium">{formatNumber(stats.notifications.bySource.announcement.kakaoAlimtalk)}건</p>
                  </div>
                  <div>
                    <p className="text-gray-500">친구톡</p>
                    <p className="font-medium">{formatNumber(stats.notifications.bySource.announcement.kakaoFriendtalk)}건</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 테넌트별 TOP 5 */}
        <Card>
          <CardHeader>
            <CardTitle>테넌트별 발송량 TOP 5</CardTitle>
            <CardDescription>이번 달 기준</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topTenants.length === 0 ? (
                <p className="text-gray-500 text-center py-4">데이터 없음</p>
              ) : (
                stats.topTenants.map((tenant, index) => (
                  <div key={tenant.tenantId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-gray-300 text-gray-700' :
                        index === 2 ? 'bg-amber-600 text-white' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="font-medium">{tenant.tenantName}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatNumber(tenant.count)}건</p>
                      <p className="text-xs text-gray-500">≈ {formatCurrency(tenant.estimatedCost)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
