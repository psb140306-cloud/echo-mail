'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts'
import {
  TrendingUp,
  MessageSquare,
  Smartphone,
  Building2,
  Users,
  Activity
} from 'lucide-react'

interface UsageData {
  summary: {
    totalTenants: number
    totalMembers: number
    totalCompanies: number
    totalNotifications: number
    smsCount: number
    kakaoCount: number
  }
  recent30Days: {
    total: number
    sms: number
    kakao: number
  }
  dailyStats: Array<{
    date: string
    count: number
  }>
  tenantUsage: Array<{
    tenantId: string
    tenantName: string
    subdomain: string
    memberCount: number
    companyCount: number
    notifications: {
      total: number
      sms: number
      kakao: number
    }
  }>
}

export default function UsageStatisticsPage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await fetch('/api/admin/usage', {
          credentials: 'include',
        })
        if (!response.ok) {
          throw new Error('Failed to fetch usage data')
        }
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error('Failed to load usage:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsage()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">사용량 통계를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">사용량 데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          사용량 통계
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          전체 시스템 사용량 및 알림 발송 현황
        </p>
      </div>

      {/* 전체 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              테넌트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalTenants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Users className="w-4 h-4" />
              멤버
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              업체
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalCompanies}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              전체 알림
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalNotifications.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              SMS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.smsCount.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              카카오톡
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.kakaoCount.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* 최근 30일 통계 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            최근 30일 알림 발송
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {data.recent30Days.total.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">전체 알림</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {data.recent30Days.sms.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">SMS</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {data.recent30Days.kakao.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">카카오톡</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 일별 발송 추이 (최근 7일) */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>일별 알림 발송 추이 (최근 7일)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.dailyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getMonth() + 1}/${date.getDate()}`
                }}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => {
                  const date = new Date(value as string)
                  return date.toLocaleDateString('ko-KR')
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                name="알림 발송 수"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 테넌트별 사용량 */}
      <Card>
        <CardHeader>
          <CardTitle>테넌트별 사용량</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.tenantUsage.map((tenant) => (
              <div
                key={tenant.tenantId}
                className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{tenant.tenantName}</h3>
                    <p className="text-sm text-gray-500">{tenant.subdomain}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-blue-600">{tenant.memberCount}</div>
                      <div className="text-gray-500">멤버</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-green-600">{tenant.companyCount}</div>
                      <div className="text-gray-500">업체</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{tenant.notifications.total.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">전체 알림</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {tenant.notifications.sms.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">SMS</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {tenant.notifications.kakao.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">카카오톡</div>
                  </div>
                </div>
              </div>
            ))}

            {data.tenantUsage.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                테넌트가 없습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
