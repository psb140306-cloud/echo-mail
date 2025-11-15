'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, RefreshCw, AlertCircle } from 'lucide-react'

interface SMSConnectionStatus {
  connected: boolean
  balance: number
  senderNumbers: string[]
  error: string | null
}

interface SystemSMSSettings {
  enabled: boolean
  provider: 'aligo' | 'ncp' | 'solapi'
  apiKey: string
  apiSecret: string
  senderId: string
  testMode: boolean
  connection: SMSConnectionStatus
  source: string
  readonly: boolean
}

export default function AdminSMSSettings() {
  const [settings, setSettings] = useState<SystemSMSSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/sms/settings')
      console.log('[SMS Settings] API 응답 상태:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('[SMS Settings] 로드된 데이터:', data)
        setSettings(data)
      } else {
        const errorText = await response.text()
        console.error('[SMS Settings] API 오류:', response.status, errorText)
        toast.error(`설정을 불러오는데 실패했습니다 (${response.status})`)
      }
    } catch (error) {
      console.error('[SMS Settings] 설정 로드 실패:', error)
      toast.error('설정을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const refreshConnection = async () => {
    setRefreshing(true)
    await loadSettings()
    setRefreshing(false)
    toast.success('연결 상태를 새로고침했습니다')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
          <p className="text-gray-500">설정을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            SMS 설정을 불러올 수 없습니다. 환경변수를 확인하세요.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'solapi': return '솔라피 (Solapi)'
      case 'ncp': return '네이버 클라우드 플랫폼 (NCP)'
      case 'aligo': return '알리고 (Aligo)'
      default: return provider
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          SMS 발송 설정
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          시스템 전체에서 사용할 SMS API 설정을 확인합니다 (환경변수)
        </p>
      </div>

      {/* SMS 설정 정보 카드 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>SMS 설정 정보 (읽기 전용)</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshConnection}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              SMS 설정은 환경변수로 관리됩니다. 수정하려면 Railway 또는 Vercel 대시보드에서 환경변수를 변경하세요.
            </AlertDescription>
          </Alert>

          {/* 서버 연결 상태 */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                서버 연결
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {getProviderName(settings.provider)} API
              </p>
            </div>
            <div className="flex items-center gap-2">
              {settings.connection.connected ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <Badge variant="default" className="bg-green-500">
                    연결됨
                  </Badge>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-500" />
                  <Badge variant="destructive">
                    연결 실패
                  </Badge>
                </>
              )}
            </div>
          </div>

          {/* 에러 메시지 */}
          {settings.connection.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {settings.connection.error}
              </AlertDescription>
            </Alert>
          )}

          {/* 구분선 */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

          {/* 설정 정보 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SMS 발송 활성화 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                SMS 발송 활성화
              </p>
              <Badge variant={settings.enabled ? 'default' : 'secondary'}>
                {settings.enabled ? '활성화' : '비활성화'}
              </Badge>
            </div>

            {/* 테스트 모드 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                테스트 모드
              </p>
              <Badge variant={settings.testMode ? 'secondary' : 'default'}>
                {settings.testMode ? '테스트 모드' : '실제 발송'}
              </Badge>
            </div>

            {/* SMS 제공업체 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                SMS 제공업체
              </p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {getProviderName(settings.provider)}
              </p>
            </div>

            {/* 기본 발신번호 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                기본 발신번호
              </p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {settings.senderId || '설정되지 않음'}
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                API Key
              </p>
              <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                {settings.apiKey || '설정되지 않음'}
              </p>
            </div>

            {/* API Secret */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                API Secret
              </p>
              <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                {settings.apiSecret || '설정되지 않음'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 환경변수 설정 안내 */}
      <Card>
        <CardHeader>
          <CardTitle>📌 환경변수 설정 방법</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>
            SMS 설정을 변경하려면 다음 환경변수를 Railway 또는 Vercel 대시보드에서 수정하세요:
          </p>
          <div className="space-y-4">
            <div>
              <p className="font-medium mb-2">공통 설정:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">SMS_PROVIDER</code>
                  : SMS 제공업체 (solapi 또는 ncp)
                </li>
                <li>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">ENABLE_REAL_NOTIFICATIONS</code>
                  : 실제 발송 여부 (true/false)
                </li>
              </ul>
            </div>

            <div>
              <p className="font-medium mb-2">솔라피 (Solapi) 설정:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">SOLAPI_API_KEY</code>
                  : 솔라피 API Key
                </li>
                <li>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">SOLAPI_API_SECRET</code>
                  : 솔라피 API Secret
                </li>
                <li>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">SOLAPI_SENDER_PHONE</code>
                  : 기본 발신번호
                </li>
              </ul>
            </div>

            <div>
              <p className="font-medium mb-2">NCP (네이버 클라우드) 설정:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">NCP_SERVICE_ID</code>
                  : NCP SMS Service ID
                </li>
                <li>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">NCP_ACCESS_KEY</code>
                  : NCP Access Key
                </li>
                <li>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">NCP_SECRET_KEY</code>
                  : NCP Secret Key
                </li>
                <li>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">NCP_SENDER_PHONE</code>
                  : 기본 발신번호
                </li>
              </ul>
            </div>
          </div>
          <p className="text-amber-600 dark:text-amber-500">
            ⚠️ 환경변수 변경 후 서버를 재시작해야 적용됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
