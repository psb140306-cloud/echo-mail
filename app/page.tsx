import { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MobileHeader } from '@/components/layout/mobile-nav'
import { ResponsiveGrid } from '@/components/ui/responsive-grid'
import {
  Mail,
  MessageCircle,
  Users,
  Settings,
  Activity,
  Calendar,
  Bell,
  TrendingUp,
  Menu
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Echo Mail Dashboard',
  description: 'Echo Mail 관리자 대시보드',
}

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Mobile Header */}
      <MobileHeader />

      {/* Desktop Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 hidden md:block">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <Mail className="h-6 w-6 text-echo-blue-600" />
              <span className="font-bold text-xl">Echo Mail</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link
                href="/companies"
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                업체 관리
              </Link>
              <Link
                href="/delivery-rules"
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                배송 규칙
              </Link>
              <Link
                href="/notifications"
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                알림 관리
              </Link>
              <Link
                href="/logs"
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                로그 및 통계
              </Link>
              <Link
                href="/settings"
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                시스템 설정
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {/* Welcome Section */}
        <div className="flex items-center justify-between space-y-2 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
            <p className="text-muted-foreground">
              Echo Mail 발주 확인 자동 알림 시스템을 관리하세요
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Activity className="mr-1 h-3 w-3" />
              시스템 정상
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <ResponsiveGrid cols={{ default: 1, sm: 2, lg: 4 }} className="mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">등록 업체</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">
                활성 업체 수
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">오늘 발송</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">
                SMS/카카오톡 발송
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">수신 메일</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">
                오늘 처리된 메일
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">발송 성공률</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--%</div>
              <p className="text-xs text-muted-foreground">
                지난 24시간
              </p>
            </CardContent>
          </Card>
        </ResponsiveGrid>

        {/* Quick Actions */}
        <ResponsiveGrid cols={{ default: 1, md: 2, lg: 3 }} gap="gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                업체 관리
              </CardTitle>
              <CardDescription>
                업체 정보 및 담당자를 등록하고 관리하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link href="/companies">업체 보기</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/companies/new">새 업체 추가</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                배송 규칙
              </CardTitle>
              <CardDescription>
                지역별 배송 규칙과 공휴일을 설정하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link href="/delivery-rules">규칙 보기</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/holidays">공휴일 관리</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                알림 관리
              </CardTitle>
              <CardDescription>
                SMS/카카오톡 발송 현황을 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link href="/notifications">발송 현황</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/notifications/test">테스트 발송</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                메일 모니터링
              </CardTitle>
              <CardDescription>
                메일 수신 상태와 처리 현황을 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link href="/mail-monitor">모니터링</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/mail-logs">메일 로그</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                시스템 설정
              </CardTitle>
              <CardDescription>
                메일 서버, API 키 등 시스템을 설정하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link href="/settings">설정 보기</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/settings/test">연결 테스트</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                시스템 상태
              </CardTitle>
              <CardDescription>
                서비스 상태와 성능을 모니터링하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link href="/system-status">상태 보기</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/logs">시스템 로그</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </ResponsiveGrid>

        {/* System Status */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>시스템 상태</CardTitle>
              <CardDescription>
                Echo Mail 서비스의 현재 상태를 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveGrid cols={{ default: 1, md: 3 }} gap="gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">메일 서버</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    연결됨
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm">SMS API</span>
                  </div>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    테스트 모드
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <span className="text-sm">알림 큐</span>
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    대기: 0개
                  </Badge>
                </div>
              </ResponsiveGrid>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
