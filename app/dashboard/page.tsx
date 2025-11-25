'use client'

import { useAuth, AuthGuard } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AppHeader } from '@/components/layout/app-header'
import Link from 'next/link'
import {
  Mail,
  Building,
  Users,
  Bell,
  Settings,
  Activity,
  Calendar,
  CalendarDays,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Clock,
  MessageSquare,
  Smartphone,
  Eye,
  TestTube,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { WordMarkLink } from '@/components/ui/wordmark-link'

export default function DashboardPage() {
  return (
    <AuthGuard fallback={<DashboardLogin />}>
      <DashboardContent />
    </AuthGuard>
  )
}

function DashboardLogin() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="text-center">
        <WordMarkLink className="inline-flex flex-col items-center gap-4 mb-4 text-gray-900 no-underline">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <span className="text-2xl font-bold text-inherit">Echo Mail</span>
        </WordMarkLink>
        <p className="text-gray-600 mb-8">로그인이 필요한 페이지입니다.</p>
        <div className="space-x-4">
          <Button asChild>
            <a href="/auth/login">로그인</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/auth/signup">회원가입</a>
          </Button>
        </div>
      </div>
    </div>
  )
}

// 사용량 정보 타입
interface UsageData {
  email: { current: number; limit: number; percentage: number }
  sms: { current: number; limit: number; percentage: number }
  kakao: { current: number; limit: number; percentage: number }
  api: { current: number; limit: number; percentage: number }
  hasWarning: boolean
  hasExceeded: boolean
}

// 구독 정보 타입
interface SubscriptionData {
  id: string
  plan: {
    id: string
    name: string
    price: number
  }
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEnd?: string
  cancelAtPeriodEnd: boolean
}

// 활동 로그 타입
interface ActivityLog {
  id: string
  action: string
  description: string
  timestamp: string
  type: 'email' | 'notification' | 'subscription' | 'system'
}

// 통계 정보 타입
interface StatsData {
  companies: number
  todayEmails: number
  todayNotifications: number
}

function DashboardContent() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [stats, setStats] = useState<StatsData>({ companies: 0, todayEmails: 0, todayNotifications: 0 })
  const [loading, setLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [hasError, setHasError] = useState(false)

  // 데이터 로딩 - 컴포넌트 생명주기 관리
  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    const loadDashboardData = async () => {
      // 로그아웃 중이거나 user가 없으면 실행 안함
      if (!user || isSigningOut) return
      // 이미 에러 상태면 재시도 안함
      if (hasError) return

      try {
        setLoading(true)

        // 테넌트 확인
        const companiesCheckRes = await fetch('/api/companies?limit=1', {
          signal: abortController.signal,
        })

        // 컴포넌트 unmount 체크
        if (!isMounted) return

        // HTTP 에러 처리
        if (!companiesCheckRes.ok) {
          if (companiesCheckRes.status === 401) {
            // 인증 실패 - 로그인 페이지로 리다이렉트 (signOut 중복 호출 안함)
            // auth-provider의 onAuthStateChange가 처리하도록 위임
            window.location.href = '/auth/login'
            return
          } else if (companiesCheckRes.status >= 500) {
            // 서버 에러 - 한 번만 표시하고 중지
            setHasError(true)
            toast({
              title: '서버 연결 오류',
              description: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
              variant: 'destructive',
            })
            return
          }
        }

        // 오늘 날짜 계산
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStr = today.toISOString().split('T')[0]

        // 병렬로 데이터 로딩
        const [usageRes, subscriptionRes, activitiesRes, companiesRes, todayEmailsRes, todayNotificationsRes] = await Promise.all([
          fetch('/api/subscription/usage', { signal: abortController.signal }),
          fetch('/api/subscription', { signal: abortController.signal }),
          fetch('/api/activities?limit=10', { signal: abortController.signal }),
          fetch('/api/companies?limit=1', { signal: abortController.signal }),
          fetch(`/api/mail/list?dateFrom=${todayStr}&limit=1`, { signal: abortController.signal }),
          fetch('/api/notifications/logs?stats=true', { signal: abortController.signal }),
        ])

        // 컴포넌트 unmount 체크
        if (!isMounted) return

        if (usageRes.ok) {
          const usageData = await usageRes.json()
          setUsage(
            usageData.data?.summary || {
              email: { current: 0, limit: 1000, percentage: 0 },
              sms: { current: 0, limit: 500, percentage: 0 },
              kakao: { current: 0, limit: 300, percentage: 0 },
              api: { current: 0, limit: 10000, percentage: 0 },
              hasWarning: false,
              hasExceeded: false,
            }
          )
        }

        if (subscriptionRes.ok) {
          const subData = await subscriptionRes.json()
          setSubscription(subData.data?.subscription || subData.data)
        }

        if (activitiesRes.ok) {
          const activityData = await activitiesRes.json()
          setActivities(activityData.data || [])
        }

        // 통계 집계
        let companiesCount = 0
        let todayEmailsCount = 0
        let todayNotificationsCount = 0

        if (companiesRes.ok) {
          const companiesData = await companiesRes.json()
          companiesCount = companiesData.pagination?.total || 0
        }

        if (todayEmailsRes.ok) {
          const emailsData = await todayEmailsRes.json()
          todayEmailsCount = emailsData.data?.pagination?.totalCount || 0
        }

        if (todayNotificationsRes.ok) {
          const notificationsData = await todayNotificationsRes.json()
          // /api/notifications/logs?stats=true 응답 형식: { success: true, data: { today: number, ... } }
          todayNotificationsCount = notificationsData.data?.today || 0
        }

        setStats({
          companies: companiesCount,
          todayEmails: todayEmailsCount,
          todayNotifications: todayNotificationsCount,
        })
      } catch (error) {
        // AbortError는 무시 (정상적인 취소)
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        // 컴포넌트가 unmount 되었으면 상태 업데이트 안함
        if (!isMounted) return

        console.error('대시보드 데이터 로딩 실패:', error)
        setHasError(true)
        toast({
          title: '데이터 로딩 실패',
          description: '일부 정보를 불러올 수 없습니다.',
          variant: 'destructive',
        })
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadDashboardData()

    // Cleanup: 컴포넌트 unmount 시 요청 취소
    return () => {
      isMounted = false
      abortController.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isSigningOut])

  const handleSignOut = async () => {
    // 이미 로그아웃 중이면 무시
    if (isSigningOut || loading) return

    try {
      setIsSigningOut(true)
      const { error } = await signOut()

      if (error) {
        toast({
          title: '로그아웃 실패',
          description: error.message,
          variant: 'destructive',
        })
        setIsSigningOut(false)
      }
      // 성공 시 auth-provider가 리다이렉트 처리
    } catch (error) {
      console.error('로그아웃 중 오류:', error)
      setIsSigningOut(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'ACTIVE':
        return <Badge className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800">활성</Badge>
      case 'trialing':
      case 'TRIAL':
        return <Badge className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800">체험중</Badge>
      case 'past_due':
      case 'PAST_DUE':
        return <Badge className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800">결제 지연</Badge>
      case 'canceled':
      case 'CANCELED':
        return <Badge className="bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800">취소됨</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4" />
      case 'notification':
        return <Bell className="w-4 h-4" />
      case 'subscription':
        return <CreditCard className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <AppHeader />

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 웰컴 메시지 & 구독 상태 */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-2">대시보드</h2>
              <p className="text-gray-600 dark:text-muted-foreground">
                Echo Mail 발주 확인 자동 알림 시스템에 오신 것을 환영합니다!
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild>
                <Link href="/notifications/test">
                  <TestTube className="w-4 h-4 mr-2" />
                  SMS 테스트
                </Link>
              </Button>
              {subscription && (
                <div className="text-right">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium dark:text-foreground">
                      {subscription.plan?.name || 'FREE_TRIAL'}
                    </span>
                    {getStatusBadge(subscription.status)}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()} 까지
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 사용량 경고 */}
          {usage?.hasWarning && (
            <Alert className="mt-4 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/50">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                일부 서비스의 사용량이 한계에 근접했습니다. 플랜 업그레이드를 고려해보세요.
              </AlertDescription>
            </Alert>
          )}

          {usage?.hasExceeded && (
            <Alert className="mt-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                사용량 한계를 초과했습니다. 서비스가 일시 중단될 수 있습니다.
                <Button size="sm" variant="outline" className="ml-2" asChild>
                  <a href="/settings/subscription">플랜 업그레이드</a>
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* 메인 컨텐츠 - 3컬럼 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽 영역 - 사용량 카드 + 탭 섹션 (2컬럼) */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1열: 사용량 대시보드 - 4개 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 이메일 처리 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">이메일 처리</CardTitle>
                  <Mail className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : usage?.email.current.toLocaleString() || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    / {usage?.email.limit.toLocaleString() || '1,000'}건
                  </p>
                  <Progress value={usage?.email.percentage || 0} className="h-1" />
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {usage?.email.percentage?.toFixed(1) || '0'}% 사용
                  </div>
                </CardContent>
              </Card>

              {/* SMS 발송 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">SMS 발송</CardTitle>
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : usage?.sms.current.toLocaleString() || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    / {usage?.sms.limit.toLocaleString() || '500'}건
                  </p>
                  <Progress value={usage?.sms.percentage || 0} className="h-1" />
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {usage?.sms.percentage?.toFixed(1) || '0'}% 사용
                  </div>
                </CardContent>
              </Card>

              {/* 카카오톡 발송 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">카카오톡</CardTitle>
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : usage?.kakao.current.toLocaleString() || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    / {usage?.kakao.limit.toLocaleString() || '300'}건
                  </p>
                  <Progress value={usage?.kakao.percentage || 0} className="h-1" />
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {usage?.kakao.percentage?.toFixed(1) || '0'}% 사용
                  </div>
                </CardContent>
              </Card>

              {/* API 호출 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">API 호출</CardTitle>
                  <Activity className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : usage?.api.current.toLocaleString() || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    / {usage?.api.limit.toLocaleString() || '10,000'}건
                  </p>
                  <Progress value={usage?.api.percentage || 0} className="h-1" />
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {usage?.api.percentage?.toFixed(1) || '0'}% 사용
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 탭 섹션 */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">개요</TabsTrigger>
                <TabsTrigger value="quick-actions">빠른 작업</TabsTrigger>
                <TabsTrigger value="settings">설정</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 업체 관리 */}
                  <Card>
                    <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                      <Building className="w-5 h-5 mr-2 text-blue-600" />
                      <CardTitle className="text-lg">업체 관리</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold mb-2">
                        {loading ? '...' : `${stats.companies}개`}
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">등록된 발주처 업체</p>
                      <Button size="sm" className="w-full" asChild>
                        <a href="/companies">업체 관리하기</a>
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 메일함 */}
                  <Card>
                    <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                      <Mail className="w-5 h-5 mr-2 text-green-600" />
                      <CardTitle className="text-lg">메일함</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold mb-2">
                        {loading ? '...' : `${stats.todayEmails || 0}건`}
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">오늘 수신된 메일</p>
                      <Button size="sm" variant="outline" className="w-full" asChild>
                        <a href="/mail">메일함 보기</a>
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 알림 발송 현황 */}
                  <Card>
                    <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                      <Bell className="w-5 h-5 mr-2 text-orange-600" />
                      <CardTitle className="text-lg">알림 현황</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold mb-2">
                        {loading ? '...' : `${stats.todayNotifications}건`}
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">오늘 발송된 알림</p>
                      <Button size="sm" variant="outline" className="w-full" asChild>
                        <a href="/notifications">알림 관리</a>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="quick-actions" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="p-4 h-auto" asChild>
                    <a href="/mail" className="flex flex-col items-center">
                      <Mail className="w-6 h-6 mb-2" />
                      <span>메일함</span>
                    </a>
                  </Button>
                  <Button variant="outline" className="p-4 h-auto" asChild>
                    <a href="/companies/new" className="flex flex-col items-center">
                      <Building className="w-6 h-6 mb-2" />
                      <span>새 업체 등록</span>
                    </a>
                  </Button>
                  <Button variant="outline" className="p-4 h-auto" asChild>
                    <a href="/delivery-rules" className="flex flex-col items-center">
                      <Calendar className="w-6 h-6 mb-2" />
                      <span>배송 규칙 설정</span>
                    </a>
                  </Button>
                  <Button variant="outline" className="p-4 h-auto" asChild>
                    <a href="/holidays" className="flex flex-col items-center">
                      <Calendar className="w-6 h-6 mb-2" />
                      <span>공휴일 관리</span>
                    </a>
                  </Button>
                  <Button variant="outline" className="p-4 h-auto" asChild>
                    <a href="/settings/subscription" className="flex flex-col items-center">
                      <CreditCard className="w-6 h-6 mb-2" />
                      <span>구독 및 결제 관리</span>
                    </a>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="/holidays">
                      <CalendarDays className="w-4 h-4 mr-2" />
                      공휴일 관리
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="/settings/team">
                      <Users className="w-4 h-4 mr-2" />팀 관리
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="/settings">
                      <Settings className="w-4 h-4 mr-2" />
                      시스템 설정
                    </a>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* 오른쪽 영역 - 최근 활동 (1열 상단 ~ 2열 하단까지) */}
          <div className="lg:col-span-1">
            <Card className="h-full flex flex-col" style={{ minHeight: 'calc(100%)' }}>
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  최근 활동
                </CardTitle>
                <CardDescription>시스템의 최근 활동 내역</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0">
                {/* 스크롤 가능한 활동 목록 - 스크롤바 표시 */}
                <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: '450px' }}>
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                          <div className="flex-1">
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-3/4"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activities.length > 0 ? (
                    <div className="space-y-3">
                      {activities.map((activity) => (
                        <div key={activity.id} className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center shrink-0">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{activity.action}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{activity.description}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Eye className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">최근 활동이 없습니다</p>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4 flex-shrink-0" asChild>
                  <a href="/activities">전체 활동 보기</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
