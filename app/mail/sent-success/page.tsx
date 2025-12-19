'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Mail, Send, Clock } from 'lucide-react'
import { AppHeader } from '@/components/layout/app-header'

export default function SentSuccessPage() {
  const searchParams = useSearchParams()

  // URL 파라미터에서 정보 가져오기
  const to = searchParams.get('to') || ''
  const subject = searchParams.get('subject') || '(제목 없음)'
  const type = searchParams.get('type') || 'sent' // 'sent' or 'scheduled'

  const isScheduled = type === 'scheduled'

  return (
    <>
      <AppHeader />
      <div className="container mx-auto p-6 max-w-2xl">
        <Card className="text-center">
          <CardHeader className="pb-4">
            <div className="flex justify-center mb-4">
              {isScheduled ? (
                <Clock className="h-16 w-16 text-blue-500" />
              ) : (
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {isScheduled ? '메일 예약 완료' : '메일 발송 완료'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              {isScheduled
                ? '메일이 예약되었습니다. 설정한 시간에 자동으로 발송됩니다.'
                : '메일이 성공적으로 발송되었습니다.'}
            </p>

            {/* 메일 정보 */}
            <div className="bg-muted rounded-lg p-4 text-left space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-[80px]">받는 사람:</span>
                <span className="font-medium break-all">{to || '-'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-[80px]">제목:</span>
                <span className="font-medium">{subject}</span>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link href="/mail?folder=sent">
                <Button variant="outline" className="w-full sm:w-auto gap-2">
                  <Mail className="h-4 w-4" />
                  보낸 메일함
                </Button>
              </Link>
              <Link href="/mail/compose">
                <Button className="w-full sm:w-auto gap-2">
                  <Send className="h-4 w-4" />
                  새 메일 작성
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
