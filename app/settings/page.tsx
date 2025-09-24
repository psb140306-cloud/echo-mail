'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Mail,
  MessageCircle,
  Key,
  Server,
  Settings,
  Save,
  TestTube,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface SystemSettings {
  mailServer: {
    host: string
    port: number
    username: string
    password: string
    useSSL: boolean
    checkInterval: number
    enabled: boolean
  }
  sms: {
    provider: string
    apiKey: string
    apiSecret: string
    senderId: string
    enabled: boolean
    testMode: boolean
  }
  kakao: {
    apiKey: string
    plusFriendId: string
    enabled: boolean
    testMode: boolean
    fallbackToSMS: boolean
  }
  system: {
    timezone: string
    queueSize: number
    retryAttempts: number
    logLevel: string
    enableNotifications: boolean
  }
  templates: {
    smsTemplate: string
    kakaoTemplate: string
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    mailServer: {
      host: '',
      port: 993,
      username: '',
      password: '',
      useSSL: true,
      checkInterval: 5,
      enabled: false
    },
    sms: {
      provider: 'aligo',
      apiKey: '',
      apiSecret: '',
      senderId: '',
      enabled: false,
      testMode: true
    },
    kakao: {
      apiKey: '',
      plusFriendId: '',
      enabled: false,
      testMode: true,
      fallbackToSMS: true
    },
    system: {
      timezone: 'Asia/Seoul',
      queueSize: 1000,
      retryAttempts: 3,
      logLevel: 'info',
      enableNotifications: true
    },
    templates: {
      smsTemplate: '[{companyName}] 발주 확인: {orderDate}까지 납품 예정입니다.',
      kakaoTemplate: '안녕하세요, {companyName}입니다.\n\n발주가 확인되었습니다.\n납품 예정일: {orderDate}\n\n문의사항이 있으시면 연락 주세요.'
    }
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  // 설정 데이터 로드
  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings')
      const data = await response.json()

      if (data.success) {
        setSettings(data.data)
      } else {
        toast({
          title: '오류',
          description: data.error || '설정을 불러오는데 실패했습니다.',
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

  // 설정 저장
  const saveSettings = async () => {
    try {
      setSaving(true)

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '성공',
          description: '설정이 저장되었습니다.',
        })
      } else {
        toast({
          title: '오류',
          description: data.error || '설정 저장에 실패했습니다.',
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

  // 연결 테스트
  const testConnection = async (type: 'mail' | 'sms' | 'kakao') => {
    try {
      setTesting(type)

      const response = await fetch(`/api/settings/test/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings[type === 'mail' ? 'mailServer' : type]),
      })

      const data = await response.json()

      setTestResults(prev => ({
        ...prev,
        [type]: data.success
      }))

      if (data.success) {
        toast({
          title: '연결 성공',
          description: `${type === 'mail' ? '메일 서버' : type === 'sms' ? 'SMS API' : '카카오톡 API'} 연결이 성공했습니다.`,
        })
      } else {
        toast({
          title: '연결 실패',
          description: data.error || '연결 테스트에 실패했습니다.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [type]: false
      }))
      toast({
        title: '연결 실패',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setTesting(null)
    }
  }

  // 설정 값 업데이트
  const updateSetting = (section: keyof SystemSettings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }))
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/40 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">대시보드</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2">
            <h1 className="text-lg font-semibold">시스템 설정</h1>
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              설정 저장
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs defaultValue="mail" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="mail" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              메일 서버
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="kakao" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              카카오톡
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              시스템
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              템플릿
            </TabsTrigger>
          </TabsList>

          {/* Mail Server Settings */}
          <TabsContent value="mail" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>메일 서버 설정</span>
                  <div className="flex items-center gap-2">
                    {testResults.mail !== undefined && (
                      <Badge variant={testResults.mail ? "default" : "destructive"}>
                        {testResults.mail ? (
                          <>
                            <CheckCircle className="mr-1 h-3 w-3" />
                            연결 성공
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            연결 실패
                          </>
                        )}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testConnection('mail')}
                      disabled={testing === 'mail'}
                    >
                      {testing === 'mail' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="mr-2 h-4 w-4" />
                      )}
                      연결 테스트
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  메일을 받아올 IMAP 서버 설정을 입력하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mail-enabled">메일 수신 활성화</Label>
                  <Switch
                    id="mail-enabled"
                    checked={settings.mailServer.enabled}
                    onCheckedChange={(checked) => updateSetting('mailServer', 'enabled', checked)}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mail-host">메일 서버 주소</Label>
                    <Input
                      id="mail-host"
                      placeholder="imap.gmail.com"
                      value={settings.mailServer.host}
                      onChange={(e) => updateSetting('mailServer', 'host', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mail-port">포트</Label>
                    <Input
                      id="mail-port"
                      type="number"
                      placeholder="993"
                      value={settings.mailServer.port}
                      onChange={(e) => updateSetting('mailServer', 'port', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mail-username">사용자명</Label>
                    <Input
                      id="mail-username"
                      placeholder="your-email@company.com"
                      value={settings.mailServer.username}
                      onChange={(e) => updateSetting('mailServer', 'username', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mail-password">비밀번호</Label>
                    <Input
                      id="mail-password"
                      type="password"
                      placeholder="앱 비밀번호 또는 계정 비밀번호"
                      value={settings.mailServer.password}
                      onChange={(e) => updateSetting('mailServer', 'password', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mail-ssl">SSL/TLS 사용</Label>
                    <Switch
                      id="mail-ssl"
                      checked={settings.mailServer.useSSL}
                      onCheckedChange={(checked) => updateSetting('mailServer', 'useSSL', checked)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mail-interval">확인 간격 (분)</Label>
                    <Input
                      id="mail-interval"
                      type="number"
                      min="1"
                      max="60"
                      value={settings.mailServer.checkInterval}
                      onChange={(e) => updateSetting('mailServer', 'checkInterval', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMS Settings */}
          <TabsContent value="sms" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>SMS 발송 설정</span>
                  <div className="flex items-center gap-2">
                    {testResults.sms !== undefined && (
                      <Badge variant={testResults.sms ? "default" : "destructive"}>
                        {testResults.sms ? (
                          <>
                            <CheckCircle className="mr-1 h-3 w-3" />
                            연결 성공
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            연결 실패
                          </>
                        )}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testConnection('sms')}
                      disabled={testing === 'sms'}
                    >
                      {testing === 'sms' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="mr-2 h-4 w-4" />
                      )}
                      연결 테스트
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  SMS 발송을 위한 API 설정을 입력하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sms-enabled">SMS 발송 활성화</Label>
                  <Switch
                    id="sms-enabled"
                    checked={settings.sms.enabled}
                    onCheckedChange={(checked) => updateSetting('sms', 'enabled', checked)}
                  />
                </div>

                <Separator />

                <div>
                  <Label htmlFor="sms-provider">SMS 제공업체</Label>
                  <select
                    id="sms-provider"
                    value={settings.sms.provider}
                    onChange={(e) => updateSetting('sms', 'provider', e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="aligo">알리고 (Aligo)</option>
                    <option value="ncp">네이버 클라우드 플랫폼</option>
                    <option value="solapi">솔라피 (SOLAPI)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sms-key">API 키</Label>
                    <Input
                      id="sms-key"
                      type="password"
                      placeholder="API 키를 입력하세요"
                      value={settings.sms.apiKey}
                      onChange={(e) => updateSetting('sms', 'apiKey', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sms-secret">API 시크릿</Label>
                    <Input
                      id="sms-secret"
                      type="password"
                      placeholder="API 시크릿을 입력하세요"
                      value={settings.sms.apiSecret}
                      onChange={(e) => updateSetting('sms', 'apiSecret', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="sms-sender">발신번호</Label>
                  <Input
                    id="sms-sender"
                    placeholder="01012345678"
                    value={settings.sms.senderId}
                    onChange={(e) => updateSetting('sms', 'senderId', e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="sms-test">테스트 모드</Label>
                  <Switch
                    id="sms-test"
                    checked={settings.sms.testMode}
                    onCheckedChange={(checked) => updateSetting('sms', 'testMode', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* KakaoTalk Settings */}
          <TabsContent value="kakao" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>카카오톡 발송 설정</span>
                  <div className="flex items-center gap-2">
                    {testResults.kakao !== undefined && (
                      <Badge variant={testResults.kakao ? "default" : "destructive"}>
                        {testResults.kakao ? (
                          <>
                            <CheckCircle className="mr-1 h-3 w-3" />
                            연결 성공
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            연결 실패
                          </>
                        )}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testConnection('kakao')}
                      disabled={testing === 'kakao'}
                    >
                      {testing === 'kakao' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="mr-2 h-4 w-4" />
                      )}
                      연결 테스트
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  카카오 비즈메시지 API 설정을 입력하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="kakao-enabled">카카오톡 발송 활성화</Label>
                  <Switch
                    id="kakao-enabled"
                    checked={settings.kakao.enabled}
                    onCheckedChange={(checked) => updateSetting('kakao', 'enabled', checked)}
                  />
                </div>

                <Separator />

                <div>
                  <Label htmlFor="kakao-key">REST API 키</Label>
                  <Input
                    id="kakao-key"
                    type="password"
                    placeholder="카카오 개발자센터에서 발급받은 API 키"
                    value={settings.kakao.apiKey}
                    onChange={(e) => updateSetting('kakao', 'apiKey', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="kakao-friend">플러스친구 ID</Label>
                  <Input
                    id="kakao-friend"
                    placeholder="@your_business_id"
                    value={settings.kakao.plusFriendId}
                    onChange={(e) => updateSetting('kakao', 'plusFriendId', e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="kakao-test">테스트 모드</Label>
                  <Switch
                    id="kakao-test"
                    checked={settings.kakao.testMode}
                    onCheckedChange={(checked) => updateSetting('kakao', 'testMode', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="kakao-fallback">SMS 폴백</Label>
                  <Switch
                    id="kakao-fallback"
                    checked={settings.kakao.fallbackToSMS}
                    onCheckedChange={(checked) => updateSetting('kakao', 'fallbackToSMS', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings */}
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>시스템 설정</CardTitle>
                <CardDescription>
                  전체 시스템 동작에 관한 설정입니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="timezone">시간대</Label>
                  <select
                    id="timezone"
                    value={settings.system.timezone}
                    onChange={(e) => updateSetting('system', 'timezone', e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="Asia/Seoul">Asia/Seoul (한국 표준시)</option>
                    <option value="UTC">UTC (협정 세계시)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="queue-size">큐 최대 크기</Label>
                    <Input
                      id="queue-size"
                      type="number"
                      min="100"
                      max="10000"
                      value={settings.system.queueSize}
                      onChange={(e) => updateSetting('system', 'queueSize', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="retry-attempts">재시도 횟수</Label>
                    <Input
                      id="retry-attempts"
                      type="number"
                      min="1"
                      max="10"
                      value={settings.system.retryAttempts}
                      onChange={(e) => updateSetting('system', 'retryAttempts', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="log-level">로그 레벨</Label>
                  <select
                    id="log-level"
                    value={settings.system.logLevel}
                    onChange={(e) => updateSetting('system', 'logLevel', e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="error">Error (오류만)</option>
                    <option value="warn">Warning (경고 이상)</option>
                    <option value="info">Info (정보 이상)</option>
                    <option value="debug">Debug (모든 로그)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="enable-notifications">알림 시스템 활성화</Label>
                  <Switch
                    id="enable-notifications"
                    checked={settings.system.enableNotifications}
                    onCheckedChange={(checked) => updateSetting('system', 'enableNotifications', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates */}
          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>알림 템플릿</CardTitle>
                <CardDescription>
                  SMS와 카카오톡 발송 시 사용할 템플릿을 설정하세요
                  <br />
                  사용 가능한 변수: {'{companyName}'}, {'{orderDate}'}, {'{contactName}'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="sms-template">SMS 템플릿</Label>
                  <Textarea
                    id="sms-template"
                    placeholder="SMS 메시지 템플릿을 입력하세요..."
                    rows={3}
                    value={settings.templates.smsTemplate}
                    onChange={(e) => updateSetting('templates', 'smsTemplate', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    SMS는 90자 이내로 작성하는 것을 권장합니다.
                  </p>
                </div>

                <div>
                  <Label htmlFor="kakao-template">카카오톡 템플릿</Label>
                  <Textarea
                    id="kakao-template"
                    placeholder="카카오톡 메시지 템플릿을 입력하세요..."
                    rows={6}
                    value={settings.templates.kakaoTemplate}
                    onChange={(e) => updateSetting('templates', 'kakaoTemplate', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    카카오톡은 1000자까지 입력 가능합니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}