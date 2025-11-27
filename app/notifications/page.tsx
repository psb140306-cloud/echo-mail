'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Bell, Send, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { LogsTab } from '@/components/notifications/logs-tab'
import { StatsTab } from '@/components/notifications/stats-tab'
import { RecipientsTab } from '@/components/notifications/recipients-tab'
import { AppHeader } from '@/components/layout/app-header'

export default function NotificationsPage() {
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('stats')
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


  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Bell className="h-8 w-8" />
            <h1 className="text-3xl font-bold">알림 관리</h1>
          </div>
          <Button variant="outline" onClick={() => setShowTestDialog(true)}>
            <Send className="mr-2 h-4 w-4" />
            테스트 발송
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="stats">발송 통계</TabsTrigger>
            <TabsTrigger value="recipients">수신자 관리</TabsTrigger>
            <TabsTrigger value="logs">발송 내역</TabsTrigger>
          </TabsList>

          {/* 발송 통계 탭 */}
          <TabsContent value="stats" className="space-y-6">
            <StatsTab />
          </TabsContent>

          {/* 수신자 관리 탭 */}
          <TabsContent value="recipients" className="space-y-6">
            <RecipientsTab />
          </TabsContent>

          {/* 발송 내역 탭 */}
          <TabsContent value="logs" className="space-y-6">
            <LogsTab />
          </TabsContent>
        </Tabs>

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
