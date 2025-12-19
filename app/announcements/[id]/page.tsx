'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Loader2,
  Send,
  Save,
  Trash2,
  RefreshCw,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AppHeader } from '@/components/layout/app-header'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Contact {
  id: string
  name: string
  phone: string
  company: {
    name: string
  } | null
}

interface Announcement {
  id: string
  title: string
  content: string
  channel: 'SMS' | 'KAKAO_ALIMTALK' | 'KAKAO_FRIENDTALK'
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED'
  scheduledAt: string | null
  sentAt: string | null
  completedAt: string | null
  totalRecipients: number
  sentCount: number
  failedCount: number
  recipientFilter: any
  createdAt: string
  updatedAt: string
}

interface Recipient {
  id: string
  contactId: string
  contactName: string
  phone: string
  companyName: string
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED'
  sentAt: string | null
  errorMessage: string | null
}

interface RecipientsData {
  recipients: Recipient[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  stats: {
    total: number
    pending: number
    sent: number
    delivered: number
    failed: number
  }
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: '임시저장', variant: 'secondary' },
  SCHEDULED: { label: '예약됨', variant: 'outline' },
  SENDING: { label: '발송 중', variant: 'default' },
  COMPLETED: { label: '완료', variant: 'default' },
  CANCELLED: { label: '취소됨', variant: 'secondary' },
  FAILED: { label: '실패', variant: 'destructive' },
}

const recipientStatusLabels: Record<string, { label: string; icon: any; color: string }> = {
  PENDING: { label: '대기', icon: Clock, color: 'text-yellow-500' },
  SENT: { label: '발송됨', icon: CheckCircle, color: 'text-blue-500' },
  DELIVERED: { label: '전달됨', icon: CheckCircle, color: 'text-green-500' },
  FAILED: { label: '실패', icon: XCircle, color: 'text-red-500' },
}

const channelLabels: Record<string, string> = {
  SMS: 'SMS',
  KAKAO_ALIMTALK: '알림톡',
  KAKAO_FRIENDTALK: '친구톡',
}

export default function AnnouncementDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()

  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [recipientsData, setRecipientsData] = useState<RecipientsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // 연락처 선택 상태
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    channel: 'SMS' as 'SMS' | 'KAKAO_ALIMTALK' | 'KAKAO_FRIENDTALK',
    scheduledAt: '',
  })

  const isEditable = announcement && ['DRAFT', 'SCHEDULED'].includes(announcement.status)

  // 검색 필터링된 연락처
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts
    const query = searchQuery.toLowerCase()
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        c.company?.name.toLowerCase().includes(query)
    )
  }, [contacts, searchQuery])

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedContactIds(new Set(contacts.map((c) => c.id)))
    } else {
      setSelectedContactIds(new Set())
    }
  }

  // 개별 선택/해제
  const handleSelectContact = (contactId: string, checked: boolean) => {
    const newSet = new Set(selectedContactIds)
    if (checked) {
      newSet.add(contactId)
    } else {
      newSet.delete(contactId)
    }
    setSelectedContactIds(newSet)
    setSelectAll(newSet.size === contacts.length)
  }

  // 연락처 목록 조회
  const fetchContacts = useCallback(async () => {
    try {
      setContactsLoading(true)
      const response = await fetch('/api/contacts?limit=1000')
      const data = await response.json()
      if (data.success) {
        const contactsWithPhone = data.data.contacts.filter((c: Contact) => c.phone)
        setContacts(contactsWithPhone)
        return contactsWithPhone
      }
      return []
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
      return []
    } finally {
      setContactsLoading(false)
    }
  }, [])

  const fetchAnnouncement = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/announcements/${id}`)
      const data = await response.json()

      if (data.success) {
        setAnnouncement(data.data)
        setEditForm({
          title: data.data.title,
          content: data.data.content,
          channel: data.data.channel,
          scheduledAt: data.data.scheduledAt
            ? new Date(data.data.scheduledAt).toISOString().slice(0, 16)
            : '',
        })

        // DRAFT/SCHEDULED일 때 연락처 목록 로드 및 선택 상태 복원
        if (['DRAFT', 'SCHEDULED'].includes(data.data.status)) {
          const contactsList = await fetchContacts()
          const filter = data.data.recipientFilter as {
            all?: boolean
            contactIds?: string[]
          } | null

          if (filter?.all !== false) {
            // 전체 선택
            setSelectAll(true)
            setSelectedContactIds(new Set(contactsList.map((c: Contact) => c.id)))
          } else if (filter?.contactIds && filter.contactIds.length > 0) {
            // 개별 선택 복원
            setSelectAll(false)
            setSelectedContactIds(new Set(filter.contactIds))
          } else {
            // 기본값: 전체 선택
            setSelectAll(true)
            setSelectedContactIds(new Set(contactsList.map((c: Contact) => c.id)))
          }
        }
      } else {
        toast({
          title: '오류',
          description: data.error || '공지를 불러오는데 실패했습니다.',
          variant: 'destructive',
        })
        router.push('/announcements')
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
  }, [id, router, toast, fetchContacts])

  const fetchRecipients = useCallback(async () => {
    try {
      const response = await fetch(`/api/announcements/${id}/recipients`)
      const data = await response.json()
      if (data.success) {
        setRecipientsData(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch recipients:', error)
    }
  }, [id])

  useEffect(() => {
    fetchAnnouncement()
  }, [fetchAnnouncement])

  useEffect(() => {
    if (announcement && ['SENDING', 'COMPLETED', 'FAILED'].includes(announcement.status)) {
      fetchRecipients()
    }
  }, [announcement, fetchRecipients])

  // 발송 중일 때 자동 새로고침
  useEffect(() => {
    if (announcement?.status === 'SENDING') {
      const interval = setInterval(() => {
        fetchAnnouncement()
        fetchRecipients()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [announcement?.status, fetchAnnouncement, fetchRecipients])

  const handleSave = async () => {
    if (selectedContactIds.size === 0) {
      toast({ title: '오류', description: '수신자를 선택해주세요.', variant: 'destructive' })
      return
    }

    try {
      setSaving(true)

      // recipientFilter 구성
      const recipientFilter = selectAll
        ? { all: true }
        : { all: false, contactIds: Array.from(selectedContactIds) }

      const response = await fetch(`/api/announcements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          content: editForm.content,
          channel: editForm.channel,
          scheduledAt: editForm.scheduledAt
            ? new Date(editForm.scheduledAt).toISOString()
            : null,
          recipientFilter,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({ title: '저장 완료', description: '공지가 저장되었습니다.' })
        fetchAnnouncement()
      } else {
        toast({
          title: '오류',
          description: data.error || '저장에 실패했습니다.',
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
      setSaving(false)
    }
  }

  const handleSend = async () => {
    try {
      setSending(true)
      const response = await fetch(`/api/announcements/${id}/send`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        toast({ title: '발송 시작', description: data.message })
        fetchAnnouncement()
      } else {
        toast({
          title: '오류',
          description: data.error || '발송 시작에 실패했습니다.',
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
      setSending(false)
    }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({ title: '삭제 완료', description: '공지가 삭제되었습니다.' })
        router.push('/announcements')
      } else {
        toast({
          title: '오류',
          description: data.error || '삭제에 실패했습니다.',
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
    setShowDeleteDialog(false)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR')
  }

  if (loading) {
    return (
      <>
        <AppHeader />
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </>
    )
  }

  if (!announcement) {
    return null
  }

  const statusInfo = statusLabels[announcement.status]

  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/announcements')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{announcement.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                <span className="text-sm text-muted-foreground">
                  {channelLabels[announcement.channel]}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditable && (
              <>
                <Button variant="outline" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  저장
                </Button>
                <Button onClick={handleSend} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  발송
                </Button>
                <Button variant="destructive" size="icon" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {announcement.status === 'SENDING' && (
              <Button variant="outline" onClick={fetchAnnouncement}>
                <RefreshCw className="h-4 w-4 mr-2" />
                새로고침
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          {/* 공지 내용 */}
          <Card>
            <CardHeader>
              <CardTitle>공지 내용</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditable ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="title">제목</Label>
                    <Input
                      id="title"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">내용</Label>
                    <Textarea
                      id="content"
                      value={editForm.content}
                      onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                      rows={6}
                      maxLength={1000}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>채널</Label>
                      <Select
                        value={editForm.channel}
                        onValueChange={(value) => setEditForm({ ...editForm, channel: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SMS">SMS</SelectItem>
                          <SelectItem value="KAKAO_ALIMTALK">알림톡</SelectItem>
                          <SelectItem value="KAKAO_FRIENDTALK">친구톡</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>예약 발송</Label>
                      <Input
                        type="datetime-local"
                        value={editForm.scheduledAt}
                        onChange={(e) => setEditForm({ ...editForm, scheduledAt: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="whitespace-pre-wrap bg-muted p-4 rounded-lg">
                  {announcement.content}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 수신자 설정 (DRAFT/SCHEDULED) */}
          {isEditable && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  수신자 설정
                </CardTitle>
                <CardDescription>공지를 받을 대상을 선택하세요.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 전체 선택 체크박스 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allRecipients"
                      checked={selectAll}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                    <Label htmlFor="allRecipients" className="font-medium">
                      전체 연락처에게 발송 ({contacts.length}명)
                    </Label>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    선택됨: {selectedContactIds.size}명
                  </span>
                </div>

                {/* 검색 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="이름, 전화번호, 업체명으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* 연락처 목록 */}
                <div className="border rounded-lg">
                  {contactsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">연락처 로딩 중...</span>
                    </div>
                  ) : contacts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      발송 가능한 연락처가 없습니다.
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="divide-y">
                        {filteredContacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="flex items-center px-4 py-3 hover:bg-muted/50"
                          >
                            <Checkbox
                              id={`contact-${contact.id}`}
                              checked={selectedContactIds.has(contact.id)}
                              onCheckedChange={(checked) =>
                                handleSelectContact(contact.id, checked as boolean)
                              }
                            />
                            <label
                              htmlFor={`contact-${contact.id}`}
                              className="flex-1 ml-3 cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium">{contact.name}</span>
                                  {contact.company && (
                                    <span className="text-muted-foreground ml-2">
                                      ({contact.company.name})
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {contact.phone}
                                </span>
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* 선택 현황 */}
                {!contactsLoading && contacts.length > 0 && (
                  <div className="flex items-center justify-between text-sm border-t pt-4">
                    <span className="text-muted-foreground">
                      {searchQuery && `검색 결과: ${filteredContacts.length}명 / `}
                      전체: {contacts.length}명
                    </span>
                    <span className="font-medium text-primary">
                      발송 대상: {selectedContactIds.size}명
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 발송 현황 */}
          {['SENDING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(announcement.status) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  발송 현황
                </CardTitle>
                <CardDescription>
                  발송 시작: {formatDate(announcement.sentAt)}
                  {announcement.completedAt && ` | 완료: ${formatDate(announcement.completedAt)}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{announcement.totalRecipients}</p>
                    <p className="text-sm text-muted-foreground">전체</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{announcement.sentCount}</p>
                    <p className="text-sm text-muted-foreground">성공</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{announcement.failedCount}</p>
                    <p className="text-sm text-muted-foreground">실패</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">
                      {announcement.totalRecipients - announcement.sentCount - announcement.failedCount}
                    </p>
                    <p className="text-sm text-muted-foreground">대기</p>
                  </div>
                </div>

                {recipientsData && recipientsData.recipients.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>수신자</TableHead>
                        <TableHead>전화번호</TableHead>
                        <TableHead>업체</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>발송 시간</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipientsData.recipients.map((recipient) => {
                        const statusInfo = recipientStatusLabels[recipient.status]
                        const StatusIcon = statusInfo.icon
                        return (
                          <TableRow key={recipient.id}>
                            <TableCell>{recipient.contactName}</TableCell>
                            <TableCell>{recipient.phone}</TableCell>
                            <TableCell>{recipient.companyName}</TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 ${statusInfo.color}`}>
                                <StatusIcon className="h-4 w-4" />
                                {statusInfo.label}
                              </div>
                              {recipient.errorMessage && (
                                <p className="text-xs text-red-500 mt-1">{recipient.errorMessage}</p>
                              )}
                            </TableCell>
                            <TableCell>{formatDate(recipient.sentAt)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 삭제 확인 다이얼로그 */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>공지 삭제</DialogTitle>
              <DialogDescription>
                정말로 이 공지를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                취소
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
