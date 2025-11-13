'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon,
  CogIcon,
  ChatBubbleLeftIcon,
  EnvelopeIcon,
  UserGroupIcon,
  ChartBarIcon,
  KeyIcon,
  ServerIcon
} from '@heroicons/react/24/outline'

const navigation = [
  { name: '대시보드', href: '/admin', icon: HomeIcon },
  { name: 'SMS 설정', href: '/admin/sms', icon: ChatBubbleLeftIcon },
  { name: '카카오톡 설정', href: '/admin/kakao', icon: EnvelopeIcon },
  { name: '테넌트 관리', href: '/admin/tenants', icon: UserGroupIcon },
  { name: '사용량 통계', href: '/admin/usage', icon: ChartBarIcon },
  { name: 'API 키 관리', href: '/admin/api-keys', icon: KeyIcon },
  { name: '시스템 설정', href: '/admin/system', icon: ServerIcon },
  { name: '일반 설정', href: '/settings', icon: CogIcon },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen sticky top-0">
      <div className="p-4">
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
    </nav>
  )
}