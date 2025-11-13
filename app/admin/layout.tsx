import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AdminNav from './components/AdminNav'

export const metadata = {
  title: 'Echo Mail Admin',
  description: '시스템 관리자 페이지',
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  // 슈퍼어드민 체크 (환경변수에 설정된 이메일)
  const SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS?.split(',') || []
  const isSuperAdmin = session?.user?.email && SUPER_ADMIN_EMAILS.includes(session.user.email)

  if (!isSuperAdmin) {
    redirect('/')
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