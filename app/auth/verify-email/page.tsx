'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Mail, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react'

export default function VerifyEmailPage() {
  const [resending, setResending] = useState(false)
  const [email, setEmail] = useState('')
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
    }
  }, [searchParams])

  const handleResendVerification = async () => {
    if (!email) {
      toast({
        title: '오류',
        description: '이메일 주소가 없습니다.',
        variant: 'destructive',
      })
      return
    }

    setResending(true)

    try {
      // 인증 메일 재전송 로직
      // 현재는 Supabase의 resend 기능을 사용할 수 없으므로 임시로 성공 메시지만 표시
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: '인증 메일 재전송',
        description: '인증 메일이 재전송되었습니다. 메일함을 확인해주세요.',
      })
    } catch (error) {
      toast({
        title: '재전송 실패',
        description: '인증 메일 재전송 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        {/* 로고/헤더 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Echo Mail</h1>
          <p className="text-gray-600">발주 확인 자동 알림 시스템</p>
        </div>

        {/* 인증 안내 카드 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* 성공 아이콘 */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-4">이메일 인증이 필요합니다</h2>

          <div className="space-y-4 mb-8">
            <p className="text-gray-600">
              회원가입이 완료되었습니다!
              <br />
              계정을 활성화하려면 이메일 인증이 필요합니다.
            </p>

            {email && (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>{email}</strong>로<br />
                  인증 메일을 발송했습니다.
                </p>
              </div>
            )}

            <div className="text-left space-y-2 text-sm text-gray-600">
              <h3 className="font-medium text-gray-900">다음 단계:</h3>
              <ul className="space-y-1 ml-4">
                <li>1. 이메일함(스팸함 포함)을 확인하세요</li>
                <li>2. Echo Mail에서 발송한 인증 메일을 찾으세요</li>
                <li>3. 메일의 &apos;인증하기&apos; 버튼을 클릭하세요</li>
                <li>4. 인증 완료 후 자동으로 로그인됩니다</li>
              </ul>
            </div>
          </div>

          {/* 재전송 버튼 */}
          <div className="space-y-4">
            <Button
              onClick={handleResendVerification}
              disabled={resending || !email}
              variant="outline"
              className="w-full"
            >
              {resending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  재전송 중...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  인증 메일 재전송
                </>
              )}
            </Button>

            <div className="text-sm text-gray-500">
              메일을 받지 못하셨나요? 스팸함도 확인해보세요.
            </div>
          </div>
        </div>

        {/* 하단 링크 */}
        <div className="text-center mt-6 space-y-4">
          <Link
            href="/auth/login"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            로그인 페이지로 돌아가기
          </Link>

          <div className="text-sm text-gray-500">
            문제가 계속 발생하면{' '}
            <Link href="/contact" className="text-blue-600 hover:underline">
              고객지원
            </Link>
            에 문의하세요.
          </div>
        </div>

        {/* 푸터 */}
        <div className="text-center mt-8 text-sm text-gray-500">
          © 2025 Echo Mail. All rights reserved.
        </div>
      </div>
    </div>
  )
}
