'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  ArrowLeft,
  Mail,
  MessageCircle,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Download,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  category: 'email' | 'sms' | 'kakao' | 'system'
  message: string
  details?: any
  companyName?: string
  contactName?: string
}

interface NotificationLog {
  id: string
  timestamp: string
  type: 'sms' | 'kakao'
  source: 'order' | 'announcement' // 발주알림 vs 대량공지
  companyName: string
  contactName: string
  phone: string
  status: 'success' | 'failed' | 'pending'
  message: string
  error?: string
  retryCount: number
}

interface Statistics {
  daily: {
    date: string
    emailsProcessed: number
    smsSuccess: number
    smsFailed: number
    kakaoSuccess: number
    kakaoFailed: number
  }[]
  summary: {
    totalEmails: number
    totalNotifications: number
    successRate: number
    todayEmails: number
    todayNotifications: number
  }
  byCompany: {
    companyName: string
    emailsReceived: number
    notificationsSent: number
    successRate: number
  }[]
  errorsByType: {
    type: string
    count: number
    percentage: number
  }[]
}

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1']

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [notifications, setNotifications] = useState<NotificationLog[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterLevel, setFilterLevel] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSource, setFilterSource] = useState('') // 발주알림/대량공지 필터
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 20

  const { toast } = useToast()

  // 로그 데이터 로드
  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        startDate: dateRange.start,
        endDate: dateRange.end,
      })

      if (filterLevel) params.append('level', filterLevel)
      if (filterCategory) params.append('category', filterCategory)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.data)
        setTotalPages(data.pagination.pages)
      } else {
        toast({
          title: '오류',
          description: data.error || '로그를 불러오는데 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 알림 로그 데이터 로드
  const fetchNotifications = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        startDate: dateRange.start,
        endDate: dateRange.end,
      })

      if (searchTerm) params.append('search', searchTerm)
      if (filterSource) params.append('source', filterSource)

      const response = await fetch(`/api/notifications/logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setNotifications(data.data || [])
        setTotalPages(data.pagination?.pages || 1)
      } else {
        toast({
          title: '오류',
          description: data.error || '알림 로그를 불러오는데 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 통계 데이터 로드
  const fetchStatistics = async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      })

      const response = await fetch(`/api/statistics?${params}`)
      const data = await response.json()

      if (data.success) {
        setStatistics(data.data)
      } else {
        toast({
          title: '오류',
          description: data.error || '통계를 불러오는데 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 전체 데이터 로드
  const loadAllData = async () => {
    setLoading(true)
    await Promise.all([
      fetchLogs(),
      fetchNotifications(),
      fetchStatistics()
    ])
    setLoading(false)
  }

  // CSV 내보내기
  const exportToCsv = async (type: 'logs' | 'notifications') => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
        format: 'csv'
      })

      const response = await fetch(`/api/${type}/export?${params}`)
      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${type}_${dateRange.start}_${dateRange.end}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: '성공',
        description: '데이터를 내보냈습니다.',
      })
    } catch (error) {
      toast({
        title: '오류',
        description: '데이터 내보내기에 실패했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 로그 레벨에 따른 스타일
  const getLogLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <Badge variant="destructive">ERROR</Badge>
      case 'warn':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">WARN</Badge>
      case 'info':
        return <Badge variant="default">INFO</Badge>
      case 'debug':
        return <Badge variant="outline">DEBUG</Badge>
      default:
        return <Badge variant="outline">{level.toUpperCase()}</Badge>
    }
  }

  // 알림 상태에 따른 스타일
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">성공</Badge>
      case 'failed':
        return <Badge variant="destructive">실패</Badge>
      case 'pending':
        return <Badge variant="secondary">대기</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  useEffect(() => {
    loadAllData()
  }, [dateRange, currentPage])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      loadAllData()
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm, filterLevel, filterCategory, filterSource])

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">대시보드</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2">
            <h1 className="text-lg font-semibold">로그 및 통계</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadAllData()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                새로고침
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {/* Date Range Filter */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>조회 기간</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div>
                <label className="text-sm font-medium">시작일</label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">종료일</label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="statistics" className="space-y-6">
          <TabsList>
            <TabsTrigger value="statistics">통계 대시보드</TabsTrigger>
            <TabsTrigger value="notifications">알림 로그</TabsTrigger>
            <TabsTrigger value="system">시스템 로그</TabsTrigger>
          </TabsList>

          {/* Statistics Dashboard */}
          <TabsContent value="statistics" className="space-y-6">
            {statistics && (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">처리된 메일</CardTitle>
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{statistics.summary.totalEmails}</div>
                      <p className="text-xs text-muted-foreground">
                        오늘: {statistics.summary.todayEmails}개
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">발송 알림</CardTitle>
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{statistics.summary.totalNotifications}</div>
                      <p className="text-xs text-muted-foreground">
                        오늘: {statistics.summary.todayNotifications}개
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">성공률</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{statistics.summary.successRate.toFixed(1)}%</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>일별 처리 현황</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={statistics.daily}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="emailsProcessed" fill="#8884d8" name="처리된 메일" />
                          <Bar dataKey="smsSuccess" fill="#82ca9d" name="SMS 성공" />
                          <Bar dataKey="kakaoSuccess" fill="#ffc658" name="카카오톡 성공" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>오류 유형별 분포</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={statistics.errorsByType}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                            label={({ type, percentage }) => `${type} (${percentage}%)`}
                          >
                            {statistics.errorsByType.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Company Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>업체별 발송 현황</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>업체명</TableHead>
                            <TableHead>수신 메일</TableHead>
                            <TableHead>발송 알림</TableHead>
                            <TableHead>성공률</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statistics.byCompany.map((company, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{company.companyName}</TableCell>
                              <TableCell>{company.emailsReceived}</TableCell>
                              <TableCell>{company.notificationsSent}</TableCell>
                              <TableCell>
                                <Badge variant={company.successRate >= 90 ? "default" : "secondary"}>
                                  {company.successRate.toFixed(1)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Notification Logs */}
          <TabsContent value="notifications" className="space-y-6">
            {/* Search and Filter */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <Input
                      placeholder="업체명, 담당자명, 전화번호로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">전체</option>
                    <option value="order">발주 알림</option>
                    <option value="announcement">대량 공지</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCsv('notifications')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    CSV 내보내기
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Notification Logs Table */}
            <Card>
              <CardHeader>
                <CardTitle>알림 발송 로그</CardTitle>
                <CardDescription>
                  SMS와 카카오톡 발송 기록을 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    알림 로그가 없습니다.
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>시간</TableHead>
                          <TableHead>분류</TableHead>
                          <TableHead>유형</TableHead>
                          <TableHead>업체명</TableHead>
                          <TableHead>담당자</TableHead>
                          <TableHead>전화번호</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>재시도</TableHead>
                          <TableHead>메시지</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notifications.map((notification) => (
                          <TableRow key={notification.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {new Date(notification.timestamp).toLocaleString('ko-KR')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={notification.source === 'order' ? 'default' : 'secondary'}>
                                {notification.source === 'order' ? '발주알림' : '대량공지'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {notification.type === 'sms' ? 'SMS' : '카카오톡'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{notification.companyName}</TableCell>
                            <TableCell>{notification.contactName}</TableCell>
                            <TableCell>{notification.phone}</TableCell>
                            <TableCell>{getStatusBadge(notification.status)}</TableCell>
                            <TableCell>
                              {notification.retryCount > 0 && (
                                <Badge variant="outline">{notification.retryCount}회</Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs truncate" title={notification.message}>
                              {notification.message}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-4">
                    <div className="text-sm text-muted-foreground">
                      페이지 {currentPage} / {totalPages}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        이전
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        다음
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Logs */}
          <TabsContent value="system" className="space-y-6">
            {/* Search and Filter */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <Input
                      placeholder="로그 메시지로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <select
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                    className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">모든 레벨</option>
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">모든 카테고리</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="kakao">KakaoTalk</option>
                    <option value="system">System</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCsv('logs')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    CSV 내보내기
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* System Logs Table */}
            <Card>
              <CardHeader>
                <CardTitle>시스템 로그</CardTitle>
                <CardDescription>
                  시스템 동작과 오류 기록을 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    시스템 로그가 없습니다.
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>시간</TableHead>
                          <TableHead>레벨</TableHead>
                          <TableHead>카테고리</TableHead>
                          <TableHead>메시지</TableHead>
                          <TableHead>업체</TableHead>
                          <TableHead>담당자</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {new Date(log.timestamp).toLocaleString('ko-KR')}
                              </div>
                            </TableCell>
                            <TableCell>{getLogLevelBadge(log.level)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {log.category.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md" title={log.message}>
                              {log.message}
                            </TableCell>
                            <TableCell>{log.companyName || '-'}</TableCell>
                            <TableCell>{log.contactName || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-4">
                    <div className="text-sm text-muted-foreground">
                      페이지 {currentPage} / {totalPages}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        이전
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        다음
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}