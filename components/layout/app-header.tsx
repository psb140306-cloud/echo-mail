'use client'

import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { Mail, LogOut, LayoutDashboard, Building2, Settings, Inbox, BookUser, Megaphone, Activity } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { WordMarkLink } from '@/components/ui/wordmark-link'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/mail', label: '메일함', icon: Inbox },
  { href: '/companies', label: '업체 관리', icon: Building2 },
  { href: '/address-book', label: '주소록', icon: BookUser },
  { href: '/announcements', label: '대량 공지', icon: Megaphone },
  { href: '/logs', label: '로그', icon: Activity },
  { href: '/settings', label: '설정', icon: Settings },
]

export function AppHeader() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const pathname = usePathname()

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      toast({
        title: '로그아웃 실패',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: '로그아웃 완료',
        description: '안전하게 로그아웃되었습니다.',
      })
    }
  }

  return (
    <header className="bg-white dark:bg-card shadow-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <WordMarkLink className="flex items-center text-gray-900 dark:text-foreground no-underline">
              <div className="w-8 h-8 bg-blue-600 dark:bg-primary rounded-lg flex items-center justify-center mr-3">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold">Echo Mail</span>
            </WordMarkLink>

            <nav className="hidden md:flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-300">
              {user?.email}님 안녕하세요
            </span>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
