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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Mail, MailOpen, Search, Inbox, RefreshCw, Trash2, Eye, EyeOff, Plus, SendHorizontal, Lock } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { AppHeader } from '@/components/layout/app-header'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface EmailItem {
  id: string
  messageId: string
  subject: string
  sender: string
  recipient: string
  receivedAt: string
  isRead: boolean
  status: string
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

export default function SentMailPage() {
  const router = useRouter()
  const { toast } = useToast()

  // 상태
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // 검색
  const [search, setSearch] = useState('')

  // 메일 발신 권한
  const [mailSendingEnabled, setMailSendingEnabled] = useState(false)

  // 페이지네이션
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const limit = 20

  // 메일 목록 조회 (SENT 폴더 고정)
  const fetchEmails = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        folder: 'SENT',
      })

      if (search) params.append('search', search)

      const response = await fetch(`/api/mail/list?${params}`)
      const result: EmailListResponse = await response.json()

      if (result.success) {
        setEmails(result.data.emails)
        setTotalPages(result.data.pagination.totalPages)
        setTotalCount(result.data.pagination.totalCount)
        setSelectedIds(new Set())
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

  // 초기 로드
  useEffect(() => {
    fetchEmails()
    loadMailOptions()
  }, [])

  // 페이지 변경 시 재조회
  useEffect(() => {
    fetchEmails()
  }, [page])

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
          <Link href="/mail">
            <Button variant="outline">
              <Inbox className="h-4 w-4 mr-2" />
              받은 메일함
            </Button>
          </Link>
          <Button variant="default">
            <SendHorizontal className="h-4 w-4 mr-2" />
            보낸 메일함
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                보낸 메일 ({totalCount}개)
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
                  title="목록 새로고침"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* 검색 */}
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="제목, 수신자 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
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
                <SendHorizontal className="h-12 w-12 mx-auto mb-2 opacity-50" />
                보낸 메일이 없습니다.
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
                      <TableHead className="w-[200px]">받는 사람</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead className="w-[120px]">발송일시</TableHead>
                      <TableHead className="w-[80px]">작업</TableHead>
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
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="text-sm">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block max-w-[180px] truncate cursor-default">
                                  {email.recipient || '-'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <div className="text-sm">{email.recipient}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/mail/${email.id}`}
                            className="hover:underline"
                          >
                            <span>{email.subject || '(제목 없음)'}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(email.receivedAt), 'MM/dd HH:mm', { locale: ko })}
                        </TableCell>
                        <TableCell>
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
