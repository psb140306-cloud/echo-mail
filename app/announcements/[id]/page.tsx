'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AppHeader } from '@/components/layout/app-header'

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

export default function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()

  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [recipientsData, setRecipientsData] = useState<RecipientsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    channel: 'SMS' as 'SMS' | 'KAKAO_ALIMTALK' | 'KAKAO_FRIENDTALK',
    scheduledAt: '',
  })

  const isEditable = announcement && ['DRAFT', 'SCHEDULED'].includes(announcement.status)

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
  }, [id, router, toast])

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
    try {
      setSaving(true)
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
