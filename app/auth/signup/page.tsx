'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Mail, Lock, Eye, EyeOff, User, Building } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const SUBSCRIPTION_PLANS = [
  { value: 'FREE_TRIAL', label: '무료체험 (14일)', description: '업체 10개, 담당자 50명' },
  { value: 'STARTER', label: 'STARTER (₩29,900/월)', description: '업체 10개, 담당자 50명' },
  {
    value: 'PROFESSIONAL',
    label: 'PROFESSIONAL (₩79,900/월)',
    description: '업체 50개, 담당자 300명',
  },
  { value: 'BUSINESS', label: 'BUSINESS (₩199,900/월)', description: '업체/담당자 무제한' },
]

export default function SignUpPage() {
  const [step, setStep] = useState(1) // 1: 계정 정보, 2: 회사 정보
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  // Step 1: 계정 정보
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Step 2: 회사 정보
  const [companyName, setCompanyName] = useState('')
  const [subscriptionPlan, setSubscriptionPlan] = useState('FREE_TRIAL')
  const [ownerName, setOwnerName] = useState('')

  const validateStep1 = () => {
    if (!email || !password || !confirmPassword) {
      toast({
        title: '입력 오류',
        description: '모든 필드를 입력해주세요.',
        variant: 'destructive',
      })
      return false
    }

    if (password.length < 6) {
      toast({
        title: '비밀번호 오류',
        description: '비밀번호는 6자 이상이어야 합니다.',
        variant: 'destructive',
      })
      return false
    }

    if (password !== confirmPassword) {
      toast({
        title: '비밀번호 불일치',
        description: '비밀번호가 일치하지 않습니다.',
        variant: 'destructive',
      })
      return false
    }

    return true
  }

  const validateStep2 = () => {
    if (!companyName || !ownerName) {
      toast({
        title: '입력 오류',
        description: '모든 필드를 입력해주세요.',
        variant: 'destructive',
      })
      return false
    }

    return true
  }

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateStep2()) return

    setLoading(true)

    try {
      // 회사 정보와 함께 회원가입
      // subdomain은 회사명을 기반으로 자동 생성
      const autoSubdomain = companyName
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50)

      // 1. Supabase Auth 회원가입
      const { error } = await signUp(email, password, {
        full_name: ownerName,
        company_name: companyName,
        subdomain: autoSubdomain,
        subscription_plan: subscriptionPlan,
        role: 'OWNER',
      })

      if (error) {
        toast({
          title: '회원가입 실패',
          description:
            error.message === 'User already registered'
              ? '이미 등록된 이메일입니다.'
              : error.message,
          variant: 'destructive',
        })
        return
      }

      // 회원가입 성공! 이메일 인증 안내
      // 참고: Tenant는 이메일 인증 후 첫 로그인 시 자동으로 생성됩니다

      // localStorage에 회사 정보 저장 (tenant 생성용)
      if (typeof window !== 'undefined') {
        localStorage.setItem('pendingTenantSetup', JSON.stringify({
          email,
          companyName,
          ownerName,
          subscriptionPlan,
          subdomain: autoSubdomain,
        }))
      }

      toast({
        title: '회원가입 성공',
        description: '이메일을 확인하여 인증을 완료해주세요.',
      })

      // 이메일 인증 안내 페이지로 리다이렉트
      router.push('/auth/verify-email?email=' + encodeURIComponent(email))
    } catch (error) {
      toast({
        title: '오류 발생',
        description: '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
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

        {/* 회원가입 폼 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* 진행 단계 표시 */}
          <div className="flex items-center mb-6">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              1
            </div>
            <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              2
            </div>
          </div>

          {step === 1 ? (
            /* Step 1: 계정 정보 */
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">계정 정보</h2>
                <p className="text-gray-600 text-sm">
                  로그인에 사용할 이메일과 비밀번호를 입력하세요
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleNext()
                }}
                className="space-y-4"
              >
                {/* 이메일 */}
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="이메일을 입력하세요"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {/* 비밀번호 */}
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="비밀번호 (6자 이상)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 비밀번호 확인 */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="비밀번호를 다시 입력하세요"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  다음 단계
                </Button>
              </form>
            </>
          ) : (
            /* Step 2: 회사 정보 */
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">회사 정보</h2>
                <p className="text-gray-600 text-sm">Echo Mail을 사용할 회사 정보를 입력하세요</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 회사명 */}
                <div className="space-y-2">
                  <Label htmlFor="companyName">회사명</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="companyName"
                      placeholder="회사명을 입력하세요"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {/* 대표자명 */}
                <div className="space-y-2">
                  <Label htmlFor="ownerName">대표자명</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="ownerName"
                      placeholder="대표자명을 입력하세요"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {/* 구독 플랜 */}
                <div className="space-y-2">
                  <Label>구독 플랜</Label>
                  <Select value={subscriptionPlan} onValueChange={setSubscriptionPlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBSCRIPTION_PLANS.map((plan) => (
                        <SelectItem key={plan.value} value={plan.value}>
                          <div>
                            <div className="font-medium">{plan.label}</div>
                            <div className="text-xs text-gray-500">{plan.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                    disabled={loading}
                  >
                    이전
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading} size="lg">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        가입 중...
                      </>
                    ) : (
                      '가입 완료'
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}

          {/* 로그인 링크 */}
          <div className="text-center mt-6 pt-4 border-t">
            <p className="text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <Link
                href="/auth/login"
                className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
              >
                로그인
              </Link>
            </p>
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
