'use client'

import { useAuth, AuthGuard } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Mail,
  Building,
  Users,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Activity,
  Calendar,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Clock,
  MessageSquare,
  Smartphone,
  Eye,
} from 'lucide-react'
import { useEffect, useState } from 'react'

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
        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Echo Mail</h1>
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

function DashboardContent() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  // 데이터 로딩
  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // 병렬로 데이터 로딩
      const [usageRes, subscriptionRes, activitiesRes] = await Promise.all([
        fetch('/api/usage'),
        fetch('/api/subscription'),
        fetch('/api/activities?limit=10'),
      ])

      if (usageRes.ok) {
        const usageData = await usageRes.json()
        setUsage(
          usageData.data.summary || {
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
        setSubscription(subData.data)
      }

      if (activitiesRes.ok) {
        const activityData = await activitiesRes.json()
        setActivities(activityData.data || [])
      }
    } catch (error) {
      console.error('대시보드 데이터 로딩 실패:', error)
      toast({
        title: '데이터 로딩 실패',
        description: '일부 정보를 불러올 수 없습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      toast({
        title: '로그아웃 실패',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: '로그아웃 완료',
        description: '안전하게 로그아웃되었습니다.',
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">활성</Badge>
      case 'trialing':
        return <Badge className="bg-blue-100 text-blue-800">체험중</Badge>
      case 'past_due':
        return <Badge className="bg-yellow-100 text-yellow-800">결제 지연</Badge>
      case 'canceled':
        return <Badge className="bg-red-100 text-red-800">취소됨</Badge>
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
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Echo Mail</h1>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{user?.email}님 안녕하세요</span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 웰컴 메시지 & 구독 상태 */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">대시보드</h2>
              <p className="text-gray-600">
                Echo Mail 발주 확인 자동 알림 시스템에 오신 것을 환영합니다!
              </p>
            </div>
            {subscription && (
              <div className="text-right">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-medium">{subscription.plan.name}</span>
                  {getStatusBadge(subscription.status)}
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()} 까지
                </p>
              </div>
            )}
          </div>

          {/* 사용량 경고 */}
          {usage?.hasWarning && (
            <Alert className="mt-4 border-yellow-200 bg-yellow-50">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                일부 서비스의 사용량이 한계에 근접했습니다. 플랜 업그레이드를 고려해보세요.
              </AlertDescription>
            </Alert>
          )}

          {usage?.hasExceeded && (
            <Alert className="mt-4 border-red-200 bg-red-50">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                사용량 한계를 초과했습니다. 서비스가 일시 중단될 수 있습니다.
                <Button size="sm" variant="outline" className="ml-2" asChild>
                  <a href="/settings/subscription">플랜 업그레이드</a>
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* 사용량 대시보드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

        {/* 주요 기능 & 최근 활동 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 주요 기능 */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">개요</TabsTrigger>
                <TabsTrigger value="quick-actions">빠른 작업</TabsTrigger>
                <TabsTrigger value="settings">설정</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 업체 관리 */}
                  <Card>
                    <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                      <Building className="w-5 h-5 mr-2 text-blue-600" />
                      <CardTitle className="text-lg">업체 관리</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold mb-2">0개</div>
                      <p className="text-sm text-muted-foreground mb-4">등록된 발주처 업체</p>
                      <Button size="sm" className="w-full" asChild>
                        <a href="/companies">업체 관리하기</a>
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
                      <div className="text-2xl font-bold mb-2">0건</div>
                      <p className="text-sm text-muted-foreground mb-4">오늘 발송된 알림</p>
                      <Button size="sm" variant="outline" className="w-full" asChild>
                        <a href="/notifications">알림 관리</a>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="quick-actions" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Button variant="outline" className="p-4 h-auto" disabled>
                    <div className="flex flex-col items-center">
                      <Mail className="w-6 h-6 mb-2" />
                      <span>메일 계정 연동</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="p-4 h-auto" asChild>
                    <a href="/settings" className="flex flex-col items-center">
                      <Settings className="w-6 h-6 mb-2" />
                      <span>시스템 설정</span>
                    </a>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="/settings/subscription">
                      <CreditCard className="w-4 h-4 mr-2" />
                      구독 및 결제 관리
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
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="/settings/billing">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      사용량 통계
                    </a>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* 최근 활동 */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  최근 활동
                </CardTitle>
                <CardDescription>시스템의 최근 활동 내역</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-3 bg-gray-200 rounded mb-1"></div>
                          <div className="h-2 bg-gray-100 rounded w-3/4"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                          <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(activity.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Eye className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">최근 활동이 없습니다</p>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full mt-4" asChild>
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
