'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { ArrowLeft, Loader2, Send, Save, Users, Search } from 'lucide-react'
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

export default function NewAnnouncementPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [contactsLoading, setContactsLoading] = useState(true)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const [form, setForm] = useState({
    title: '',
    content: '',
    channel: 'SMS' as 'SMS' | 'KAKAO_ALIMTALK' | 'KAKAO_FRIENDTALK',
    scheduledAt: '',
  })

  // 연락처 목록 조회
  const fetchContacts = async () => {
    try {
      setContactsLoading(true)
      const response = await fetch('/api/contacts?limit=1000')
      const data = await response.json()
      if (data.success && Array.isArray(data.data)) {
        const contactsWithPhone = data.data.filter((c: Contact) => c.phone)
        setContacts(contactsWithPhone)
        // 기본값: 전체 선택
        setSelectedContactIds(new Set(contactsWithPhone.map((c: Contact) => c.id)))
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
      toast({
        title: '오류',
        description: '연락처 목록을 불러오는데 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setContactsLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

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

  const handleSubmit = async (status: 'DRAFT' | 'SEND') => {
    if (!form.title.trim()) {
      toast({ title: '오류', description: '제목을 입력해주세요.', variant: 'destructive' })
      return
    }
    if (!form.content.trim()) {
      toast({ title: '오류', description: '내용을 입력해주세요.', variant: 'destructive' })
      return
    }
    if (selectedContactIds.size === 0) {
      toast({ title: '오류', description: '수신자를 선택해주세요.', variant: 'destructive' })
      return
    }

    try {
      setLoading(true)

      // recipientFilter 구성
      const recipientFilter = selectAll
        ? { all: true }
        : { all: false, contactIds: Array.from(selectedContactIds) }

      // 1. 공지 생성
      const createResponse = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          channel: form.channel,
          scheduledAt: form.scheduledAt || undefined,
          recipientFilter,
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
