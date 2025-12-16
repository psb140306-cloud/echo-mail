'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { AppHeader } from '@/components/layout/app-header'
import {
  ArrowLeft,
  Mail,
  Settings,
  Save,
  Link2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Building2,
  Users,
  Clock,
  FileText,
  Bell,
  RefreshCw,
  Send,
  Inbox,
  Lock,
  Crown,
  Search,
  Plus,
  X,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { UsageDisplay } from '@/components/subscription/usage-display'

interface TenantSettings {
  mailServer: {
    host: string
    port: number
    username: string
    password: string
    useSSL: boolean
    enabled: boolean
    autoMarkAsRead: boolean
  }
  notification: {
    defaultSMSEnabled: boolean
    defaultKakaoEnabled: boolean
    notifyOnNewOrder: boolean
    notifyOnError: boolean
    retryEnabled: boolean
    retryInterval: number
    maxRetries: number
  }
  business: {
    companyName: string
    businessNumber: string
    address: string
    contactEmail: string
    contactPhone: string
  }
}

interface MailOptions {
  mailMode: 'ORDER_ONLY' | 'FULL_INBOX'
  mailSendingEnabled: boolean
  permissions: {
    canChangeMailMode: boolean
    canEnableMailSending: boolean
  }
  currentPlan: string
}

interface KeywordSettings {
  keywords: string[]
  keywordsDisabled: boolean
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings>({
    mailServer: {
      host: '',
      port: 993,
      username: '',
      password: '',
      useSSL: true,
      enabled: false,
      autoMarkAsRead: true, // 기본값 true - 처리된 메일 자동 읽음 처리
    },
    notification: {
      defaultSMSEnabled: true,
      defaultKakaoEnabled: false, // 기본값 false - 카카오 Provider 미설정 시 중복 발송 방지
      notifyOnNewOrder: true,
      notifyOnError: true,
      retryEnabled: false,
      retryInterval: 10,
      maxRetries: 2,
    },
    business: {
      companyName: '',
      businessNumber: '',
      address: '',
      contactEmail: '',
      contactPhone: '',
    },
  })

  const [loading, setLoading] = useState(false)
  const [testingMail, setTestingMail] = useState(false)
  const [mailboxInfo, setMailboxInfo] = useState<{
    path: string
    exists: number
    messages: number
  } | null>(null)
  const [mailOptions, setMailOptions] = useState<MailOptions>({
    mailMode: 'ORDER_ONLY',
    mailSendingEnabled: false,
    permissions: {
      canChangeMailMode: false,
      canEnableMailSending: false,
    },
    currentPlan: 'FREE_TRIAL',
  })
  const [savingMailOptions, setSavingMailOptions] = useState(false)
  const [keywordSettings, setKeywordSettings] = useState<KeywordSettings>({
    keywords: ['발주', '주문', '구매', '납품', 'order', 'purchase', 'po'],
    keywordsDisabled: false,
  })
  const [newKeyword, setNewKeyword] = useState('')
  const [savingKeywords, setSavingKeywords] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadSettings()
    loadMailOptions()
    loadKeywordSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const result = await response.json()
        // API 응답이 { data: {...} } 형태인지 확인
        const settingsData = result.data || result
        setSettings((prev) => ({
          ...prev,
          ...settingsData,
        }))
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '설정을 불러오는데 실패했습니다',
        variant: 'destructive',
      })
    }
  }

  const loadMailOptions = async () => {
    try {
      const response = await fetch('/api/settings/mail-options')
      if (response.ok) {
        const result = await response.json()
        const data = result.data || result
        setMailOptions({
          mailMode: data.mailMode || 'ORDER_ONLY',
          mailSendingEnabled: data.mailSendingEnabled || false,
          permissions: data.permissions || {
            canChangeMailMode: false,
            canEnableMailSending: false,
          },
          currentPlan: data.currentPlan || 'FREE_TRIAL',
        })
      }
    } catch (error) {
      console.error('메일 옵션 로드 실패:', error)
    }
  }

  const loadKeywordSettings = async () => {
    try {
      const response = await fetch('/api/settings/keywords')
      if (response.ok) {
        const result = await response.json()
        const data = result.data || result
        setKeywordSettings({
          keywords: data.keywords || ['발주', '주문', '구매', '납품', 'order', 'purchase', 'po'],
          keywordsDisabled: data.keywordsDisabled || false,
        })
      }
    } catch (error) {
      console.error('키워드 설정 로드 실패:', error)
    }
  }

  const saveKeywordSettings = async () => {
    setSavingKeywords(true)
    try {
      const response = await fetch('/api/settings/keywords', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(keywordSettings),
      })

      const result = await response.json()

      if (response.ok) {
        // 저장 성공 시 응답 데이터로 상태 업데이트
        const savedData = result.data
        if (savedData) {
          setKeywordSettings({
            keywords: savedData.keywords || keywordSettings.keywords,
            keywordsDisabled: savedData.keywordsDisabled ?? keywordSettings.keywordsDisabled,
          })
        }
        toast({
          title: '성공',
          description: result.message || '키워드 설정이 저장되었습니다',
        })
        // 저장 후 다시 로드하여 서버 상태와 동기화
        await loadKeywordSettings()
      } else {
        toast({
          title: '오류',
          description: result.message || '키워드 설정 저장에 실패했습니다',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '키워드 설정 저장 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setSavingKeywords(false)
    }
  }

  const addKeyword = () => {
    const trimmed = newKeyword.trim()
    if (!trimmed) return
    if (keywordSettings.keywords.includes(trimmed)) {
      toast({
        title: '중복',
        description: '이미 등록된 키워드입니다',
        variant: 'destructive',
      })
      return
    }
    setKeywordSettings({
      ...keywordSettings,
      keywords: [...keywordSettings.keywords, trimmed],
    })
    setNewKeyword('')
  }

  const removeKeyword = (keyword: string) => {
    setKeywordSettings({
      ...keywordSettings,
      keywords: keywordSettings.keywords.filter((k) => k !== keyword),
    })
  }

  const saveMailOptions = async () => {
    setSavingMailOptions(true)
    try {
      const response = await fetch('/api/settings/mail-options', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mailMode: mailOptions.mailMode,
          mailSendingEnabled: mailOptions.mailSendingEnabled,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: '성공',
          description: result.message || '메일 옵션이 저장되었습니다',
        })
      } else {
        toast({
          title: '오류',
          description: result.message || '메일 옵션 저장에 실패했습니다',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '메일 옵션 저장 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setSavingMailOptions(false)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        toast({
          title: '성공',
          description: '설정이 저장되었습니다',
        })

        // 메일 서버 설정이 변경되었으면 스케줄러 리로드 (활성화/비활성화 모두)
        // reloadAllSchedules()가 enabled=true인 테넌트만 스케줄 등록하므로
        // 비활성화 시에도 호출해야 기존 스케줄이 제거됨
        await fetch('/api/scheduler/reload', { method: 'POST' })
      } else {
        throw new Error('설정 저장 실패')
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '설정 저장에 실패했습니다',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const testMailConnection = async () => {
    if (!settings.mailServer.host || !settings.mailServer.username || !settings.mailServer.password) {
      toast({
        title: '입력 오류',
        description: '메일 서버 정보를 모두 입력해주세요',
        variant: 'destructive',
      })
      return
    }

    setTestingMail(true)
    try {
      const response = await fetch('/api/settings/test/mail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings.mailServer),
      })

      const result = await response.json()

      if (result.success) {
        // 메일함 정보 저장
        if (result.data?.mailbox) {
          setMailboxInfo(result.data.mailbox)
        }

        toast({
          title: '연결 성공',
          description: result.message,
        })
      } else {
        setMailboxInfo(null)
        toast({
          title: '연결 실패',
          description: result.message || '메일 서버 연결에 실패했습니다',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '연결 테스트 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setTestingMail(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              대시보드
            </Button>
          </Link>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">시스템 설정</h1>
            <p className="text-gray-500 mt-1">서비스 설정을 관리합니다</p>
          </div>
        </div>

        <div className="mb-6">
          <UsageDisplay />
        </div>

        <Tabs defaultValue="mail" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-[750px]">
            <TabsTrigger value="mail">
              <Mail className="mr-2 h-4 w-4" />
              메일 서버
            </TabsTrigger>
            <TabsTrigger value="keyword">
              <Search className="mr-2 h-4 w-4" />
              키워드
            </TabsTrigger>
            <TabsTrigger value="notification">
              <Bell className="mr-2 h-4 w-4" />
              알림
            </TabsTrigger>
            <TabsTrigger value="business">
              <Building2 className="mr-2 h-4 w-4" />
              사업자 정보
            </TabsTrigger>
            <TabsTrigger value="template">
              <FileText className="mr-2 h-4 w-4" />
              템플릿
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mail">
            <Card>
              <CardHeader>
                <CardTitle>메일 서버 설정</CardTitle>
                <CardDescription>
                  발주 메일을 수신할 메일 서버를 설정합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mail-enabled">메일 모니터링 활성화</Label>
                  <Switch
                    id="mail-enabled"
                    checked={settings.mailServer.enabled}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        mailServer: { ...settings.mailServer, enabled: checked },
                      })
                    }
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mail-host">IMAP 서버</Label>
                    <Input
                      id="mail-host"
                      placeholder="imap.gmail.com"
                      value={settings.mailServer.host}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          mailServer: { ...settings.mailServer, host: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mail-port">포트</Label>
                    <Input
                      id="mail-port"
                      type="number"
                      placeholder="993"
                      value={settings.mailServer.port}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          mailServer: { ...settings.mailServer, port: parseInt(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mail-username">이메일 주소</Label>
                  <Input
                    id="mail-username"
                    type="email"
                    placeholder="your@email.com"
                    value={settings.mailServer.username}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        mailServer: { ...settings.mailServer, username: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mail-password">비밀번호</Label>
                  <Input
                    id="mail-password"
                    type="password"
                    placeholder="앱 비밀번호 입력"
                    value={settings.mailServer.password}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        mailServer: { ...settings.mailServer, password: e.target.value },
                      })
                    }
                  />
                  <p className="text-sm text-gray-500">
                    Gmail의 경우 앱 비밀번호를 사용하세요
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>메일 확인 주기</Label>
                  <p className="text-sm text-muted-foreground">
                    새 메일은 <span className="font-medium text-primary">3분마다</span> 자동으로 확인됩니다
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="use-ssl"
                    checked={settings.mailServer.useSSL}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        mailServer: { ...settings.mailServer, useSSL: checked },
                      })
                    }
                  />
                  <Label htmlFor="use-ssl">SSL/TLS 사용</Label>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-mark-as-read">처리 완료 후 자동 읽음 처리</Label>
                    <p className="text-sm text-muted-foreground">
                      메시지 발송 후 메일을 자동으로 읽음 상태로 변경합니다
                    </p>
                  </div>
                  <Switch
                    id="auto-mark-as-read"
                    checked={settings.mailServer.autoMarkAsRead}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        mailServer: { ...settings.mailServer, autoMarkAsRead: checked },
                      })
                    }
                  />
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={testMailConnection}
                    disabled={testingMail}
                  >
                    {testingMail ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-2 h-4 w-4" />
                    )}
                    연결 테스트
                  </Button>
                </div>

                {/* 메일함 정보 표시 */}
                {mailboxInfo && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                          연결 성공
                        </h4>
                        <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                          <p>
                            <span className="font-medium">메일함:</span> {mailboxInfo.path}
                          </p>
                          <p>
                            <span className="font-medium">전체 메일:</span>{' '}
                            {mailboxInfo.exists === 1000
                              ? '999+개'
                              : `${mailboxInfo.exists.toLocaleString()}개`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 메일 기능 옵션 카드 */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5" />
                  메일 기능 옵션
                </CardTitle>
                <CardDescription>
                  메일 수신 범위와 발신 기능을 설정합니다.
                  {!mailOptions.permissions.canChangeMailMode && (
                    <span className="block mt-1 text-amber-600 dark:text-amber-400">
                      <Crown className="inline h-4 w-4 mr-1" />
                      프로페셔널 플랜 이상에서 사용 가능한 기능입니다.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 메일 모드 선택 */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">메일 수신 범위</Label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* 발주 메일만 */}
                    <div
                      className={`relative rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                        mailOptions.mailMode === 'ORDER_ONLY'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() =>
                        setMailOptions({ ...mailOptions, mailMode: 'ORDER_ONLY' })
                      }
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                          mailOptions.mailMode === 'ORDER_ONLY'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {mailOptions.mailMode === 'ORDER_ONLY' && (
                            <div className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium">발주 메일만</h4>
                          <p className="text-sm text-gray-500 mt-1">
                            발주와 관련된 메일만 수신하고 처리합니다.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 받은 메일 */}
                    <div
                      className={`relative rounded-lg border-2 p-4 transition-colors ${
                        mailOptions.permissions.canChangeMailMode
                          ? 'cursor-pointer hover:border-gray-300'
                          : 'cursor-not-allowed opacity-60'
                      } ${
                        mailOptions.mailMode === 'FULL_INBOX'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                      onClick={() => {
                        if (mailOptions.permissions.canChangeMailMode) {
                          setMailOptions({ ...mailOptions, mailMode: 'FULL_INBOX' })
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                          mailOptions.mailMode === 'FULL_INBOX'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {mailOptions.mailMode === 'FULL_INBOX' && (
                            <div className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            받은 메일
                            {!mailOptions.permissions.canChangeMailMode && (
                              <Lock className="h-4 w-4 text-gray-400" />
                            )}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            받은 메일함 수신 메일을 확인할 수 있습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 메일 발신 기능 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      메일 발신 기능
                      {!mailOptions.permissions.canEnableMailSending && (
                        <Lock className="h-4 w-4 text-gray-400" />
                      )}
                    </Label>
                    <p className="text-sm text-gray-500">
                      메일을 직접 작성하여 발송할 수 있습니다.
                      {!mailOptions.permissions.canEnableMailSending && (
                        <span className="block text-amber-600 dark:text-amber-400">
                          프로페셔널 플랜 이상에서 사용 가능
                        </span>
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={mailOptions.mailSendingEnabled}
                    disabled={!mailOptions.permissions.canEnableMailSending}
                    onCheckedChange={(checked) =>
                      setMailOptions({ ...mailOptions, mailSendingEnabled: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    onClick={saveMailOptions}
                    disabled={savingMailOptions}
                    variant="outline"
                  >
                    {savingMailOptions ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    메일 옵션 저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keyword">
            <Card>
              <CardHeader>
                <CardTitle>발주 키워드 설정</CardTitle>
                <CardDescription>
                  발주 메일 판단에 사용할 키워드를 설정합니다.
                  등록된 업체 이메일에서 온 메일 중 키워드가 포함된 메일만 발주로 처리됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 키워드 사용 안함 토글 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>키워드 사용 안함</Label>
                    <p className="text-sm text-gray-500">
                      활성화 시 등록된 업체 이메일에서 온 모든 메일을 발주로 처리합니다
                    </p>
                  </div>
                  <Switch
                    checked={keywordSettings.keywordsDisabled}
                    onCheckedChange={(checked) =>
                      setKeywordSettings({
                        ...keywordSettings,
                        keywordsDisabled: checked,
                      })
                    }
                  />
                </div>

                <Separator />

                {/* 키워드 목록 */}
                <div className={keywordSettings.keywordsDisabled ? 'opacity-50 pointer-events-none' : ''}>
                  <div className="space-y-4">
                    <Label>등록된 키워드</Label>
                    <div className="flex flex-wrap gap-2">
                      {keywordSettings.keywords.map((keyword) => (
                        <Badge
                          key={keyword}
                          variant="secondary"
                          className="px-3 py-1 text-sm flex items-center gap-1"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removeKeyword(keyword)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {keywordSettings.keywords.length === 0 && (
                        <p className="text-sm text-gray-500">등록된 키워드가 없습니다</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Input
                      placeholder="새 키워드 입력"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addKeyword()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addKeyword}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      추가
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    onClick={saveKeywordSettings}
                    disabled={savingKeywords}
                    variant="outline"
                  >
                    {savingKeywords ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    키워드 설정 저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notification">
            <Card>
              <CardHeader>
                <CardTitle>알림 설정</CardTitle>
                <CardDescription>
                  알림 발송 관련 기본 설정을 관리합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>새 발주 알림</Label>
                      <p className="text-sm text-gray-500">
                        새로운 발주 메일 수신 시 담당자에게 알림을 발송합니다
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification.notifyOnNewOrder}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notification: { ...settings.notification, notifyOnNewOrder: checked },
                        })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>오류 알림</Label>
                      <p className="text-sm text-gray-500">
                        시스템 오류 발생 시 관리자에게 알림을 발송합니다
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification.notifyOnError}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notification: { ...settings.notification, notifyOnError: checked },
                        })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>기본 SMS 발송</Label>
                      <p className="text-sm text-gray-500">
                        새 담당자 등록 시 기본적으로 SMS 수신을 활성화합니다
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification.defaultSMSEnabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notification: { ...settings.notification, defaultSMSEnabled: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>기본 카카오톡 발송</Label>
                      <p className="text-sm text-gray-500">
                        새 담당자 등록 시 기본적으로 카카오톡 수신을 활성화합니다
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification.defaultKakaoEnabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notification: { ...settings.notification, defaultKakaoEnabled: checked },
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 발송 실패 재시도 설정 */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  발송 실패 재시도
                </CardTitle>
                <CardDescription>
                  알림 발송 실패 시 자동 재시도 설정을 관리합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>자동 재시도 활성화</Label>
                    <p className="text-sm text-gray-500">
                      알림 발송 실패 시 설정된 시간 후에 자동으로 재시도합니다
                    </p>
                  </div>
                  <Switch
                    checked={settings.notification.retryEnabled}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notification: { ...settings.notification, retryEnabled: checked },
                      })
                    }
                  />
                </div>

                {settings.notification.retryEnabled && (
                  <>
                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="retry-interval">재시도 간격 (분)</Label>
                        <Input
                          id="retry-interval"
                          type="number"
                          min="5"
                          max="30"
                          value={settings.notification.retryInterval}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              notification: {
                                ...settings.notification,
                                retryInterval: Math.min(30, Math.max(5, parseInt(e.target.value) || 10)),
                              },
                            })
                          }
                        />
                        <p className="text-xs text-gray-500">5~30분 사이로 설정</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max-retries">최대 재시도 횟수</Label>
                        <Input
                          id="max-retries"
                          type="number"
                          min="1"
                          max="3"
                          value={settings.notification.maxRetries}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              notification: {
                                ...settings.notification,
                                maxRetries: Math.min(3, Math.max(1, parseInt(e.target.value) || 2)),
                              },
                            })
                          }
                        />
                        <p className="text-xs text-gray-500">1~3회 사이로 설정</p>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                      <p className="text-blue-800 dark:text-blue-200">
                        <strong>설정 요약:</strong> 발송 실패 시{' '}
                        <strong>{settings.notification.retryInterval}분</strong> 후에 재시도하며,{' '}
                        최대 <strong>{settings.notification.maxRetries}회</strong>까지 재시도합니다.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business">
            <Card>
              <CardHeader>
                <CardTitle>사업자 정보</CardTitle>
                <CardDescription>
                  서비스 운영 사업자 정보를 입력합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">회사명</Label>
                  <Input
                    id="company-name"
                    value={settings.business.companyName}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        business: { ...settings.business, companyName: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business-number">사업자등록번호</Label>
                  <Input
                    id="business-number"
                    placeholder="000-00-00000"
                    value={settings.business.businessNumber}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        business: { ...settings.business, businessNumber: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">주소</Label>
                  <Input
                    id="address"
                    value={settings.business.address}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        business: { ...settings.business, address: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">대표 이메일</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={settings.business.contactEmail}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          business: { ...settings.business, contactEmail: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">대표 전화번호</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      placeholder="02-0000-0000"
                      value={settings.business.contactPhone}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          business: { ...settings.business, contactPhone: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="template">
            <Card>
              <CardHeader>
                <CardTitle>메시지 템플릿</CardTitle>
                <CardDescription>
                  알림 메시지 템플릿을 관리합니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h3 className="font-medium mb-2">현재 템플릿</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">SMS:</span>
                        <p className="text-gray-600 dark:text-gray-400">
                          [발주접수] {'{{companyName}}'}님 발주확인. 납품:{'{{shortDate}}'} {'{{deliveryTime}}'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">카카오톡:</span>
                        <p className="text-gray-600 dark:text-gray-400">
                          안녕하세요, {'{{companyName}}'}님. 발주가 접수되었습니다...
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    템플릿 수정은 관리자에게 문의하세요
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 저장 버튼 - 페이지 하단 */}
        <div className="mt-8 flex justify-end">
          <Button
            onClick={saveSettings}
            disabled={loading}
            size="lg"
            className="flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            설정 저장
          </Button>
        </div>
      </div>
    </div>
  )
}