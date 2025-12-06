'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Send, Loader2, Lock, Crown, Timer, BookUser } from 'lucide-react'
import { AppHeader } from '@/components/layout/app-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { RichTextEditor } from '@/components/mail/rich-text-editor'
import { AttachmentUploader, AttachmentFile } from '@/components/mail/attachment-uploader'
import { AddressAutocomplete } from '@/components/mail/address-autocomplete'
import { SignatureSelector } from '@/components/mail/signature-selector'
import { TemplateSelector } from '@/components/mail/template-selector'
import { SchedulePicker } from '@/components/mail/schedule-picker'
import { AddressBookDialog } from '@/components/mail/address-book-dialog'

export default function ComposeMailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // 답장/전달 시 사용할 파라미터
  const replyTo = searchParams.get('replyTo')
  const inReplyTo = searchParams.get('inReplyTo')
  const initialTo = searchParams.get('to') || ''
  const initialSubject = searchParams.get('subject') || ''

  // 폼 상태
  const [to, setTo] = useState(initialTo)
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState(initialSubject)
  const [bodyHtml, setBodyHtml] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [sending, setSending] = useState(false)
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const [selectedSignature, setSelectedSignature] = useState<{ id: string; content: string } | null>(null)
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null)
  const [editorKey, setEditorKey] = useState(0) // 에디터 리셋용

  // 주소록 팝업 상태
  const [addressBookOpen, setAddressBookOpen] = useState(false)

  // 권한 상태
  const [loading, setLoading] = useState(true)
  const [mailSendingEnabled, setMailSendingEnabled] = useState(false)
  const [canEnableMailSending, setCanEnableMailSending] = useState(false)
  const [canSchedule, setCanSchedule] = useState(false) // 예약 발송 가능 여부

  // 권한 체크
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const response = await fetch('/api/settings/mail-options')
        if (response.ok) {
          const result = await response.json()
          const data = result.data || result
          setMailSendingEnabled(data.mailSendingEnabled || false)
          setCanEnableMailSending(data.permissions?.canEnableMailSending || false)
          // 프로페셔널 이상만 예약 발송 가능
          const plan = data.plan || 'FREE_TRIAL'
          setCanSchedule(['PROFESSIONAL', 'BUSINESS', 'ENTERPRISE'].includes(plan))
        }
      } catch (error) {
        console.error('권한 체크 실패:', error)
      } finally {
        setLoading(false)
      }
    }
    checkPermission()
  }, [])

  // 에디터 변경 핸들러
  const handleEditorChange = (html: string, text: string) => {
    setBodyHtml(html)
    setBodyText(text)
  }

  // 템플릿 선택 핸들러
  const handleTemplateSelect = (template: { subject: string; content: string }) => {
    setSubject(template.subject)
    setBodyHtml(template.content)
    setEditorKey(prev => prev + 1) // 에디터 리셋
  }

  // 서명 선택 핸들러
  const handleSignatureSelect = (signature: { id: string; content: string } | null) => {
    setSelectedSignature(signature)
  }

  // 예약 시간 핸들러
  const handleScheduleChange = (date: Date | null) => {
    setScheduledAt(date)
  }

  // 주소록에서 수신자 선택 핸들러
  const handleAddressBookConfirm = (recipients: { to: string[]; cc: string[]; bcc: string[] }) => {
    // 기존 값에 추가
    if (recipients.to.length > 0) {
      const currentTo = to ? to.split(/[,;]/).map(e => e.trim()).filter(e => e) : []
      const newTo = [...new Set([...currentTo, ...recipients.to])]
      setTo(newTo.join(', '))
    }
    if (recipients.cc.length > 0) {
      const currentCc = cc ? cc.split(/[,;]/).map(e => e.trim()).filter(e => e) : []
      const newCc = [...new Set([...currentCc, ...recipients.cc])]
      setCc(newCc.join(', '))
      setShowCcBcc(true)
    }
    if (recipients.bcc.length > 0) {
      const currentBcc = bcc ? bcc.split(/[,;]/).map(e => e.trim()).filter(e => e) : []
      const newBcc = [...new Set([...currentBcc, ...recipients.bcc])]
      setBcc(newBcc.join(', '))
      setShowCcBcc(true)
    }
  }

  // 최종 HTML (서명 포함)
  const getFinalHtml = () => {
    if (selectedSignature) {
      return `${bodyHtml}<br/><br/>${selectedSignature.content}`
    }
    return bodyHtml
  }

  // 메일 발송
  const handleSend = async () => {
    // 유효성 검사
    if (!to.trim()) {
      toast({
        title: '오류',
        description: '받는 사람을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    if (!subject.trim()) {
      toast({
        title: '오류',
        description: '제목을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    if (!bodyText.trim()) {
      toast({
        title: '오류',
        description: '본문을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    setSending(true)
    try {
      // 이메일 주소 파싱 (쉼표 또는 세미콜론으로 분리)
      const parseEmails = (str: string) => {
        return str
          .split(/[,;]/)
          .map((e) => e.trim())
          .filter((e) => e.length > 0)
      }

      const toEmails = parseEmails(to)
      const ccEmails = cc ? parseEmails(cc) : undefined
      const bccEmails = bcc ? parseEmails(bcc) : undefined

      const finalHtml = getFinalHtml()

      // 예약 발송인 경우
      if (scheduledAt) {
        const response = await fetch('/api/mail/schedule', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: toEmails,
            cc: ccEmails || [],
            bcc: bccEmails || [],
            subject,
            text: bodyText,
            html: finalHtml,
            attachments: attachments.length > 0 ? attachments : undefined,
            scheduledAt: scheduledAt.toISOString(),
          }),
        })

        const result = await response.json()

        if (response.ok) {
          toast({
            title: '예약 완료',
            description: `메일이 예약되었습니다.`,
          })
          router.push('/mail')
        } else {
          toast({
            title: '예약 실패',
            description: result.message || '메일 예약에 실패했습니다.',
            variant: 'destructive',
          })
        }
      } else {
        // 즉시 발송
        const response = await fetch('/api/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: toEmails.length === 1 ? toEmails[0] : toEmails,
            cc: ccEmails,
            bcc: bccEmails,
            subject,
            text: bodyText,
            html: finalHtml,
            inReplyTo: inReplyTo || undefined,
            attachments: attachments.length > 0 ? attachments : undefined,
          }),
        })

        const result = await response.json()

        if (response.ok) {
          toast({
            title: '발송 완료',
            description: result.message || '메일이 성공적으로 발송되었습니다.',
          })
          router.push('/mail')
        } else {
          toast({
            title: '발송 실패',
            description: result.message || '메일 발송에 실패했습니다.',
            variant: 'destructive',
          })
        }
      }
    } catch (error) {
      console.error('메일 발송 오류:', error)
      toast({
        title: '오류',
        description: '메일 발송 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  // 로딩 중
  if (loading) {
    return (
      <>
        <AppHeader />
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </>
    )
  }

  // 권한 없음 - 플랜 미지원
  if (!canEnableMailSending) {
    return (
      <>
        <AppHeader />
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="mb-6">
            <Link href="/mail">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                메일함으로 돌아가기
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">메일 쓰기</h1>
          </div>

          <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
            <Crown className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              프로페셔널 플랜 이상에서 사용 가능
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              메일 발신 기능은 프로페셔널 플랜 이상에서 사용할 수 있습니다.
              <Link href="/pricing" className="ml-2 underline font-medium">
                플랜 업그레이드
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      </>
    )
  }

  // 기능 비활성화
  if (!mailSendingEnabled) {
    return (
      <>
        <AppHeader />
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="mb-6">
            <Link href="/mail">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                메일함으로 돌아가기
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">메일 쓰기</h1>
          </div>

          <Alert variant="default" className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
            <Lock className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">
              메일 발신 기능 비활성화
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              메일 발신 기능이 비활성화되어 있습니다. 설정에서 활성화해주세요.
              <Link href="/settings" className="ml-2 underline font-medium">
                설정으로 이동
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <Link href="/mail">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              메일함으로 돌아가기
            </Button>
          </Link>

          <h1 className="text-3xl font-bold">메일 쓰기</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>새 메일</CardTitle>
            <CardDescription>
              메일을 작성하여 발송합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 템플릿/서명 선택 */}
            <div className="flex flex-wrap items-center gap-4 pb-2">
              <TemplateSelector
                onSelect={handleTemplateSelect}
                currentSubject={subject}
                currentContent={bodyHtml}
                disabled={sending}
              />
              <SignatureSelector
                onSelect={handleSignatureSelect}
                disabled={sending}
              />
            </div>

            <Separator />

            {/* 받는 사람 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="to">받는 사람</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddressBookOpen(true)}
                    disabled={sending}
                  >
                    <BookUser className="mr-2 h-4 w-4" />
                    주소록
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCcBcc(!showCcBcc)}
                  >
                    {showCcBcc ? '숨기기' : '참조/숨은참조'}
                  </Button>
                </div>
              </div>
              <AddressAutocomplete
                id="to"
                value={to}
                onChange={setTo}
                placeholder="이메일 주소 입력 (주소록에서 검색)"
                disabled={sending}
              />
            </div>

            {/* 참조/숨은참조 */}
            {showCcBcc && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cc">참조 (CC)</Label>
                  <AddressAutocomplete
                    id="cc"
                    value={cc}
                    onChange={setCc}
                    placeholder="참조할 이메일 주소"
                    disabled={sending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bcc">숨은참조 (BCC)</Label>
                  <AddressAutocomplete
                    id="bcc"
                    value={bcc}
                    onChange={setBcc}
                    placeholder="숨은참조 이메일 주소"
                    disabled={sending}
                  />
                </div>
              </>
            )}

            {/* 제목 */}
            <div className="space-y-2">
              <Label htmlFor="subject">제목</Label>
              <Input
                id="subject"
                placeholder="메일 제목"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* 본문 - 리치 텍스트 에디터 */}
            <div className="space-y-2">
              <Label>본문</Label>
              <RichTextEditor
                key={editorKey}
                content={bodyHtml}
                onChange={handleEditorChange}
                placeholder="메일 내용을 입력하세요..."
                minHeight="350px"
              />
            </div>

            {/* 첨부파일 */}
            <div className="space-y-2">
              <Label>첨부파일</Label>
              <AttachmentUploader
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                disabled={sending}
              />
            </div>

            <Separator />

            {/* 예약 발송 */}
            <div className="space-y-2">
              <SchedulePicker
                onSchedule={handleScheduleChange}
                disabled={sending}
                canSchedule={canSchedule}
              />
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push('/mail')}
                disabled={sending}
              >
                취소
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {scheduledAt ? '예약 중...' : '발송 중...'}
                  </>
                ) : scheduledAt ? (
                  <>
                    <Timer className="mr-2 h-4 w-4" />
                    예약 발송
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    보내기
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 주소록 팝업 */}
      <AddressBookDialog
        open={addressBookOpen}
        onOpenChange={setAddressBookOpen}
        onConfirm={handleAddressBookConfirm}
      />
    </>
  )
}
