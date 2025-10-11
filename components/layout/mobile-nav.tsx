'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Menu, X, Mail, Users, Calendar, Bell, Settings, BarChart3, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<any>
  badge?: string
}

const navItems: NavItem[] = [
  {
    href: '/',
    label: '대시보드',
    icon: BarChart3,
  },
  {
    href: '/companies',
    label: '업체 관리',
    icon: Users,
  },
  {
    href: '/delivery-rules',
    label: '배송 규칙',
    icon: Calendar,
  },
  {
    href: '/notifications',
    label: '알림 관리',
    icon: Bell,
  },
  {
    href: '/logs',
    label: '로그 및 통계',
    icon: Activity,
  },
  {
    href: '/settings',
    label: '시스템 설정',
    icon: Settings,
  },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
          aria-label="메뉴 열기"
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">메뉴 열기</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <div className="flex items-center justify-between pb-6">
          <div className="flex items-center space-x-2">
            <Mail className="h-6 w-6 text-echo-blue-600" />
            <span className="font-bold text-xl">Echo Mail</span>
          </div>
        </div>

        <nav id="mobile-navigation" className="flex flex-col space-y-2" role="navigation" aria-label="모바일 메인 네비게이션">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-echo-blue-50 text-echo-blue-900 border-r-2 border-echo-blue-500'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
                {item.badge && (
                  <Badge variant="secondary" className="ml-auto">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="container flex h-14 items-center">
        <MobileNav />
        <div className="flex items-center space-x-2">
          <Mail className="h-5 w-5 text-echo-blue-600" />
          <span className="font-semibold">Echo Mail</span>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Activity className="mr-1 h-3 w-3" />
            정상
          </Badge>
        </div>
      </div>
    </header>
  )
}
