'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Building, Users, Mail, Bell, Crown, AlertTriangle, TrendingUp } from 'lucide-react'
import { formatLimit, getPlanDisplayName, SubscriptionPlan } from '@/lib/subscription/plans'
import { logger } from '@/lib/utils/logger'

interface UsageData {
  plan: SubscriptionPlan
  status: string
  usage: {
    companies: number
    contacts: number
    emailsThisMonth: number
    notificationsThisMonth: number
    users: number
  }
  limits: {
    companies: { current: number; limit: number; percentage: number }
    contacts: { current: number; limit: number; percentage: number }
    emailsThisMonth: { current: number; limit: number; percentage: number }
    notificationsThisMonth: { current: number; limit: number; percentage: number }
    users: { current: number; limit: number; percentage: number }
  }
  features: any
}

export function UsageDisplay() {
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsageData()
  }, [])

  const fetchUsageData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/subscription/usage')

      if (!response.ok) {
        throw new Error('Failed to fetch usage data')
      }

      const data = await response.json()
      if (data.success) {
        setUsageData(data.data)
      } else {
        throw new Error(data.message || 'Failed to fetch usage data')
      }
    } catch (error) {
      logger.error('Failed to fetch usage data', { error })
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">사용량 정보를 불러오는 중...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>오류</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!usageData) {
    return null
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const getStatusBadge = (percentage: number) => {
    if (percentage >= 100) return <Badge variant="destructive">한도 초과</Badge>
    if (percentage >= 90) return <Badge variant="destructive">위험</Badge>
    if (percentage >= 75) return <Badge variant="secondary">주의</Badge>
    return <Badge variant="outline">양호</Badge>
  }

  const usageItems = [
    {
      icon: Building,
      title: '업체 수',
      current: usageData.limits.companies.current,
      limit: usageData.limits.companies.limit,
      percentage: usageData.limits.companies.percentage,
      description: '등록된 업체 수',
    },
    {
      icon: Users,
      title: '담당자 수',
      current: usageData.limits.contacts.current,
      limit: usageData.limits.contacts.limit,
      percentage: usageData.limits.contacts.percentage,
      description: '등록된 담당자 수',
    },
    {
      icon: Mail,
      title: '이번 달 이메일',
      current: usageData.limits.emailsThisMonth.current,
      limit: usageData.limits.emailsThisMonth.limit,
      percentage: usageData.limits.emailsThisMonth.percentage,
      description: '이번 달 처리된 이메일 수',
    },
    {
      icon: Bell,
      title: '이번 달 알림',
      current: usageData.limits.notificationsThisMonth.current,
      limit: usageData.limits.notificationsThisMonth.limit,
      percentage: usageData.limits.notificationsThisMonth.percentage,
      description: '이번 달 발송된 알림 수',
    },
  ]

  const needsUpgrade = usageItems.some((item) => item.percentage >= 80)

  return (
    <div className="space-y-6">
      {/* 플랜 정보 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Crown className="w-5 h-5 mr-2 text-yellow-500" />
                현재 플랜
              </CardTitle>
              <CardDescription>구독 플랜 및 상태</CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {getPlanDisplayName(usageData.plan)}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* 업그레이드 권장 알림 */}
      {needsUpgrade && (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>플랜 업그레이드 권장</AlertTitle>
          <AlertDescription>
            일부 리소스 사용량이 높습니다. 더 원활한 서비스 이용을 위해 플랜 업그레이드를
            고려해보세요.
            <div className="mt-3">
              <Button size="sm" variant="default">
                플랜 업그레이드
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 사용량 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {usageItems.map((item, index) => {
          const Icon = item.icon
          const isUnlimited = item.limit === -1

          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <div className="flex items-center space-x-2 flex-1">
                  <Icon className="w-4 h-4 text-gray-500" />
                  <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                </div>
                {!isUnlimited && getStatusBadge(item.percentage)}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{item.description}</span>
                    <span className="font-medium">
                      {item.current.toLocaleString()} / {formatLimit(item.limit)}
                    </span>
                  </div>

                  {!isUnlimited && (
                    <div className="space-y-1">
                      <Progress value={Math.min(item.percentage, 100)} className="h-2" />
                      <div className="text-xs text-gray-500 text-right">
                        {item.percentage.toFixed(1)}% 사용됨
                      </div>
                    </div>
                  )}

                  {isUnlimited && (
                    <div className="text-xs text-green-600 font-medium">무제한 사용 가능</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
