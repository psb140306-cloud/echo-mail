'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  MessageCircle,
  Bell,
  TrendingUp,
  Play,
  Pause,
  Send,
  Eye,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { TemplatesTab } from '@/components/notifications/templates-tab'
import { LogsTab } from '@/components/notifications/logs-tab'
import { AppHeader } from '@/components/layout/app-header'

interface NotificationStatus {
  sms: {
    provider: string
    balance: number
    available: boolean
  }
  kakao: {
    provider: string
    available: boolean
  }
  queue: {
    processing: boolean
    stats: {
      pending: number
      processing: number
      completed: number
      failed: number
      total: number
    }
  }
}

export default function NotificationsPage() {
  const [status, setStatus] = useState<NotificationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const { toast } = useToast()

  // 테스트 발송 폼
  const [testForm, setTestForm] = useState({
    type: 'SMS',
    recipient: '',
    templateName: 'ORDER_RECEIVED_SMS',
    variables: {
      companyName: '테스트상사',
      deliveryDate: '2025년 1월 20일',
      deliveryTime: '오전',
    },
  })

  // 시스템 상태 조회
  const fetchNotificationStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications/status')
      const data = await response.json()

      if (data.success) {
        setStatus(data.data)
      } else {
        toast({
          title: '오류',
          description: data.error || '상태를 불러오는데 실패했습니다.',
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
      setLoading(false)
    }
  }

  // 큐 제어
  const controlQueue = async (action: 'start' | 'stop') => {
    try {
      const response = await fetch(`/api/notifications/status?action=${action}-queue`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: data.message,
        })
        fetchNotificationStatus()
      } else {
        toast({
          title: '오류',
          description: data.error,
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
  }

  // 테스트 발송
  const sendTestNotification = async () => {
    try {
      setTestLoading(true)

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testForm),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '테스트 알림이 발송되었습니다.',
        })
        setShowTestDialog(false)
      } else {
        toast({
          title: '오류',
          description: data.error || '테스트 발송에 실패했습니다.',
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
      setTestLoading(false)
    }
  }

  // 초기 데이터 로드
  useEffect(() => {
    fetchNotificationStatus()
  }, [])

  // 주기적 상태 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotificationStatus()
    }, 30000) // 30초마다

    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Bell className="h-8 w-8" />
            <h1 className="text-3xl font-bold">알림 관리</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTestDialog(true)}>
              <Send className="mr-2 h-4 w-4" />
              테스트 발송
            </Button>
            {status?.queue.processing ? (
              <Button
                variant="outline"
                onClick={() => controlQueue('stop')}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Pause className="mr-2 h-4 w-4" />큐 중지
              </Button>
            ) : (
              <Button
                onClick={() => controlQueue('start')}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="mr-2 h-4 w-4" />큐 시작
              </Button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="status" className="space-y-6">
            <TabsList>
              <TabsTrigger value="status">시스템 상태</TabsTrigger>
              <TabsTrigger value="queue">큐 관리</TabsTrigger>
              <TabsTrigger value="templates">템플릿 관리</TabsTrigger>
              <TabsTrigger value="logs">발송 내역</TabsTrigger>
            </TabsList>

            {/* 시스템 상태 탭 */}
            <TabsContent value="status" className="space-y-6">
              {/* Provider Status */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">SMS 서비스</CardTitle>
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">
                          {status?.sms.available ? '사용 가능' : '사용 불가'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          잔액: {status?.sms.balance || 0}개
                        </p>
                      </div>
                      <Badge variant={status?.sms.available ? 'default' : 'secondary'}>
                        {status?.sms.provider}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">카카오톡 서비스</CardTitle>
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">
                          {status?.kakao.available ? '사용 가능' : '사용 불가'}
                        </div>
                        <p className="text-xs text-muted-foreground">알림톡/친구톡 지원</p>
                      </div>
                      <Badge variant={status?.kakao.available ? 'default' : 'secondary'}>
                        {status?.kakao.provider}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Queue Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>큐 상태</CardTitle>
                  <CardDescription>알림 큐의 현재 처리 상황을 확인하세요</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-5">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Clock className="h-4 w-4 text-orange-500 mr-1" />
                        <span className="text-sm font-medium">대기</span>
                      </div>
                      <div className="text-2xl font-bold text-orange-600">
                        {status?.queue.stats.pending || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Zap className="h-4 w-4 text-blue-500 mr-1" />
                        <span className="text-sm font-medium">처리중</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">
                        {status?.queue.stats.processing || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                        <span className="text-sm font-medium">완료</span>
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {status?.queue.stats.completed || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                        <span className="text-sm font-medium">실패</span>
                      </div>
                      <div className="text-2xl font-bold text-red-600">
                        {status?.queue.stats.failed || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <TrendingUp className="h-4 w-4 text-gray-500 mr-1" />
                        <span className="text-sm font-medium">총계</span>
                      </div>
                      <div className="text-2xl font-bold">{status?.queue.stats.total || 0}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-center">
                    <Badge
                      variant={status?.queue.processing ? 'default' : 'secondary'}
                      className="px-3 py-1"
                    >
                      {status?.queue.processing ? (
                        <>
                          <Play className="mr-1 h-3 w-3" />큐 처리 중
                        </>
                      ) : (
                        <>
                          <Pause className="mr-1 h-3 w-3" />큐 중지됨
                        </>
                      )}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 큐 관리 탭 */}
            <TabsContent value="queue" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>큐 제어</CardTitle>
                  <CardDescription>알림 큐의 시작/중지 및 상태를 관리하세요</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-semibold">알림 큐 처리</h3>
                      <p className="text-sm text-muted-foreground">
                        현재 상태: {status?.queue.processing ? '실행 중' : '중지됨'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => fetchNotificationStatus()}>
                        <Eye className="mr-2 h-4 w-4" />
                        상태 새로고침
                      </Button>
                      {status?.queue.processing ? (
                        <Button
                          variant="outline"
                          onClick={() => controlQueue('stop')}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Pause className="mr-2 h-4 w-4" />큐 중지
                        </Button>
                      ) : (
                        <Button
                          onClick={() => controlQueue('start')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Play className="mr-2 h-4 w-4" />큐 시작
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 템플릿 관리 탭 */}
            <TabsContent value="templates" className="space-y-6">
              <TemplatesTab />
            </TabsContent>

            {/* 발송 내역 탭 */}
            <TabsContent value="logs" className="space-y-6">
              <LogsTab />
            </TabsContent>
          </Tabs>
        )}

      {/* Test Notification Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>테스트 알림 발송</DialogTitle>
            <DialogDescription>SMS 또는 카카오톡 알림을 테스트해보세요</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                알림 타입
              </Label>
              <select
                id="type"
                value={testForm.type}
                onChange={(e) => setTestForm({ ...testForm, type: e.target.value })}
                className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="SMS">SMS</option>
                <option value="KAKAO_ALIMTALK">카카오 알림톡</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="recipient" className="text-right">
                수신번호
              </Label>
              <Input
                id="recipient"
                value={testForm.recipient}
                onChange={(e) => setTestForm({ ...testForm, recipient: e.target.value })}
                className="col-span-3"
                placeholder="010-0000-0000"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="templateName" className="text-right">
                템플릿
              </Label>
              <select
                id="templateName"
                value={testForm.templateName}
                onChange={(e) => setTestForm({ ...testForm, templateName: e.target.value })}
                className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="ORDER_RECEIVED_SMS">발주 접수 확인 (SMS)</option>
                <option value="ORDER_RECEIVED_KAKAO">발주 접수 확인 (카카오)</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">변수</Label>
              <div className="col-span-3 space-y-2">
                <Input
                  placeholder="업체명"
                  value={testForm.variables.companyName}
                  onChange={(e) =>
                    setTestForm({
                      ...testForm,
                      variables: { ...testForm.variables, companyName: e.target.value },
                    })
                  }
                />
                <Input
                  placeholder="납품일"
                  value={testForm.variables.deliveryDate}
                  onChange={(e) =>
                    setTestForm({
                      ...testForm,
                      variables: { ...testForm.variables, deliveryDate: e.target.value },
                    })
                  }
                />
                <Input
                  placeholder="납품시간"
                  value={testForm.variables.deliveryTime}
                  onChange={(e) =>
                    setTestForm({
                      ...testForm,
                      variables: { ...testForm.variables, deliveryTime: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              취소
            </Button>
            <Button onClick={sendTestNotification} disabled={testLoading || !testForm.recipient}>
              {testLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
