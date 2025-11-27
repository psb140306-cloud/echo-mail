'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Search, Phone, Building2, User, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Recipient {
  recipient: string
  companyName: string | null
  contactName: string | null
  totalSent: number
  successCount: number
  failedCount: number
  lastSentAt: string | null
  lastStatus: string | null
  isBlocked: boolean
}

interface RecipientsData {
  recipients: Recipient[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    totalRecipients: number
    problematicCount: number
  }
}

interface NotificationLog {
  id: string
  type: string
  recipient: string
  message: string
  status: string
  createdAt: string
  sentAt: string | null
  errorMessage: string | null
  company: { name: string } | null
}

export function RecipientsTab() {
  const [data, setData] = useState<RecipientsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null)
  const [history, setHistory] = useState<NotificationLog[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const { toast } = useToast()

  const fetchRecipients = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        filter,
        page: page.toString(),
        limit: '20',
      })
      if (search) {
        params.set('search', search)
      }

      const response = await fetch(`/api/notifications/recipients?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast({
          title: '오류',
          description: result.error || '수신자 목록을 불러오는데 실패했습니다.',
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

  const fetchHistory = async (recipient: string) => {
    try {
      setHistoryLoading(true)
      const response = await fetch(
        `/api/notifications/recipients?action=history&recipient=${encodeURIComponent(recipient)}`
      )
      const result = await response.json()

      if (result.success) {
        setHistory(result.data)
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '발송 내역을 불러오는데 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchRecipients()
  }, [filter, page])

  const handleSearch = () => {
    setPage(1)
    fetchRecipients()
  }

  const handleViewHistory = (recipient: string) => {
    setSelectedRecipient(recipient)
    fetchHistory(recipient)
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'SENT':
      case 'DELIVERED':
        return <Badge variant="default" className="bg-green-500">성공</Badge>
      case 'FAILED':
        return <Badge variant="destructive">실패</Badge>
      case 'PENDING':
        return <Badge variant="secondary">대기</Badge>
      case 'PROCESSING':
        return <Badge variant="secondary" className="bg-blue-500 text-white">처리중</Badge>
      default:
        return <Badge variant="outline">-</Badge>
    }
  }

  const formatPhone = (phone: string) => {
    // 전화번호 포맷팅
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 수신자</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.summary.totalRecipients.toLocaleString() || 0}명
            </div>
            <p className="text-xs text-muted-foreground">알림을 받은 고유 번호</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">문제 수신자</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {data?.summary.problematicCount.toLocaleString() || 0}명
            </div>
            <p className="text-xs text-muted-foreground">3회 이상 발송 실패</p>
          </CardContent>
        </Card>
      </div>

      {/* 검색 및 필터 */}
      <Card>
        <CardHeader>
          <CardTitle>수신자 목록</CardTitle>
          <CardDescription>알림을 받은 수신자들의 발송 현황을 확인합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="전화번호 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="failed">실패 있음</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>전화번호</TableHead>
                  <TableHead>업체/담당자</TableHead>
                  <TableHead className="text-center">발송</TableHead>
                  <TableHead className="text-center">성공</TableHead>
                  <TableHead className="text-center">실패</TableHead>
                  <TableHead>최근 상태</TableHead>
                  <TableHead>최근 발송</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.recipients.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      수신자가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recipients.map((recipient) => (
                    <TableRow key={recipient.recipient}>
                      <TableCell className="font-mono">
                        {formatPhone(recipient.recipient)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          {recipient.companyName && (
                            <span className="flex items-center gap-1 text-sm">
                              <Building2 className="h-3 w-3" />
                              {recipient.companyName}
                            </span>
                          )}
                          {recipient.contactName && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {recipient.contactName}
                            </span>
                          )}
                          {!recipient.companyName && !recipient.contactName && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{recipient.totalSent}</TableCell>
                      <TableCell className="text-center text-green-600">
                        {recipient.successCount}
                      </TableCell>
                      <TableCell className="text-center text-red-600">
                        {recipient.failedCount > 0 ? (
                          <span className="flex items-center justify-center gap-1">
                            {recipient.failedCount}
                            {recipient.failedCount >= 3 && (
                              <AlertTriangle className="h-3 w-3 text-orange-500" />
                            )}
                          </span>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(recipient.lastStatus)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {recipient.lastSentAt
                          ? format(new Date(recipient.lastSentAt), 'MM/dd HH:mm', { locale: ko })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewHistory(recipient.recipient)}
                        >
                          상세
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 페이지네이션 */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                이전
              </Button>
              <span className="flex items-center px-4 text-sm">
                {page} / {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
              >
                다음
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 발송 내역 다이얼로그 */}
      <Dialog open={!!selectedRecipient} onOpenChange={() => setSelectedRecipient(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>발송 내역</DialogTitle>
            <DialogDescription>
              {selectedRecipient && formatPhone(selectedRecipient)}
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">발송 내역이 없습니다.</p>
              ) : (
                history.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{log.type}</Badge>
                        {getStatusBadge(log.status)}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}
                      </span>
                    </div>
                    <p className="text-sm bg-muted p-2 rounded">{log.message}</p>
                    {log.errorMessage && (
                      <p className="text-sm text-red-600">
                        오류: {log.errorMessage}
                      </p>
                    )}
                    {log.company && (
                      <p className="text-xs text-muted-foreground">
                        업체: {log.company.name}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
