'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import AdminNav from './components/AdminNav'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // 로딩이 끝났을 때만 체크
    if (loading) return

    // 슈퍼어드민 체크
    // 임시로 하드코딩 (실제로는 API를 통해 확인해야 함)
    const SUPER_ADMIN_EMAILS = ['park8374@naver.com']

    console.log('Admin Layout - Current user:', user?.email)
    console.log('Admin Layout - Is super admin:', user?.email && SUPER_ADMIN_EMAILS.includes(user.email))

    if (!user || !SUPER_ADMIN_EMAILS.includes(user.email || '')) {
      console.log('Admin Layout - Redirecting to dashboard')
      router.push('/dashboard')
    }
  }, [user, loading, router])

  // 로딩 중이면 로딩 표시
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
      </div>
    )
  }

  // 슈퍼어드민이 아니면 접근 거부 메시지 표시
  const SUPER_ADMIN_EMAILS = ['park8374@naver.com']
  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email || '')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">접근 거부</h1>
          <p className="text-gray-600 dark:text-gray-400">
            슈퍼어드민 권한이 필요합니다.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            현재 로그인: {user?.email || '없음'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <AdminNav />
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}