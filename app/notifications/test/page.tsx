'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Send, Loader2, CheckCircle2, XCircle } from 'lucide-react'

export default function NotificationTestPage() {
  const [type, setType] = useState('SMS')
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [templateCode, setTemplateCode] = useState('')
  const [variables, setVariables] = useState('{}')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()

  const handleSend = async () => {
    try {
      setSending(true)
      setResult(null)

      // 변수 파싱
      let parsedVariables = {}
      if (variables.trim()) {
        try {
          parsedVariables = JSON.parse(variables)
        } catch (e) {
          toast({
            title: '오류',
            description: '변수 JSON 형식이 올바르지 않습니다.',
            variant: 'destructive',
          })
          return
        }
      }

      const requestBody: any = {
        type,
        recipient,
        templateName: templateCode || 'TEST_TEMPLATE',
        variables: parsedVariables,
      }

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      setResult(data)

      if (data.success) {
        toast({
          title: '전송 성공',
          description: `메시지가 성공적으로 전송되었습니다. (ID: ${data.data?.messageId || 'N/A'})`,
        })
      } else {
        toast({
          title: '전송 실패',
          description: data.error || '메시지 전송에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
      setResult({ success: false, error: '네트워크 오류' })
    } finally {
      setSending(false)
    }
  }

  // 템플릿 예제
  const loadTemplate = (templateType: string) => {
    if (templateType === 'order_received') {
      setType('SMS')
      setMessage('안녕하세요, #{고객명}님. 발주가 접수되었습니다. 예상 납품일: #{납품일} #{납품시간}')
      setVariables(JSON.stringify({
        고객명: '홍길동',
        납품일: '2025년 1월 15일 (수)',
        납품시간: '오전',
      }, null, 2))
      setTemplateCode('ORDER_RECEIVED_SMS')
    } else if (templateType === 'kakao_order') {
      setType('KAKAO_ALIMTALK')
      setMessage('안녕하세요, #{고객명}님.\n\n발주가 접수되었습니다.\n예상 납품일: #{납품일} #{납품시간}\n\n감사합니다.')
      setVariables(JSON.stringify({
        고객명: '김철수',
        납품일: '2025년 1월 16일 (목)',
        납품시간: '오후',
      }, null, 2))
      setTemplateCode('ORDER_RECEIVED_KAKAO')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">대시보드</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2">
            <h1 className="text-lg font-semibold">알림 전송 테스트</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* 왼쪽: 입력 폼 */}
          <div className="space-y-6">
            {/* 템플릿 빠른 로드 */}
            <Card>
              <CardHeader>
                <CardTitle>템플릿 예제</CardTitle>
                <CardDescription>미리 정의된 템플릿을 불러와 테스트하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => loadTemplate('order_received')}
                >
                  📱 발주 접수 알림 (SMS)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => loadTemplate('kakao_order')}
                >
                  💬 발주 접수 알림 (카카오 알림톡)
                </Button>
              </CardContent>
            </Card>

            {/* 설정 */}
            <Card>
              <CardHeader>
                <CardTitle>메시지 설정</CardTitle>
                <CardDescription>발송할 메시지 정보를 입력하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">메시지 타입</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMS">SMS (문자메시지)</SelectItem>
                      <SelectItem value="KAKAO_ALIMTALK">카카오 알림톡</SelectItem>
                      <SelectItem value="KAKAO_FRIENDTALK">카카오 친구톡</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipient">수신번호</Label>
                  <Input
                    id="recipient"
                    placeholder="010-1234-5678"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </div>

                {type === 'KAKAO_ALIMTALK' && (
                  <div className="space-y-2">
                    <Label htmlFor="templateCode">템플릿 코드</Label>
                    <Input
                      id="templateCode"
                      placeholder="ORDER_RECEIVED_KAKAO"
                      value={templateCode}
                      onChange={(e) => setTemplateCode(e.target.value)}
                    />
                  </div>
                )}

                {type === 'SMS' && (
                  <div className="space-y-2">
                    <Label htmlFor="subject">제목 (LMS만 해당)</Label>
                    <Input
                      id="subject"
                      placeholder="발주 접수 알림"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="message">메시지 내용</Label>
                  <Textarea
                    id="message"
                    placeholder="안녕하세요, #{고객명}님..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    {message.length}자 / {type === 'SMS' ? (message.length <= 90 ? 'SMS' : 'LMS') : '알림톡'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="variables">변수 (JSON 형식)</Label>
                  <Textarea
                    id="variables"
                    placeholder='{"고객명": "홍길동", "납품일": "2025-01-15"}'
                    value={variables}
                    onChange={(e) => setVariables(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>

                <Button
                  onClick={handleSend}
                  disabled={sending || !recipient || !message}
                  className="w-full"
                  size="lg"
                >
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      전송 중...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      메시지 전송
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 오른쪽: 결과 */}
          <div className="space-y-6">
            {/* 전송 결과 */}
            {result && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    전송 {result.success ? '성공' : '실패'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {result.success && result.data && (
                      <>
                        <div>
                          <span className="font-medium">메시지 ID:</span>{' '}
                          <code className="bg-gray-100 px-1 rounded">{result.data.messageId || 'N/A'}</code>
                        </div>
                        <div>
                          <span className="font-medium">Provider:</span> {result.data.provider || 'N/A'}
                        </div>
                        {result.data.failoverUsed && (
                          <div className="text-yellow-600">
                            ⚠️ SMS Failover 사용됨
                          </div>
                        )}
                      </>
                    )}
                    {!result.success && (
                      <div className="text-red-600">
                        <span className="font-medium">오류:</span> {result.error || '알 수 없는 오류'}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 안내 사항 */}
            <Card>
              <CardHeader>
                <CardTitle>⚠️ 주의사항</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="font-medium text-yellow-900 mb-2">테스트 모드</p>
                  <p className="text-yellow-800">
                    현재 <code className="bg-yellow-100 px-1 rounded">ENABLE_REAL_NOTIFICATIONS=false</code>인 경우 실제 메시지가 발송되지 않고 로그에만 기록됩니다.
                  </p>
                </div>

                <div className="space-y-1 text-muted-foreground">
                  <p>• SMS는 90자 이하면 SMS, 초과하면 LMS로 전송됩니다</p>
                  <p>• 카카오 알림톡은 사전에 승인된 템플릿만 사용 가능합니다</p>
                  <p>• 발신번호는 SOLAPI에 등록된 번호여야 합니다</p>
                  <p>• 실제 발송 시 비용이 발생할 수 있습니다</p>
                </div>
              </CardContent>
            </Card>

            {/* 환경 정보 */}
            <Card>
              <CardHeader>
                <CardTitle>환경 설정</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm font-mono">
                  <div>
                    <span className="text-muted-foreground">SMS_PROVIDER:</span>{' '}
                    <code className="bg-gray-100 px-1 rounded">
                      {process.env.NEXT_PUBLIC_SMS_PROVIDER || 'solapi'}
                    </code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">NODE_ENV:</span>{' '}
                    <code className="bg-gray-100 px-1 rounded">
                      {process.env.NODE_ENV}
                    </code>
                  </div>
                  <div className="pt-2 text-xs text-muted-foreground">
                    실제 환경 설정은 서버 환경변수를 확인하세요.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
