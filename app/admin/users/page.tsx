'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Tenant {
  tenantId: string
  tenantName: string
  subdomain: string
  role: string
  status: string
}

interface User {
  userId: string
  email: string
  name: string
  createdAt: string
  tenants: Tenant[]
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/admin/users')
        if (!response.ok) {
          throw new Error('Failed to fetch users')
        }
        const data = await response.json()
        setUsers(data.users)
      } catch (error) {
        console.error('Failed to load users:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

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

  if (loading) {
    return <div className="p-8">로딩 중...</div>
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          사용자 관리
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          전체 사용자 목록 및 테넌트 멤버십 관리
        </p>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              총 사용자
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              활성 사용자
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.tenants.some(t => t.status === 'ACTIVE')).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              총 멤버십
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.reduce((sum, u) => sum + u.tenants.length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 사용자 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.userId}
                className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{user.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      가입일: {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {user.tenants.length}개 테넌트
                  </div>
                </div>

                {/* 테넌트 멤버십 목록 */}
                <div className="space-y-2">
                  {user.tenants.map((tenant) => (
                    <div
                      key={tenant.tenantId}
                      className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-3 rounded"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{tenant.tenantName}</span>
                          <span className="text-xs text-gray-500">({tenant.subdomain})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRoleBadge(tenant.role)}
                        {getStatusBadge(tenant.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                사용자가 없습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
