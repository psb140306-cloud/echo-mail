'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Check,
  ArrowUpCircle,
  ArrowDownCircle,
  Building,
  Users,
  Mail,
  MessageCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { SubscriptionPlan, PLAN_LIMITS, PLAN_PRICING, getPlanDisplayName, isPlanHigherThan } from '@/lib/subscription/plans'
import { AppHeader } from '@/components/layout/app-header'

interface SubscriptionInfo {
  plan: SubscriptionPlan
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'UNPAID'
  currentPeriodEnd: string
  trialEndsAt?: string
  cancelAtPeriodEnd: boolean
}

interface UsageInfo {
  companies: { current: number; limit: number }
  contacts: { current: number; limit: number }
  emails: { current: number; limit: number }
  notifications: { current: number; limit: number }
}

export default function SubscriptionPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false)

  const availablePlans: SubscriptionPlan[] = [
    SubscriptionPlan.FREE_TRIAL,
    SubscriptionPlan.STARTER,
    SubscriptionPlan.PROFESSIONAL,
    SubscriptionPlan.BUSINESS,
  ]

  useEffect(() => {
    loadSubscriptionData()
  }, [])

  const loadSubscriptionData = async () => {
    try {
      setLoading(true)

      const [subscriptionRes, usageRes] = await Promise.all([
        fetch('/api/subscription'),
        fetch('/api/subscription/usage'),
      ])

      if (subscriptionRes.ok) {
        const data = await subscriptionRes.json()
        setSubscription(data.data)
      }

      if (usageRes.ok) {
        const data = await usageRes.json()
        setUsage(data.data)
      }
    } catch (error) {
      console.error('Failed to load subscription data:', error)
      toast({
        title: '오류',
        description: '구독 정보를 불러오는데 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePlan = async () => {
    if (!selectedPlan || !subscription) return

    try {
      setActionLoading(true)

      // 업그레이드인지 다운그레이드인지 판단
      const isUpgrade = isPlanHigherThan(selectedPlan, subscription.plan)

      const response = await fetch('/api/subscription/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPlan: selectedPlan,
          immediate: isUpgrade, // 업그레이드는 즉시, 다운그레이드는 다음 주기
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: isUpgrade
            ? '플랜이 즉시 업그레이드되었습니다. 상위 플랜의 모든 기능을 바로 사용하실 수 있습니다.'
            : `플랜 변경이 예약되었습니다. ${new Date(subscription.currentPeriodEnd).toLocaleDateString('ko-KR')}부터 적용됩니다.`,
        })
        setShowChangePlanDialog(false)
        loadSubscriptionData()
      } else {
        toast({
          title: '오류',
          description: data.error || '플랜 변경에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    try {
      setActionLoading(true)

      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '구독이 취소되었습니다. 현재 결제 기간 종료 시 해지됩니다.',
        })
        loadSubscriptionData()
      } else {
        toast({
          title: '오류',
          description: data.error || '구독 취소에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivateSubscription = async () => {
    try {
      setActionLoading(true)

      const response = await fetch('/api/subscription/reactivate', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '구독이 재활성화되었습니다.',
        })
        loadSubscriptionData()
      } else {
        toast({
          title: '오류',
          description: data.error || '구독 재활성화에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === -1) return 0
    return Math.min((current / limit) * 100, 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 70) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800">활성</Badge>
      case 'TRIAL':
        return <Badge className="bg-blue-100 text-blue-800">체험</Badge>
      case 'PAST_DUE':
        return <Badge className="bg-red-100 text-red-800">연체</Badge>
      case 'CANCELLED':
        return <Badge className="bg-gray-100 text-gray-800">취소됨</Badge>
      case 'UNPAID':
        return <Badge className="bg-orange-100 text-orange-800">미결제</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <AppHeader />

      {/* Sub Header */}
      <div className="border-b border-border bg-white dark:bg-card">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span>대시보드</span>
            </Link>
            <h1 className="text-lg font-semibold dark:text-foreground">구독 관리</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container py-6 space-y-6">
        {/* 안내 섹션 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">구독 관리</h2>
          <p className="text-gray-600 mb-4">
            Echo Mail의 구독 플랜을 관리하고 사용량을 확인하세요.
            플랜을 변경하거나 업그레이드하여 더 많은 기능을 이용할 수 있습니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">실시간 사용량 확인</p>
                <p className="text-gray-500">업체, 담당자, 이메일, 알림 사용량을 실시간으로 모니터링</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">유연한 플랜 변경</p>
                <p className="text-gray-500">언제든지 플랜을 업그레이드하거나 다운그레이드 가능</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">투명한 요금제</p>
                <p className="text-gray-500">숨겨진 비용 없이 명확한 가격 정책 제공</p>
              </div>
            </div>
          </div>
        </div>

        {/* 현재 구독 정보 */}
        {subscription && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {getPlanDisplayName(subscription.plan)}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {subscription.status === 'TRIAL' && subscription.trialEndsAt
                      ? `체험 종료: ${new Date(subscription.trialEndsAt).toLocaleDateString('ko-KR')}`
                      : `다음 결제일: ${new Date(subscription.currentPeriodEnd).toLocaleDateString('ko-KR')}`}
                  </CardDescription>
                </div>
                {getStatusBadge(subscription.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">
                    {PLAN_PRICING[subscription.plan].monthly === 0
                      ? '무료'
                      : PLAN_PRICING[subscription.plan].monthly === -1
                        ? '별도 문의'
                        : `₩${PLAN_PRICING[subscription.plan].monthly.toLocaleString()}`}
                  </p>
                  {PLAN_PRICING[subscription.plan].monthly > 0 && (
                    <p className="text-sm text-muted-foreground">월 결제</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {subscription.cancelAtPeriodEnd ? (
                    <Button onClick={handleReactivateSubscription} disabled={actionLoading}>
                      {actionLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      구독 재활성화
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setShowChangePlanDialog(true)}
                      >
                        플랜 변경
                      </Button>
                      {subscription.plan !== SubscriptionPlan.FREE_TRIAL && (
                        <Button
                          variant="destructive"
                          onClick={handleCancelSubscription}
                          disabled={actionLoading}
                        >
                          {actionLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          구독 취소
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {subscription.cancelAtPeriodEnd && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">구독이 취소 예정입니다</p>
                    <p className="mt-1">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString('ko-KR')}까지 서비스를 이용하실 수 있습니다.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 사용량 */}
        {usage && subscription && (
          <Card>
            <CardHeader>
              <CardTitle>사용량</CardTitle>
              <CardDescription>현재 플랜의 제한과 사용량입니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 업체 수 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">업체</span>
                  </div>
                  <span className={`text-sm font-medium ${getUsageColor(getUsagePercentage(usage.companies.current, usage.companies.limit))}`}>
                    {usage.companies.current} / {usage.companies.limit === -1 ? '무제한' : usage.companies.limit}
                  </span>
                </div>
                {usage.companies.limit !== -1 && (
                  <Progress value={getUsagePercentage(usage.companies.current, usage.companies.limit)} />
                )}
              </div>

              {/* 담당자 수 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500" />
                    <span className="font-medium">담당자</span>
                  </div>
                  <span className={`text-sm font-medium ${getUsageColor(getUsagePercentage(usage.contacts.current, usage.contacts.limit))}`}>
                    {usage.contacts.current} / {usage.contacts.limit === -1 ? '무제한' : usage.contacts.limit}
                  </span>
                </div>
                {usage.contacts.limit !== -1 && (
                  <Progress value={getUsagePercentage(usage.contacts.current, usage.contacts.limit)} />
                )}
              </div>

              {/* 월 이메일 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">월 이메일 처리</span>
                  </div>
                  <span className={`text-sm font-medium ${getUsageColor(getUsagePercentage(usage.emails.current, usage.emails.limit))}`}>
                    {usage.emails.current} / {usage.emails.limit === -1 ? '무제한' : usage.emails.limit.toLocaleString()}
                  </span>
                </div>
                {usage.emails.limit !== -1 && (
                  <Progress value={getUsagePercentage(usage.emails.current, usage.emails.limit)} />
                )}
              </div>

              {/* 월 알림 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">월 알림 발송</span>
                  </div>
                  <span className={`text-sm font-medium ${getUsageColor(getUsagePercentage(usage.notifications.current, usage.notifications.limit))}`}>
                    {usage.notifications.current} / {usage.notifications.limit === -1 ? '무제한' : usage.notifications.limit.toLocaleString()}
                  </span>
                </div>
                {usage.notifications.limit !== -1 && (
                  <Progress value={getUsagePercentage(usage.notifications.current, usage.notifications.limit)} />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 플랜 비교 */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">플랜 비교</h2>
            <p className="text-gray-600">
              비즈니스 규모와 필요에 맞는 플랜을 선택하세요.
              모든 플랜은 언제든지 변경 가능하며, 업그레이드 시 즉시 적용됩니다.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>사용 가능한 플랜</CardTitle>
              <CardDescription>각 플랜의 제공 기능과 제한사항을 비교해보세요</CardDescription>
            </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {availablePlans.map((plan) => {
                const limits = PLAN_LIMITS[plan]
                const pricing = PLAN_PRICING[plan]
                const isCurrent = subscription?.plan === plan

                return (
                  <Card
                    key={plan}
                    className={`relative ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-blue-500">현재 플랜</Badge>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-lg">{getPlanDisplayName(plan)}</CardTitle>
                      <div className="text-2xl font-bold">
                        {pricing.monthly === 0
                          ? '무료'
                          : pricing.monthly === -1
                            ? '문의'
                            : `₩${pricing.monthly.toLocaleString()}`}
                      </div>
                      {pricing.monthly > 0 && pricing.monthly !== -1 && (
                        <p className="text-sm text-muted-foreground">월</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          <span>업체 {limits.maxCompanies === -1 ? '무제한' : `${limits.maxCompanies}개`}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          <span>담당자 {limits.maxContacts === -1 ? '무제한' : `${limits.maxContacts}명`}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          <span>이메일 {limits.maxEmailsPerMonth === -1 ? '무제한' : `${limits.maxEmailsPerMonth.toLocaleString()}건/월`}</span>
                        </div>
                      </div>

                      {!isCurrent && (
                        <Button
                          className="w-full mt-4"
                          variant={isPlanHigherThan(plan, subscription?.plan || SubscriptionPlan.FREE_TRIAL) ? 'default' : 'outline'}
                          onClick={() => {
                            setSelectedPlan(plan)
                            setShowChangePlanDialog(true)
                          }}
                        >
                          {isPlanHigherThan(plan, subscription?.plan || SubscriptionPlan.FREE_TRIAL) ? (
                            <>
                              <ArrowUpCircle className="mr-2 h-4 w-4" />
                              업그레이드
                            </>
                          ) : (
                            <>
                              <ArrowDownCircle className="mr-2 h-4 w-4" />
                              다운그레이드
                            </>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
        </div>
      </main>

      {/* 플랜 변경 확인 다이얼로그 */}
      <Dialog open={showChangePlanDialog} onOpenChange={setShowChangePlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>플랜 변경 확인</DialogTitle>
            <DialogDescription>
              {selectedPlan && subscription && (
                <>
                  <p className="mb-4">
                    <span className="font-semibold">{getPlanDisplayName(subscription.plan)}</span>에서{' '}
                    <span className="font-semibold">{getPlanDisplayName(selectedPlan)}</span>로 변경하시겠습니까?
                  </p>
                  {isPlanHigherThan(selectedPlan, subscription.plan) ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <ArrowUpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">즉시 적용</p>
                          <p className="text-sm text-blue-700 dark:text-blue-200">
                            업그레이드는 즉시 적용되며, 상위 플랜의 모든 기능을 바로 사용하실 수 있습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                            {new Date(subscription.currentPeriodEnd).toLocaleDateString('ko-KR')} 적용
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-200">
                            현재 결제 기간이 종료되면 자동으로 변경됩니다.
                            그 전까지는 현재 플랜의 모든 기능을 계속 이용하실 수 있습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowChangePlanDialog(false)}
              disabled={actionLoading}
            >
              취소
            </Button>
            <Button onClick={handleChangePlan} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
