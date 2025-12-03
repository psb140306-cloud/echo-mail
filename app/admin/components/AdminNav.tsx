'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  HomeIcon,
  CogIcon,
  ChatBubbleLeftIcon,
  EnvelopeIcon,
  UserGroupIcon,
  ChartBarIcon,
  KeyIcon,
  ServerIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/theme-toggle'

const navigation = [
  { name: '대시보드', href: '/admin', icon: HomeIcon },
  { name: '테넌트 관리', href: '/admin/tenants', icon: UserGroupIcon },
  { name: '사용자 관리', href: '/admin/users', icon: UserGroupIcon },
  { name: '사용량 통계', href: '/admin/usage', icon: ChartBarIcon },
  { name: 'SMS 설정', href: '/admin/sms', icon: ChatBubbleLeftIcon },
  { name: '카카오톡 설정', href: '/admin/kakao', icon: EnvelopeIcon },
  { name: 'API 키 관리', href: '/admin/api-keys', icon: KeyIcon },
  { name: '시스템 설정', href: '/admin/system', icon: ServerIcon },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success('로그아웃 되었습니다')
      router.push('/auth/login')
    } catch (error) {
      console.error('로그아웃 실패:', error)
      toast.error('로그아웃에 실패했습니다')
    }
  }

  return (
    <nav className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen sticky top-0 flex flex-col">
      <div className="p-4 flex-1">
        <h2 className="text-xl font-bold text-red-600 dark:text-red-500 mb-8">
          🛡️ 슈퍼어드민
        </h2>
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href))

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                    ${isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }
                  `}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* 테마 토글 & 로그아웃 버튼 */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">테마</span>
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full
            hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-700 dark:text-gray-300
            hover:text-red-600 dark:hover:text-red-400"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          <span className="font-medium">로그아웃</span>
        </button>
      </div>
    </nav>
  )
}