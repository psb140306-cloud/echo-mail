'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface SystemKakaoSettings {
  enabled: boolean
  restApiKey: string
  businessId: string
  testMode: boolean
  smsFailover: boolean
}

export default function AdminKakaoSettings() {
  const [settings, setSettings] = useState<SystemKakaoSettings>({
    enabled: false,
    restApiKey: '',
    businessId: '',
    testMode: true,
    smsFailover: true
  })
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/kakao/settings')
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
      const response = await fetch('/api/admin/kakao/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        toast.success('카카오톡 설정이 저장되었습니다')
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
      const response = await fetch('/api/admin/kakao/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const result = await response.json()
      if (result.success) {
        toast.success('카카오 API 연결 테스트 성공!')
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
          카카오톡 발송 설정
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          카카오 비즈메시지 API 설정을 관리합니다
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>카카오톡 발송 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 카카오톡 발송 활성화 */}
          <div className="flex items-center justify-between">
            <div>
              <Label>카카오톡 발송 활성화</Label>
              <p className="text-sm text-gray-500 mt-1">
                카카오 알림톡/친구톡 발송을 활성화합니다
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
                실제 발송하지 않고 로그만 남깁니다
              </p>
            </div>
            <Switch
              checked={settings.testMode}
              onCheckedChange={(checked) =>
                setSettings({...settings, testMode: checked})
              }
            />
          </div>

          {/* SMS 폴백 */}
          <div className="flex items-center justify-between">
            <div>
              <Label>SMS 폴백</Label>
              <p className="text-sm text-gray-500 mt-1">
                카카오톡 발송 실패 시 SMS로 재발송합니다
              </p>
            </div>
            <Switch
              checked={settings.smsFailover}
              onCheckedChange={(checked) =>
                setSettings({...settings, smsFailover: checked})
              }
            />
          </div>

          {/* REST API 키 */}
          <div>
            <Label>REST API 키</Label>
            <Input
              type="password"
              value={settings.restApiKey}
              onChange={(e) => setSettings({...settings, restApiKey: e.target.value})}
              placeholder="카카오 개발자센터에서 발급받은 API 키"
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-1">
              카카오 개발자센터에서 발급받은 REST API 키를 입력하세요
            </p>
          </div>

          {/* 플러스친구 ID */}
          <div>
            <Label>플러스친구 ID</Label>
            <Input
              type="text"
              value={settings.businessId}
              onChange={(e) => setSettings({...settings, businessId: e.target.value})}
              placeholder="@your_business_id"
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-1">
              카카오 비즈니스 채널 ID (@포함)
            </p>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3">
            <Button
              onClick={testConnection}
              variant="outline"
              disabled={testing || !settings.restApiKey || !settings.businessId}
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

      {/* 카카오 비즈메시지 안내 */}
      <Card>
        <CardHeader>
          <CardTitle>📌 카카오 비즈메시지 설정 안내</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>
            카카오 알림톡/친구톡 사용을 위한 사전 준비사항:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              <strong>카카오 비즈니스 채널 개설:</strong> 카카오톡 채널 관리자센터에서 채널 생성
            </li>
            <li>
              <strong>발신 프로필 등록:</strong> 사업자등록증 제출 및 심사 (1-2일 소요)
            </li>
            <li>
              <strong>알림톡 템플릿 등록:</strong> 사용할 메시지 템플릿 사전 심사
            </li>
            <li>
              <strong>API 키 발급:</strong> 카카오 개발자센터에서 앱 생성 후 REST API 키 발급
            </li>
          </ul>
          <p className="text-amber-600 dark:text-amber-500">
            ⚠️ 알림톡은 광고성 내용 불가, 친구톡은 채널 친구에게만 발송 가능
          </p>
        </CardContent>
      </Card>
    </div>
  )
}