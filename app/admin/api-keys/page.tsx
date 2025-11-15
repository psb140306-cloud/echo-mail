'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Key, Shield, AlertCircle, ExternalLink, Copy, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

interface ApiKeyInfo {
  category: string
  services: Array<{
    name: string
    env: string
    description: string
    required: boolean
    link?: string
  }>
}

export default function ApiKeysManagementPage() {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  const apiKeyGroups: ApiKeyInfo[] = [
    {
      category: '인증 & 데이터베이스',
      services: [
        {
          name: 'Supabase URL',
          env: 'NEXT_PUBLIC_SUPABASE_URL',
          description: 'Supabase 프로젝트 URL',
          required: true,
          link: 'https://supabase.com/dashboard',
        },
        {
          name: 'Supabase Anon Key',
          env: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          description: 'Supabase 공개 API 키',
          required: true,
          link: 'https://supabase.com/dashboard',
        },
        {
          name: 'Database URL',
          env: 'DATABASE_URL',
          description: 'PostgreSQL 연결 문자열',
          required: true,
        },
        {
          name: 'Direct Database URL',
          env: 'DIRECT_URL',
          description: 'Prisma Direct URL (Connection Pooling)',
          required: false,
        },
      ],
    },
    {
      category: 'SMS 발송',
      services: [
        {
          name: 'Solapi API Key',
          env: 'SOLAPI_API_KEY',
          description: '솔라피 API 키',
          required: false,
          link: 'https://console.solapi.com',
        },
        {
          name: 'Solapi API Secret',
          env: 'SOLAPI_API_SECRET',
          description: '솔라피 API Secret',
          required: false,
        },
        {
          name: 'Solapi Sender Phone',
          env: 'SOLAPI_SENDER_PHONE',
          description: '솔라피 발신번호',
          required: false,
        },
        {
          name: 'NCP Service ID',
          env: 'NCP_SERVICE_ID',
          description: 'NCP SMS Service ID',
          required: false,
          link: 'https://console.ncloud.com',
        },
        {
          name: 'NCP Access Key',
          env: 'NCP_ACCESS_KEY',
          description: 'NCP Access Key',
          required: false,
        },
        {
          name: 'NCP Secret Key',
          env: 'NCP_SECRET_KEY',
          description: 'NCP Secret Key',
          required: false,
        },
        {
          name: 'NCP Sender Phone',
          env: 'NCP_SENDER_PHONE',
          description: 'NCP 발신번호',
          required: false,
        },
      ],
    },
    {
      category: '카카오톡 발송',
      services: [
        {
          name: 'Kakao API Key',
          env: 'KAKAO_API_KEY',
          description: '카카오 REST API 키',
          required: false,
          link: 'https://developers.kakao.com',
        },
        {
          name: 'Kakao Plus Friend ID',
          env: 'KAKAO_PLUS_FRIEND_ID',
          description: '카카오 플러스친구 ID',
          required: false,
        },
      ],
    },
    {
      category: '시스템 설정',
      services: [
        {
          name: 'SMS Provider',
          env: 'SMS_PROVIDER',
          description: 'SMS 제공업체 (solapi/ncp)',
          required: false,
        },
        {
          name: 'Enable Real Notifications',
          env: 'ENABLE_REAL_NOTIFICATIONS',
          description: '실제 알림 발송 활성화 (true/false)',
          required: false,
        },
        {
          name: 'Redis URL',
          env: 'REDIS_URL',
          description: 'Redis 서버 연결 URL (선택)',
          required: false,
        },
        {
          name: 'Cron Secret',
          env: 'CRON_SECRET',
          description: 'Cron Job 인증 시크릿',
          required: false,
        },
      ],
    },
  ]

  const toggleSecret = (env: string) => {
    setShowSecrets((prev) => ({ ...prev, [env]: !prev[env] }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          API 키 관리
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          시스템에서 사용하는 모든 외부 서비스 API 키 및 환경변수 관리
        </p>
      </div>

      <Alert className="mb-8">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>보안 안내:</strong> API 키는 환경변수로 관리됩니다.
          Railway 또는 Vercel 대시보드에서 환경변수를 수정하세요.
          절대 Git에 커밋하거나 공개하지 마세요.
        </AlertDescription>
      </Alert>

      {/* API 키 그룹별 목록 */}
      <div className="space-y-8">
        {apiKeyGroups.map((group) => (
          <Card key={group.category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                {group.category}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {group.services.map((service) => (
                  <div
                    key={service.env}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{service.name}</h3>
                        {service.required && (
                          <Badge variant="destructive" className="text-xs">
                            필수
                          </Badge>
                        )}
                        {service.link && (
                          <a
                            href={service.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {service.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                          {service.env}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(service.env)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 환경변수 설정 가이드 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>환경변수 설정 방법</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="text-lg">🚂</span>
              Railway
            </h3>
            <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-4">
              <li>Railway 프로젝트 대시보드 접속</li>
              <li>프로젝트 선택 → Variables 탭 클릭</li>
              <li>New Variable 버튼으로 환경변수 추가</li>
              <li>변경 사항은 자동으로 재배포됨</li>
            </ol>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => window.open('https://railway.app', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Railway 대시보드 열기
            </Button>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="text-lg">▲</span>
              Vercel
            </h3>
            <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-4">
              <li>Vercel 프로젝트 대시보드 접속</li>
              <li>Settings → Environment Variables 선택</li>
              <li>환경변수 추가 (Production, Preview, Development 선택)</li>
              <li>Save 후 Redeploy 필요</li>
            </ol>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => window.open('https://vercel.com/dashboard', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Vercel 대시보드 열기
            </Button>
          </div>

          <Alert className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              환경변수 변경 후 반드시 서버를 재시작하거나 재배포해야 적용됩니다.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
