'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Loader2, Send, Save, Users } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AppHeader } from '@/components/layout/app-header'

interface PreviewResult {
  totalCount: number
  sampleContacts: Array<{
    id: string
    name: string
    phone: string
    companyName: string
    region: string
  }>
  statistics: {
    byRegion: Record<string, number>
    topCompanies: Array<{ name: string; count: number }>
  }
}

export default function NewAnnouncementPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)

  const [form, setForm] = useState({
    title: '',
    content: '',
    channel: 'SMS' as 'SMS' | 'KAKAO_ALIMTALK' | 'KAKAO_FRIENDTALK',
    scheduledAt: '',
    recipientFilter: {
      all: true,
      regions: [] as string[],
      companyIds: [] as string[],
    },
  })

  // 수신자 미리보기
  const fetchPreview = async () => {
    try {
      setPreviewing(true)
      const response = await fetch('/api/announcements/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientFilter: form.recipientFilter }),
      })
      const data = await response.json()
      if (data.success) {
        setPreviewResult(data.data)
      }
    } catch (error) {
      console.error('Preview error:', error)
    } finally {
      setPreviewing(false)
    }
  }

  useEffect(() => {
    fetchPreview()
  }, [form.recipientFilter.all])

  const handleSubmit = async (status: 'DRAFT' | 'SEND') => {
    if (!form.title.trim()) {
      toast({ title: '오류', description: '제목을 입력해주세요.', variant: 'destructive' })
      return
    }
    if (!form.content.trim()) {
      toast({ title: '오류', description: '내용을 입력해주세요.', variant: 'destructive' })
      return
    }

    try {
      setLoading(true)

      // 1. 공지 생성
      const createResponse = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          channel: form.channel,
          scheduledAt: form.scheduledAt || undefined,
          recipientFilter: form.recipientFilter,
        }),
      })

      const createData = await createResponse.json()

      if (!createData.success) {
        toast({
          title: '오류',
          description: createData.error || '공지 생성에 실패했습니다.',
          variant: 'destructive',
        })
        return
      }

      const announcementId = createData.data.id

      // 2. 즉시 발송인 경우 발송 API 호출
      if (status === 'SEND') {
        const sendResponse = await fetch(`/api/announcements/${announcementId}/send`, {
          method: 'POST',
        })
        const sendData = await sendResponse.json()

        if (sendData.success) {
          toast({
            title: '발송 시작',
            description: sendData.message || '공지 발송이 시작되었습니다.',
          })
        } else {
          toast({
            title: '오류',
            description: sendData.error || '발송 시작에 실패했습니다.',
            variant: 'destructive',
          })
        }
      } else {
        toast({
          title: '저장 완료',
          description: '공지가 저장되었습니다.',
        })
      }

      router.push('/announcements')
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

  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">새 공지 작성</h1>
        </div>

        <div className="grid gap-6">
          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>공지 정보</CardTitle>
              <CardDescription>발송할 공지의 기본 정보를 입력하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">제목</Label>
                <Input
                  id="title"
                  placeholder="공지 제목을 입력하세요"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {form.title.length}/100
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">내용</Label>
                <Textarea
                  id="content"
                  placeholder="공지 내용을 입력하세요"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={6}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {form.content.length}/1000
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="channel">발송 채널</Label>
                  <Select
                    value={form.channel}
                    onValueChange={(value) => setForm({ ...form, channel: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMS">SMS</SelectItem>
                      <SelectItem value="KAKAO_ALIMTALK">카카오 알림톡</SelectItem>
                      <SelectItem value="KAKAO_FRIENDTALK">카카오 친구톡</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">예약 발송 (선택)</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 수신자 설정 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                수신자 설정
              </CardTitle>
              <CardDescription>공지를 받을 대상을 선택하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allRecipients"
                  checked={form.recipientFilter.all}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      recipientFilter: { ...form.recipientFilter, all: checked as boolean },
                    })
                  }
                />
                <Label htmlFor="allRecipients">전체 연락처에게 발송</Label>
              </div>

              {!form.recipientFilter.all && (
                <div className="pl-6 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    필터 조건을 설정하면 해당 조건에 맞는 연락처에게만 발송됩니다.
                  </p>
                  {/* TODO: 지역, 업체 필터 UI 추가 */}
                </div>
              )}

              {/* 미리보기 */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">예상 수신자</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchPreview}
                    disabled={previewing}
                  >
                    {previewing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      '새로고침'
                    )}
                  </Button>
                </div>
                {previewResult ? (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">{previewResult.totalCount}명</p>
                    {previewResult.sampleContacts.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        <p>예시: {previewResult.sampleContacts.slice(0, 3).map(c => c.name).join(', ')}
                          {previewResult.totalCount > 3 && ` 외 ${previewResult.totalCount - 3}명`}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">로딩 중...</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 버튼 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.back()} disabled={loading}>
              취소
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSubmit('DRAFT')}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              임시저장
            </Button>
            <Button onClick={() => handleSubmit('SEND')} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {form.scheduledAt ? '예약 발송' : '즉시 발송'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
