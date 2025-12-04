'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Send, Loader2, Paperclip, X } from 'lucide-react'
import { AppHeader } from '@/components/layout/app-header'

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
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [showCcBcc, setShowCcBcc] = useState(false)

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

    if (!body.trim()) {
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
          text: body,
          html: `<div style="white-space: pre-wrap;">${body.replace(/\n/g, '<br>')}</div>`,
          inReplyTo: inReplyTo || undefined,
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
            {/* 받는 사람 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="to">받는 사람</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCcBcc(!showCcBcc)}
                >
                  {showCcBcc ? '숨기기' : '참조/숨은참조'}
                </Button>
              </div>
              <Input
                id="to"
                type="email"
                placeholder="example@email.com (여러 명은 쉼표로 구분)"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>

            {/* 참조/숨은참조 */}
            {showCcBcc && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cc">참조 (CC)</Label>
                  <Input
                    id="cc"
                    type="email"
                    placeholder="참조할 이메일 주소"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bcc">숨은참조 (BCC)</Label>
                  <Input
                    id="bcc"
                    type="email"
                    placeholder="숨은참조 이메일 주소"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
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

            {/* 본문 */}
            <div className="space-y-2">
              <Label htmlFor="body">본문</Label>
              <Textarea
                id="body"
                placeholder="메일 내용을 입력하세요..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={15}
                className="resize-none"
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
                    발송 중...
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
    </>
  )
}
