import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Echo Mail - 발주 확인 자동 알림 시스템',
  description:
    '발주 메일을 자동으로 확인하고 SMS/카카오톡으로 알림을 발송하는 스마트 비즈니스 솔루션',
  keywords: '발주, 자동화, SMS, 카카오톡, 알림, 비즈니스',
  authors: [{ name: 'Echo Mail Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'noindex, nofollow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="relative min-h-screen bg-background">{children}</div>
        <Toaster />
      </body>
    </html>
  )
}
