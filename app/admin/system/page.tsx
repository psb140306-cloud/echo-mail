'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Server,
  Database,
  Mail,
  AlertCircle,
  CheckCircle2,
  Clock,
  HardDrive,
  Zap
} from 'lucide-react'

export default function SystemSettingsPage() {
  const systemInfo = {
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    platform: 'Railway',
    region: 'Auto',
  }

  const services = [
    {
      name: 'Next.js',
      version: '14.2.0',
      status: 'running',
      icon: Zap,
      description: 'React 프레임워크',
    },
    {
      name: 'PostgreSQL',
      version: '15.x',
      status: 'running',
      icon: Database,
      description: '메인 데이터베이스',
    },
    {
      name: 'Supabase',
      version: 'Latest',
      status: 'running',
      icon: Server,
      description: '인증 및 스토리지',
    },
    {
      name: 'Prisma',
      version: '5.x',
      status: 'running',
      icon: HardDrive,
      description: 'ORM',
    },
  ]

  const features = [
    {
      name: 'SMS 발송',
      enabled: true,
      provider: 'Solapi / NCP',
      description: 'SMS 알림 발송 기능',
    },
    {
      name: '카카오톡 발송',
      enabled: false,
      provider: 'Solapi',
      description: '카카오톡 알림톡/친구톡 발송',
    },
    {
      name: '메일 모니터링',
      enabled: true,
      provider: 'IMAP',
      description: '메일 자동 수신 및 파싱',
    },
    {
      name: 'Cron 스케줄러',
      enabled: true,
      provider: 'node-cron',
      description: '주기적 작업 실행',
    },
  ]

  const getStatusBadge = (status: string) => {
    if (status === 'running') {
      return (
        <Badge className="bg-green-500 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          실행 중
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        중지됨
      </Badge>
    )
  }

  const getEnvironmentBadge = (env: string) => {
    const colors: Record<string, string> = {
      production: 'bg-green-500',
      development: 'bg-yellow-500',
      staging: 'bg-blue-500',
    }
    return (
      <Badge className={colors[env] || 'bg-gray-500'}>
        {env === 'production' ? '프로덕션' : env === 'development' ? '개발' : env}
      </Badge>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          시스템 설정
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          시스템 환경 및 서비스 상태 확인
        </p>
      </div>

      {/* 시스템 정보 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            시스템 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">환경</p>
              <div className="font-semibold">
                {getEnvironmentBadge(systemInfo.environment)}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">버전</p>
              <p className="font-semibold">{systemInfo.version}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">플랫폼</p>
              <p className="font-semibold">{systemInfo.platform}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">리전</p>
              <p className="font-semibold">{systemInfo.region}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 서비스 상태 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            서비스 상태
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <service.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h3 className="font-semibold">{service.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {service.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">v{service.version}</p>
                  </div>
                </div>
                {getStatusBadge(service.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 기능 현황 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            기능 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {features.map((feature) => (
              <div
                key={feature.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold">{feature.name}</h3>
                    <Badge variant={feature.enabled ? 'default' : 'secondary'}>
                      {feature.enabled ? '활성화' : '비활성화'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    제공업체: {feature.provider}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 환경변수 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>환경변수</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              중요한 환경변수는 Railway 또는 Vercel 대시보드에서 관리됩니다.
              보안을 위해 민감한 정보는 표시되지 않습니다.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                NODE_ENV
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {process.env.NODE_ENV || 'development'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                NEXT_PUBLIC_SUPABASE_URL
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {process.env.NEXT_PUBLIC_SUPABASE_URL ? '설정됨' : '미설정'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                DATABASE_URL
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                ******** (보안)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                ENABLE_REAL_NOTIFICATIONS
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {process.env.ENABLE_REAL_NOTIFICATIONS || 'false'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 시스템 로그 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            시스템 로그
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              상세한 로그는 Railway 또는 Vercel 대시보드의 Logs 탭에서 확인할 수 있습니다.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
