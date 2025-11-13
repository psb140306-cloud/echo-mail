'use client'

import { useAuth } from '@/components/providers/auth-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'

interface Stats {
  tenantCount: number
  userCount: number
  notificationCount: number
  companyCount: number
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    tenantCount: 0,
    userCount: 0,
    notificationCount: 0,
    companyCount: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // API를 통해 통계 데이터 가져오기
    // 임시로 하드코딩된 값 사용
    setStats({
      tenantCount: 1,
      userCount: 5,
      notificationCount: 150,
      companyCount: 12
    })
    setLoading(false)
  }, [])

  if (loading) {
    return <div>로딩 중...</div>
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          시스템 관리자 대시보드
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          안녕하세요, {user?.email}님
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              총 테넌트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tenantCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              총 사용자
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.userCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              30일 알림 발송
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.notificationCount.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              등록된 업체
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.companyCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* 빠른 링크 */}
      <Card>
        <CardHeader>
          <CardTitle>빠른 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/admin/sms"
              className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <h3 className="font-semibold mb-1">SMS 설정</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                SMS API 키 및 발신번호 관리
              </p>
            </a>
            <a
              href="/admin/kakao"
              className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <h3 className="font-semibold mb-1">카카오톡 설정</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                카카오 비즈메시지 API 설정
              </p>
            </a>
            <a
              href="/admin/tenants"
              className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <h3 className="font-semibold mb-1">테넌트 관리</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                테넌트 생성 및 관리
              </p>
            </a>
            <a
              href="/admin/system"
              className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <h3 className="font-semibold mb-1">시스템 설정</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                메일 스케줄러 및 시스템 설정
              </p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}