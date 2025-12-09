'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Mail, MailOpen, Search, Inbox, RefreshCw, Trash2, Eye, EyeOff, MapPin, Send, Plus, SendHorizontal, Lock } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { AppHeader } from '@/components/layout/app-header'

interface NotificationInfo {
  id: string
  type: string
  status: string
  recipient: string
}

interface EmailItem {
  id: string
  messageId: string
  subject: string
  sender: string
  receivedAt: string
  isRead: boolean
  isOrder: boolean
  size: number | null
  hasAttachment: boolean
  status: string
  companyId: string | null
  company: {
    id: string
    name: string
    region: string
  } | null
  notifications: NotificationInfo[]
}

interface EmailListResponse {
  success: boolean
  data: {
    emails: EmailItem[]
    pagination: {
      page: number
      limit: number
      totalCount: number
      totalPages: number
    }
  }
}

export default function MailPage() {
  const router = useRouter()
  const { toast } = useToast()

  // 상태
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // 필터 및 검색
  const [search, setSearch] = useState('')
  const [folder, setFolder] = useState<'INBOX' | 'SENT'>('INBOX')
  const [isReadFilter, setIsReadFilter] = useState<'all' | 'true' | 'false'>('all')
  const [isOrderFilter, setIsOrderFilter] = useState<'all' | 'true' | 'false'>('all')

  // 메일 발신 권한
  const [mailSendingEnabled, setMailSendingEnabled] = useState(false)
  const [showComposeModal, setShowComposeModal] = useState(false)

  // 페이지네이션
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const limit = 20

  // 메일 목록 조회
  const fetchEmails = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        folder,
      })

      if (search) params.append('search', search)
      if (isReadFilter !== 'all') params.append('isRead', isReadFilter)
      if (isOrderFilter !== 'all') params.append('isOrder', isOrderFilter)

      const response = await fetch(`/api/mail/list?${params}`)
      const result: EmailListResponse = await response.json()

      if (result.success) {
        setEmails(result.data.emails)
        setTotalPages(result.data.pagination.totalPages)
        setTotalCount(result.data.pagination.totalCount)
        setSelectedIds(new Set()) // 선택 초기화
      } else {
        toast({
          title: '오류',
          description: '메일 목록을 불러오는데 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('메일 목록 조회 실패:', error)
      toast({
        title: '오류',
        description: '메일 목록을 불러오는데 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // 읽음/안읽음 토글
  const toggleReadStatus = async (emailId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/mail/${emailId}/mark-read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: !currentStatus }),
      })

      const result = await response.json()

      if (result.success) {
        setEmails((prev) =>
          prev.map((email) =>
            email.id === emailId ? { ...email, isRead: !currentStatus } : email
          )
        )
        toast({
          title: '성공',
          description: result.message || '상태가 변경되었습니다.',
        })
      }
    } catch (error) {
      console.error('읽음 상태 변경 실패:', error)
      toast({
        title: '오류',
        description: '상태 변경에 실패했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 단일 메일 삭제
  const deleteEmail = async (emailId: string) => {
    if (!confirm('메일을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/mail/${emailId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        setEmails((prev) => prev.filter((email) => email.id !== emailId))
        setSelectedIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(emailId)
          return newSet
        })
        toast({
          title: '성공',
          description: '메일이 삭제되었습니다.',
        })
      }
    } catch (error) {
      console.error('메일 삭제 실패:', error)
      toast({
        title: '오류',
        description: '메일 삭제에 실패했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 일괄 삭제
  const bulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`선택한 ${selectedIds.size}개의 메일을 삭제하시겠습니까?`)) return

    setBulkDeleting(true)
    try {
      const response = await fetch('/api/mail/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })

      const result = await response.json()

      if (result.success) {
        setEmails((prev) => prev.filter((email) => !selectedIds.has(email.id)))
        setSelectedIds(new Set())
        toast({
          title: '성공',
          description: `${result.data.deletedCount}개의 메일이 삭제되었습니다.`,
        })
      } else {
        toast({
          title: '오류',
          description: result.message || '일괄 삭제에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('일괄 삭제 실패:', error)
      toast({
        title: '오류',
        description: '일괄 삭제에 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setBulkDeleting(false)
    }
  }

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(emails.map((e) => e.id)))
    }
  }

  // 개별 선택/해제
  const toggleSelect = (emailId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(emailId)) {
        newSet.delete(emailId)
      } else {
        newSet.add(emailId)
      }
      return newSet
    })
  }

  // 알림 상태 배지 렌더링
  const renderNotificationBadge = (notifications: NotificationInfo[]) => {
    if (!notifications || notifications.length === 0) return null
    const notification = notifications[0]

    const variant =
      notification.status === 'SENT' || notification.status === 'DELIVERED'
        ? 'default'
        : notification.status === 'PENDING'
        ? 'secondary'
        : 'destructive'

    return (
      <Badge variant={variant} className="text-xs">
        {notification.status}
      </Badge>
    )
  }

  // 메일 옵션 로드
  const loadMailOptions = async () => {
    try {
      const response = await fetch('/api/settings/mail-options')
      if (response.ok) {
        const result = await response.json()
        const data = result.data || result
        setMailSendingEnabled(data.mailSendingEnabled || false)
      }
    } catch (error) {
      console.error('메일 옵션 로드 실패:', error)
    }
  }

  // 초기 로드 및 필터 변경 시 재조회
  useEffect(() => {
    fetchEmails()
    loadMailOptions()
  }, [])

  useEffect(() => {
    fetchEmails()
  }, [page, folder, isReadFilter, isOrderFilter])

  // 검색어 입력 시 디바운스
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchEmails()
      } else {
        setPage(1)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [search])

  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Mail className="h-8 w-8" />
            <h1 className="text-3xl font-bold">메일함</h1>
          </div>
          {mailSendingEnabled ? (
            <Button onClick={() => router.push('/mail/compose')}>
              <Plus className="h-4 w-4 mr-2" />
              메일 쓰기
            </Button>
          ) : (
            <Button variant="outline" disabled title="설정에서 메일 발신 기능을 활성화하세요">
              <Lock className="h-4 w-4 mr-2" />
              메일 쓰기
            </Button>
          )}
        </div>

        {/* 폴더 탭 */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={folder === 'INBOX' ? 'default' : 'outline'}
            onClick={() => {
              setFolder('INBOX')
              setPage(1)
            }}
          >
            <Inbox className="h-4 w-4 mr-2" />
            받은 메일함
          </Button>
          <Button
            variant={folder === 'SENT' ? 'default' : 'outline'}
            onClick={() => {
              setFolder('SENT')
              setPage(1)
            }}
          >
            <SendHorizontal className="h-4 w-4 mr-2" />
            보낸 메일함
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                메일 목록 ({totalCount}개)
              </CardTitle>
              <div className="flex gap-2">
                {selectedIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={bulkDelete}
                    disabled={bulkDeleting}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {bulkDeleting ? '삭제 중...' : `${selectedIds.size}개 삭제`}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchEmails}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* 검색 및 필터 */}
            <div className="space-y-3 mt-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="제목, 발신자, 본문 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Select value={isReadFilter} onValueChange={(v: any) => setIsReadFilter(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="false">안읽음</SelectItem>
                    <SelectItem value="true">읽음</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={isOrderFilter} onValueChange={(v: any) => setIsOrderFilter(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 메일</SelectItem>
                    <SelectItem value="true">발주 메일만</SelectItem>
                    <SelectItem value="false">일반 메일만</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                로딩 중...
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-2 opacity-50" />
                메일이 없습니다.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedIds.size === emails.length && emails.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead className="w-[180px]">발신자</TableHead>
                      <TableHead className="w-[100px]">알림</TableHead>
                      <TableHead className="w-[100px]">지역</TableHead>
                      <TableHead className="w-[120px]">수신일시</TableHead>
                      <TableHead className="w-[100px]">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emails.map((email) => (
                      <TableRow key={email.id}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(email.id)}
                            onCheckedChange={() => toggleSelect(email.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {email.isRead ? (
                            <MailOpen className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Mail className="h-4 w-4 text-primary" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/mail/${email.id}`}
                            className="hover:underline"
                          >
                            <div className="flex items-center gap-2">
                              <span className={email.isRead ? '' : 'font-semibold'}>
                                {email.subject || '(제목 없음)'}
                              </span>
                              {email.isOrder && (
                                <Badge variant="default" className="text-xs">
                                  발주
                                </Badge>
                              )}
                              {email.company && (
                                <Badge variant="outline" className="text-xs">
                                  {email.company.name}
                                </Badge>
                              )}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {email.sender}
                        </TableCell>
                        <TableCell>
                          {renderNotificationBadge(email.notifications)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {email.company?.region && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {email.company.region}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(email.receivedAt), 'MM/dd HH:mm', { locale: ko })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleReadStatus(email.id, email.isRead)
                              }}
                            >
                              {email.isRead ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteEmail(email.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      이전
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      다음
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
