'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  MessageSquare,
  Bell,
  Mail,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface NotificationLog {
  id: string
  type: string
  status: string
  recipient: string
  content: string
  errorMessage?: string
  company?: {
    name: string
    contactPerson: string
  }
  createdAt: string
}

interface LogsResponse {
  logs: NotificationLog[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

interface Stats {
  today: number
  thisMonth: number
  byType: Record<string, number>
  byStatus: Record<string, number>
}

export function LogsTab() {
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { toast } = useToast()

  // 발송 내역 조회
  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (typeFilter !== 'all') {
        params.append('type', typeFilter)
      }

      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/notifications/logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.data.logs)
        setTotalPages(data.data.pagination.totalPages)
      } else {
        toast({
          title: '오류',
          description: data.error || '발송 내역을 불러오는데 실패했습니다.',
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
      setLoading(false)
    }
  }

  // 통계 조회
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/notifications/logs?stats=true')
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('통계 조회 실패:', error)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, typeFilter, statusFilter])

  useEffect(() => {
    fetchStats()
  }, [])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'SMS':
        return <MessageSquare className="h-4 w-4" />
      case 'KAKAO_ALIMTALK':
      case 'KAKAO_FRIENDTALK':
        return <Bell className="h-4 w-4" />
      case 'EMAIL':
        return <Mail className="h-4 w-4" />
      default:
        return null
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'SMS':
        return 'SMS'
      case 'KAKAO_ALIMTALK':
        return '카카오 알림톡'
      case 'KAKAO_FRIENDTALK':
        return '카카오 친구톡'
      case 'EMAIL':
        return '이메일'
      default:
        return type
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            성공
          </Badge>
        )
      case 'FAILED':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            실패
          </Badge>
        )
      case 'PENDING':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            대기
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date)
  }

  if (loading && logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* 통계 카드 */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">오늘 발송</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today}</div>
              <p className="text-xs text-muted-foreground">금일 발송 건수</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">이번 달</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisMonth}</div>
              <p className="text-xs text-muted-foreground">월간 발송 건수</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">성공률</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byStatus.SUCCESS && stats.thisMonth > 0
                  ? Math.round((stats.byStatus.SUCCESS / stats.thisMonth) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">이번 달 성공률</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">실패</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byStatus.FAILED || 0}</div>
              <p className="text-xs text-muted-foreground">이번 달 실패 건수</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 발송 내역 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>발송 내역</CardTitle>
              <CardDescription>최근 알림 발송 내역을 확인하세요</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="타입 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 타입</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="KAKAO_ALIMTALK">카카오 알림톡</SelectItem>
                  <SelectItem value="EMAIL">이메일</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="SUCCESS">성공</SelectItem>
                  <SelectItem value="FAILED">실패</SelectItem>
                  <SelectItem value="PENDING">대기</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">발송 내역이 없습니다.</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>타입</TableHead>
                    <TableHead>수신자</TableHead>
                    <TableHead>업체</TableHead>
                    <TableHead>내용</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>발송일시</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(log.type)}
                          <span className="text-sm">{getTypeName(log.type)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-mono">{log.recipient}</div>
                      </TableCell>
                      <TableCell>
                        {log.company ? (
                          <div>
                            <div className="font-medium">{log.company.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {log.company.contactPerson}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <div className="text-sm line-clamp-2">{log.content}</div>
                          {log.errorMessage && (
                            <div className="text-xs text-red-600 mt-1">{log.errorMessage}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(log.createdAt)}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 페이지네이션 */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  페이지 {page} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    이전
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                  >
                    다음
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
