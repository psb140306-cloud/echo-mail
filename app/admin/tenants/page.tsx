'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, Calendar, Activity } from 'lucide-react'

interface TenantMember {
  userId: string
  userEmail: string
  userName: string
  role: string
  status: string
}

interface Tenant {
  id: string
  name: string
  subdomain: string
  createdAt: string
  memberCount: number
  companyCount: number
  lastActivity: string
  members: TenantMember[]
}

export default function TenantsManagementPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await fetch('/api/admin/tenants')
        if (!response.ok) {
          throw new Error('Failed to fetch tenants')
        }
        const data = await response.json()
        setTenants(data.tenants)
      } catch (error) {
        console.error('Failed to load tenants:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTenants()
  }, [])

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      OWNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      MEMBER: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[role] || colors.MEMBER}`}>
        {role === 'OWNER' ? '소유자' : role === 'ADMIN' ? '관리자' : '멤버'}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      ACTIVE: 'default',
      PENDING: 'secondary',
      INACTIVE: 'destructive',
    }
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status === 'ACTIVE' ? '활성' : status === 'PENDING' ? '대기중' : '비활성'}
      </Badge>
    )
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) return '오늘'
    if (diffInDays === 1) return '어제'
    if (diffInDays < 7) return `${diffInDays}일 전`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}주 전`
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)}개월 전`
    return date.toLocaleDateString('ko-KR')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">테넌트 목록을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          테넌트 관리
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          전체 테넌트 및 멤버 현황을 확인합니다
        </p>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              총 테넌트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Users className="w-4 h-4" />
              총 멤버
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants.reduce((sum, t) => sum + t.memberCount, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              총 업체
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants.reduce((sum, t) => sum + t.companyCount, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              평균 멤버/테넌트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenants.length > 0
                ? (tenants.reduce((sum, t) => sum + t.memberCount, 0) / tenants.length).toFixed(1)
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 테넌트 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>테넌트 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tenants.map((tenant) => (
              <div
                key={tenant.id}
                className="border rounded-lg p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {/* 테넌트 헤더 */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{tenant.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {tenant.subdomain}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>생성: {formatDate(tenant.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="w-4 h-4" />
                        <span>최근 활동: {formatDate(tenant.lastActivity)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 통계 */}
                  <div className="flex gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {tenant.memberCount}
                      </div>
                      <div className="text-xs text-gray-500">멤버</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {tenant.companyCount}
                      </div>
                      <div className="text-xs text-gray-500">업체</div>
                    </div>
                  </div>
                </div>

                {/* 멤버 목록 */}
                {tenant.members.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      멤버 ({tenant.members.length}명)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {tenant.members.map((member) => (
                        <div
                          key={member.userId}
                          className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-3 rounded"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {member.userName}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {member.userEmail}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            {getRoleBadge(member.role)}
                            {getStatusBadge(member.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tenant.members.length === 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 text-center py-4">
                      멤버가 없습니다.
                    </p>
                  </div>
                )}
              </div>
            ))}

            {tenants.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>등록된 테넌트가 없습니다.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
