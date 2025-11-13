'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { WordMarkLink } from '@/components/ui/wordmark-link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { resetPassword } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      toast({
        title: '입력 오류',
        description: '이메일을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const { error } = await resetPassword(email)

      if (error) {
        toast({
          title: '재설정 실패',
          description: error.message,
          variant: 'destructive',
        })
        return
      }

      setSent(true)
      toast({
        title: '재설정 메일 발송',
        description: '비밀번호 재설정 메일이 발송되었습니다.',
      })
    } catch (error) {
      toast({
        title: '오류 발생',
        description: '비밀번호 재설정 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
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

          {/* 성공 메시지 */}
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">재설정 메일 발송 완료</h2>

            <div className="space-y-4 mb-8">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>{email}</strong>로<br />
                  비밀번호 재설정 메일을 발송했습니다.
                </p>
              </div>

              <div className="text-left space-y-2 text-sm text-gray-600">
                <h3 className="font-medium text-gray-900">다음 단계:</h3>
                <ul className="space-y-1 ml-4">
                  <li>1. 이메일함(스팸함 포함)을 확인하세요</li>
                  <li>2. Echo Mail에서 발송한 메일을 찾으세요</li>
                  <li>3. 메일의 &apos;비밀번호 재설정&apos; 링크를 클릭하세요</li>
                  <li>4. 새로운 비밀번호를 설정하세요</li>
                </ul>
              </div>
            </div>

            <Button onClick={() => setSent(false)} variant="outline" className="w-full mb-4">
              다른 이메일로 재시도
            </Button>

            <Link
              href="/auth/login"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              로그인 페이지로 돌아가기
            </Link>
          </div>

          <div className="text-center mt-8 text-sm text-gray-500">
            © 2025 Echo Mail. All rights reserved.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        {/* 로고/헤더 */}
        <div className="text-center mb-8">
          <WordMarkLink className="inline-flex flex-col items-center gap-4 mb-2 text-gray-900 no-underline">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-inherit">Echo Mail</span>
          </WordMarkLink>
          <p className="text-gray-600">발주 확인 자동 알림 시스템</p>
        </div>

        {/* 비밀번호 재설정 폼 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">비밀번호 재설정</h2>
            <p className="text-gray-600 text-sm">
              가입한 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드립니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이메일 */}
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="가입한 이메일을 입력하세요"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* 재설정 버튼 */}
            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  발송 중...
                </>
              ) : (
                '재설정 메일 발송'
              )}
            </Button>
          </form>

          {/* 구분선 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">또는</span>
            </div>
          </div>

          {/* 하단 링크 */}
          <div className="space-y-4">
            <Link
              href="/auth/login"
              className="flex items-center justify-center text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              로그인 페이지로 돌아가기
            </Link>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                아직 계정이 없으신가요?{' '}
                <Link
                  href="/auth/signup"
                  className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  무료로 시작하기
                </Link>
              </p>
            </div>
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
