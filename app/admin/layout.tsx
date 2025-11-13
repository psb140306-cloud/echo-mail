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
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // 슈퍼어드민 체크
    // 임시로 하드코딩 (실제로는 API를 통해 확인해야 함)
    const SUPER_ADMIN_EMAILS = ['park8374@naver.com']

    if (!user || !SUPER_ADMIN_EMAILS.includes(user.email || '')) {
      router.push('/dashboard')
    }
  }, [user, router])

  // 슈퍼어드민이 아니면 null 반환 (로딩 중)
  const SUPER_ADMIN_EMAILS = ['park8374@naver.com']
  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email || '')) {
    return null
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