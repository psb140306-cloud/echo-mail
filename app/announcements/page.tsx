'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Megaphone, Plus, Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AppHeader } from '@/components/layout/app-header'

interface Announcement {
  id: string
  title: string
  channel: 'SMS' | 'KAKAO_ALIMTALK' | 'KAKAO_FRIENDTALK'
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED'
  scheduledAt: string | null
  sentAt: string | null
  completedAt: string | null
  totalRecipients: number
  sentCount: number
  failedCount: number
  createdAt: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: '임시저장', variant: 'secondary' },
  SCHEDULED: { label: '예약됨', variant: 'outline' },
  SENDING: { label: '발송 중', variant: 'default' },
  COMPLETED: { label: '완료', variant: 'default' },
  CANCELLED: { label: '취소됨', variant: 'secondary' },
  FAILED: { label: '실패', variant: 'destructive' },
}

const channelLabels: Record<string, string> = {
  SMS: 'SMS',
  KAKAO_ALIMTALK: '알림톡',
  KAKAO_FRIENDTALK: '친구톡',
}

export default function AnnouncementsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const response = await fetch(`/api/announcements?${params}`)
      const data = await response.json()

      if (data.success) {
        setAnnouncements(data.data.announcements)
        setPagination(data.data.pagination)
      } else {
        toast({
          title: '오류',
          description: data.error || '목록을 불러오는데 실패했습니다.',
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
  }, [pagination.page, pagination.limit, statusFilter, toast])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleRowClick = (id: string) => {
    router.push(`/announcements/${id}`)
  }

  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Megaphone className="h-8 w-8" />
            <h1 className="text-3xl font-bold">대량 공지</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchAnnouncements} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
            <Button onClick={() => router.push('/announcements/new')}>
              <Plus className="h-4 w-4 mr-2" />
              새 공지 작성
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">상태:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="DRAFT">임시저장</SelectItem>
                <SelectItem value="SCHEDULED">예약됨</SelectItem>
                <SelectItem value="SENDING">발송 중</SelectItem>
                <SelectItem value="COMPLETED">완료</SelectItem>
                <SelectItem value="CANCELLED">취소됨</SelectItem>
                <SelectItem value="FAILED">실패</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm text-muted-foreground">
            총 {pagination.total}건
          </span>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">제목</TableHead>
                <TableHead>채널</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>발송 예정</TableHead>
                <TableHead>수신자</TableHead>
                <TableHead>발송 현황</TableHead>
                <TableHead>생성일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : announcements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    등록된 공지가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                announcements.map((announcement) => {
                  const statusInfo = statusLabels[announcement.status]
                  return (
                    <TableRow
                      key={announcement.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(announcement.id)}
                    >
                      <TableCell className="font-medium">{announcement.title}</TableCell>
                      <TableCell>{channelLabels[announcement.channel]}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(announcement.scheduledAt)}
                      </TableCell>
                      <TableCell>{announcement.totalRecipients}명</TableCell>
                      <TableCell>
                        {announcement.status === 'COMPLETED' || announcement.status === 'SENDING' ? (
                          <span>
                            <span className="text-green-600">{announcement.sentCount}</span>
                            {announcement.failedCount > 0 && (
                              <>
                                {' / '}
                                <span className="text-red-600">{announcement.failedCount}</span>
                              </>
                            )}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{formatDate(announcement.createdAt)}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              이전
            </Button>
            <span className="text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              다음
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
