'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { Mail, Search, Inbox, RefreshCw, Trash2, Eye, EyeOff } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { AppHeader } from '@/components/layout/app-header'

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
  } | null
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

interface EmailDetailResponse {
  success: boolean
  data: {
    id: string
    messageId: string
    subject: string
    sender: string
    recipient: string
    receivedAt: string
    body: string | null
    bodyHtml: string | null
    isRead: boolean
    folder: string
    size: number | null
    isOrder: boolean
    hasAttachment: boolean
    status: string
    company: {
      id: string
      name: string
      email: string
      region: string
    } | null
    notifications: Array<{
      id: string
      type: string
      recipient: string
      status: string
      sentAt: string | null
      deliveredAt: string | null
      errorMessage: string | null
      createdAt: string
    }>
  }
}

export default function MailPage() {
  const router = useRouter()
  const { toast } = useToast()

  // 상태
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [selectedEmail, setSelectedEmail] = useState<EmailDetailResponse['data'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // 필터 및 검색
  const [search, setSearch] = useState('')
  const [folder, setFolder] = useState('INBOX')
  const [isReadFilter, setIsReadFilter] = useState<'all' | 'true' | 'false'>('all')
  const [isOrderFilter, setIsOrderFilter] = useState<'all' | 'true' | 'false'>('all')

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

  // 메일 상세 조회
  const fetchEmailDetail = async (emailId: string) => {
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/mail/${emailId}`)
      const result: EmailDetailResponse = await response.json()

      if (result.success) {
        setSelectedEmail(result.data)
        // 읽음 처리되었으므로 목록도 업데이트
        setEmails((prev) =>
          prev.map((email) =>
            email.id === emailId ? { ...email, isRead: true } : email
          )
        )
      } else {
        toast({
          title: '오류',
          description: '메일을 불러오는데 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('메일 상세 조회 실패:', error)
      toast({
        title: '오류',
        description: '메일을 불러오는데 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setDetailLoading(false)
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
        if (selectedEmail && selectedEmail.id === emailId) {
          setSelectedEmail({ ...selectedEmail, isRead: !currentStatus })
        }
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

  // 메일 삭제
  const deleteEmail = async (emailId: string) => {
    if (!confirm('메일을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/mail/${emailId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        setEmails((prev) => prev.filter((email) => email.id !== emailId))
        if (selectedEmail && selectedEmail.id === emailId) {
          setSelectedEmail(null)
        }
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

  // 초기 로드 및 필터 변경 시 재조회
  useEffect(() => {
    fetchEmails()
  }, [page, folder, isReadFilter, isOrderFilter])

  // 검색어 입력 시 디바운스
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchEmails()
      } else {
        setPage(1) // 페이지를 1로 리셋하면 위 useEffect가 다시 실행됨
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [search])

  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="h-8 w-8" />
          <h1 className="text-3xl font-bold">메일함</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 메일 목록 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  메일 목록 ({totalCount}개)
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchEmails}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
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
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>제목</TableHead>
                        <TableHead className="w-[200px]">발신자</TableHead>
                        <TableHead className="w-[150px]">수신일시</TableHead>
                        <TableHead className="w-[100px]">작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emails.map((email) => (
                        <TableRow
                          key={email.id}
                          className={`cursor-pointer hover:bg-muted/50 ${
                            selectedEmail?.id === email.id ? 'bg-muted' : ''
                          }`}
                          onClick={() => fetchEmailDetail(email.id)}
                        >
                          <TableCell>
                            {email.isRead ? (
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Mail className="h-4 w-4 text-primary" fill="currentColor" />
                            )}
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {email.sender}
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

        {/* 메일 상세 */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>메일 상세</CardTitle>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  로딩 중...
                </div>
              ) : !selectedEmail ? (
                <div className="text-center py-8 text-muted-foreground">
                  메일을 선택하세요.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 제목 */}
                  <div>
                    <h3 className="font-semibold text-lg mb-2">
                      {selectedEmail.subject || '(제목 없음)'}
                    </h3>
                    <div className="flex gap-2">
                      {selectedEmail.isOrder && (
                        <Badge variant="default">발주 메일</Badge>
                      )}
                      {selectedEmail.company && (
                        <Badge variant="outline">{selectedEmail.company.name}</Badge>
                      )}
                    </div>
                  </div>

                  {/* 발신자 */}
                  <div className="text-sm">
                    <span className="text-muted-foreground">발신자:</span>{' '}
                    {selectedEmail.sender}
                  </div>

                  {/* 수신일시 */}
                  <div className="text-sm">
                    <span className="text-muted-foreground">수신일시:</span>{' '}
                    {format(new Date(selectedEmail.receivedAt), 'yyyy-MM-dd HH:mm:ss', {
                      locale: ko,
                    })}
                  </div>

                  {/* 본문 */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">본문</h4>
                    {selectedEmail.bodyHtml ? (
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
                      />
                    ) : selectedEmail.body ? (
                      <pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                        {selectedEmail.body}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">본문이 없습니다.</p>
                    )}
                  </div>

                  {/* 알림 내역 */}
                  {selectedEmail.notifications && selectedEmail.notifications.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-2">알림 발송 내역</h4>
                      <div className="space-y-2">
                        {selectedEmail.notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="text-sm bg-muted p-2 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  notification.status === 'SENT' ||
                                  notification.status === 'DELIVERED'
                                    ? 'default'
                                    : 'destructive'
                                }
                              >
                                {notification.status}
                              </Badge>
                              <span className="text-muted-foreground">
                                {notification.type}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {notification.recipient}
                            </div>
                            {notification.sentAt && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {format(new Date(notification.sentAt), 'yyyy-MM-dd HH:mm')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 업체 정보 */}
                  {selectedEmail.company && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-2">매칭된 업체</h4>
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="text-muted-foreground">업체명:</span>{' '}
                          {selectedEmail.company.name}
                        </div>
                        <div>
                          <span className="text-muted-foreground">이메일:</span>{' '}
                          {selectedEmail.company.email}
                        </div>
                        <div>
                          <span className="text-muted-foreground">지역:</span>{' '}
                          {selectedEmail.company.region}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </>
  )
}
