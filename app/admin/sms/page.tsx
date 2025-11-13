'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface SystemSMSSettings {
  enabled: boolean
  provider: 'aligo' | 'ncp' | 'solapi'
  apiKey: string
  apiSecret: string
  senderPhone: string
  testMode: boolean
}

export default function AdminSMSSettings() {
  const [settings, setSettings] = useState<SystemSMSSettings>({
    enabled: false,
    provider: 'aligo',
    apiKey: '',
    apiSecret: '',
    senderPhone: '',
    testMode: true
  })
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/sms/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('설정 로드 실패:', error)
      toast.error('설정을 불러오는데 실패했습니다')
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/sms/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        toast.success('SMS 설정이 저장되었습니다')
      } else {
        throw new Error('설정 저장 실패')
      }
    } catch (error) {
      console.error('설정 저장 실패:', error)
      toast.error('설정 저장에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    try {
      const response = await fetch('/api/admin/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const result = await response.json()
      if (result.success) {
        toast.success(`연결 테스트 성공! 잔액: ${result.balance}원`)
      } else {
        throw new Error(result.error || '연결 실패')
      }
    } catch (error) {
      console.error('연결 테스트 실패:', error)
      toast.error('연결 테스트 실패')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          SMS 발송 설정
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          시스템 전체에서 사용할 SMS API 설정을 관리합니다
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SMS 발송 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SMS 발송 활성화 */}
          <div className="flex items-center justify-between">
            <div>
              <Label>SMS 발송 활성화</Label>
              <p className="text-sm text-gray-500 mt-1">
                SMS 발송 기능을 활성화합니다
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings({...settings, enabled: checked})
              }
            />
          </div>

          {/* 테스트 모드 */}
          <div className="flex items-center justify-between">
            <div>
              <Label>테스트 모드</Label>
              <p className="text-sm text-gray-500 mt-1">
                실제 SMS를 발송하지 않고 로그만 남깁니다
              </p>
            </div>
            <Switch
              checked={settings.testMode}
              onCheckedChange={(checked) =>
                setSettings({...settings, testMode: checked})
              }
            />
          </div>

          {/* SMS 제공업체 */}
          <div>
            <Label>SMS 제공업체</Label>
            <Select
              value={settings.provider}
              onValueChange={(value: 'aligo' | 'ncp' | 'solapi') =>
                setSettings({...settings, provider: value})
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aligo">알리고 (Aligo)</SelectItem>
                <SelectItem value="solapi">솔라피 (Solapi)</SelectItem>
                <SelectItem value="ncp">네이버 클라우드 (NCP)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Provider별 설정 */}
          {settings.provider === 'aligo' && (
            <>
              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                  placeholder="알리고 API Key 입력"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>User ID</Label>
                <Input
                  type="text"
                  value={settings.apiSecret}
                  onChange={(e) => setSettings({...settings, apiSecret: e.target.value})}
                  placeholder="알리고 User ID 입력"
                  className="mt-2"
                />
              </div>
            </>
          )}

          {settings.provider === 'solapi' && (
            <>
              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                  placeholder="솔라피 API Key 입력"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>API Secret</Label>
                <Input
                  type="password"
                  value={settings.apiSecret}
                  onChange={(e) => setSettings({...settings, apiSecret: e.target.value})}
                  placeholder="솔라피 API Secret 입력"
                  className="mt-2"
                />
              </div>
            </>
          )}

          {settings.provider === 'ncp' && (
            <>
              <div>
                <Label>Access Key</Label>
                <Input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                  placeholder="NCP Access Key 입력"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Secret Key</Label>
                <Input
                  type="password"
                  value={settings.apiSecret}
                  onChange={(e) => setSettings({...settings, apiSecret: e.target.value})}
                  placeholder="NCP Secret Key 입력"
                  className="mt-2"
                />
              </div>
            </>
          )}

          {/* 발신번호 */}
          <div>
            <Label>기본 발신번호</Label>
            <Input
              type="tel"
              value={settings.senderPhone}
              onChange={(e) => setSettings({...settings, senderPhone: e.target.value})}
              placeholder="01012345678"
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-1">
              사전에 통신사에 등록된 발신번호를 입력하세요
            </p>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3">
            <Button
              onClick={testConnection}
              variant="outline"
              disabled={testing || !settings.apiKey || !settings.senderPhone}
            >
              {testing ? '테스트 중...' : '연결 테스트'}
            </Button>
            <Button
              onClick={saveSettings}
              disabled={loading}
            >
              {loading ? '저장 중...' : '설정 저장'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 발신번호 관리 안내 */}
      <Card>
        <CardHeader>
          <CardTitle>📌 발신번호 등록 안내</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>
            발신번호는 각 SMS 제공업체에서 사전 등록이 필요합니다:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              <strong>알리고:</strong> 관리자 페이지에서 발신번호 등록 후 서류 제출
            </li>
            <li>
              <strong>솔라피:</strong> 대시보드에서 발신번호 인증 (통신사 명의 확인)
            </li>
            <li>
              <strong>NCP:</strong> 콘솔에서 발신번호 등록 및 인증서 제출
            </li>
          </ul>
          <p className="text-amber-600 dark:text-amber-500">
            ⚠️ 미등록 발신번호 사용 시 발송이 실패하거나 법적 제재를 받을 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}