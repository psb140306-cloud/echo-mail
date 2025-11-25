'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Mail, ArrowLeft, Trash2, Building2, MapPin, Bell } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { AppHeader } from '@/components/layout/app-header'

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

export default function MailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { toast } = useToast()

  const [email, setEmail] = useState<EmailDetailResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)

  // 메일 상세 조회
  const fetchEmailDetail = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/mail/${resolvedParams.id}`)
      const result: EmailDetailResponse = await response.json()

      if (result.success) {
        setEmail(result.data)
      } else {
        toast({
          title: '오류',
          description: '메일을 불러오는데 실패했습니다.',
          variant: 'destructive',
        })
        router.push('/mail')
      }
    } catch (error) {
      console.error('메일 상세 조회 실패:', error)
      toast({
        title: '오류',
        description: '메일을 불러오는데 실패했습니다.',
        variant: 'destructive',
      })
      router.push('/mail')
    } finally {
      setLoading(false)
    }
  }

  // 메일 삭제
  const deleteEmail = async () => {
    if (!confirm('메일을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/mail/${resolvedParams.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '성공',
          description: '메일이 삭제되었습니다.',
        })
        router.push('/mail')
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

  useEffect(() => {
    fetchEmailDetail()
  }, [resolvedParams.id])

  if (loading) {
    return (
      <>
        <AppHeader />
        <div className="container mx-auto p-6">
          <div className="text-center py-12 text-muted-foreground">
            로딩 중...
          </div>
        </div>
      </>
    )
  }

  if (!email) {
    return (
      <>
        <AppHeader />
        <div className="container mx-auto p-6">
          <div className="text-center py-12 text-muted-foreground">
            메일을 찾을 수 없습니다.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6">
        {/* 상단 네비게이션 */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/mail')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            목록으로
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={deleteEmail}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            삭제
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 메일 본문 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Mail className="h-6 w-6 mt-1 text-muted-foreground" />
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">
                        {email.subject || '(제목 없음)'}
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        {email.isOrder && (
                          <Badge variant="default">발주 메일</Badge>
                        )}
                        {email.company && (
                          <Badge variant="outline">{email.company.name}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1 pl-9">
                    <div>
                      <span className="font-medium">발신자:</span> {email.sender}
                    </div>
                    <div>
                      <span className="font-medium">수신일시:</span>{' '}
                      {format(new Date(email.receivedAt), 'yyyy년 MM월 dd일 HH:mm:ss', {
                        locale: ko,
                      })}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border-t pt-4">
                  {email.bodyHtml ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                    />
                  ) : email.body ? (
                    <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg">
                      {email.body}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      본문이 없습니다.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 사이드바: 알림 내역 및 업체 정보 */}
          <div className="space-y-6">
            {/* 알림 발송 내역 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  알림 발송 내역
                </CardTitle>
              </CardHeader>
              <CardContent>
                {email.notifications && email.notifications.length > 0 ? (
                  <div className="space-y-3">
                    {email.notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="bg-muted p-3 rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={
                              notification.status === 'SENT' ||
                              notification.status === 'DELIVERED'
                                ? 'default'
                                : notification.status === 'PENDING'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {notification.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {notification.type}
                          </span>
                        </div>
                        <div className="text-sm">{notification.recipient}</div>
                        {notification.sentAt && (
                          <div className="text-xs text-muted-foreground">
                            발송:{' '}
                            {format(new Date(notification.sentAt), 'MM/dd HH:mm')}
                          </div>
                        )}
                        {notification.errorMessage && (
                          <div className="text-xs text-destructive">
                            {notification.errorMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    발송된 알림이 없습니다.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 매칭된 업체 정보 */}
            {email.company && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    매칭된 업체
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground">업체명</div>
                      <div className="font-medium">{email.company.name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">이메일</div>
                      <div className="text-sm">{email.company.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{email.company.region}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
