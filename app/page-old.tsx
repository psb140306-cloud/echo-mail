'use client'

import { useAuth, AuthGuard, GuestGuard } from '@/components/providers/auth-provider'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, ArrowRight, CheckCircle, Users, MessageCircle, BarChart3, Building } from 'lucide-react'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // 인증된 사용자는 대시보드로 리다이렉트
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <GuestGuard fallback={<div>대시보드로 이동 중...</div>}>
      <LandingPage />
    </GuestGuard>
  )
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="relative z-50">
        <div className="container mx-auto px-4 py-6">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">Echo Mail</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <a href="/auth/login">로그인</a>
              </Button>
              <Button asChild>
                <a href="/auth/signup">무료로 시작하기</a>
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            발주 확인 자동화로
            <br />
            <span className="text-blue-600">비즈니스를 혁신하세요</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Echo Mail이 발주 메일을 자동으로 확인하고 SMS/카카오톡으로 즉시 알림을 발송합니다.
            놓치는 발주가 없도록 24/7 모니터링합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <a href="/auth/signup">
                14일 무료체험 시작
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6" asChild>
              <a href="/auth/login">로그인</a>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-8 border-2 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">자동 메일 모니터링</h3>
              <p className="text-gray-600">
                발주 메일을 24시간 자동 감지하여 놓치는 발주가 없도록 합니다. 키워드 및 첨부파일
                검증으로 정확도를 높입니다.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-8 border-2 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">즉시 알림 발송</h3>
              <p className="text-gray-600">
                발주 메일 수신 즉시 SMS/카카오톡으로 담당자에게 알림을 발송합니다. 지역별 배송
                규칙에 따라 자동으로 납기일을 계산합니다.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-8 border-2 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">실시간 관리</h3>
              <p className="text-gray-600">
                발송 현황, 성공률, 업체별 통계를 실시간으로 확인하고 관리할 수 있는 직관적인
                대시보드를 제공합니다.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Benefits */}
        <div className="mt-24 bg-white rounded-3xl shadow-xl p-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              왜 Echo Mail을 선택해야 할까요?
            </h2>
            <p className="text-xl text-gray-600">
              비즈니스 성장에 집중하세요. Echo Mail이 발주 관리를 자동화합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {[
                '놓치는 발주 0건 달성',
                '수작업 90% 절감',
                '고객 만족도 향상',
                '비용 효율적 운영',
              ].map((benefit, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="text-lg text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              {[
                '24/7 무중단 모니터링',
                '다양한 알림 채널 지원',
                '간편한 설정과 관리',
                '확실한 보안과 안정성',
              ].map((benefit, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-lg text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing Preview */}
        <div className="mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">합리적인 요금제</h2>
            <p className="text-xl text-gray-600">비즈니스 규모에 맞는 플랜을 선택하세요</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">스타터</CardTitle>
                <CardDescription>소규모 비즈니스</CardDescription>
                <div className="text-2xl font-bold mt-4">
                  ₩29,900<span className="text-sm font-normal">/월</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• 업체 10개</li>
                  <li>• 담당자 50명</li>
                  <li>• 월 500건 이메일</li>
                  <li>• SMS/카카오톡 알림</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="text-center p-6 border-2 border-blue-500 hover:shadow-lg transition-shadow relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs">인기</span>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">프로페셔널</CardTitle>
                <CardDescription>성장하는 비즈니스</CardDescription>
                <div className="text-2xl font-bold mt-4">
                  ₩79,900<span className="text-sm font-normal">/월</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• 업체 50개</li>
                  <li>• 담당자 300명</li>
                  <li>• 월 2,000건 이메일</li>
                  <li>• API 액세스</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">비즈니스</CardTitle>
                <CardDescription>대규모 운영</CardDescription>
                <div className="text-2xl font-bold mt-4">
                  ₩199,900<span className="text-sm font-normal">/월</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• 무제한 업체</li>
                  <li>• 무제한 담당자</li>
                  <li>• 월 10,000건 이메일</li>
                  <li>• 우선 지원</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button variant="outline" size="lg" asChild>
              <a href="/pricing">전체 요금제 보기</a>
            </Button>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">고객 후기</h2>
            <p className="text-xl text-gray-600">Echo Mail을 사용하는 고객들의 생생한 후기</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="p-8">
              <CardContent>
                <p className="text-gray-600 mb-6 italic">
                  "Echo Mail 도입 후 놓치는 발주가 완전히 사라졌습니다. 자동 알림 덕분에 고객
                  만족도도 크게 향상되었어요."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">김대표</p>
                    <p className="text-sm text-gray-500">○○ 식자재 유통업체</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8">
              <CardContent>
                <p className="text-gray-600 mb-6 italic">
                  "수작업으로 하던 발주 확인 작업이 완전 자동화되어 직원들이 더 중요한 업무에 집중할
                  수 있게 되었습니다."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <Building className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold">이사장</p>
                    <p className="text-sm text-gray-500">△△ 물류센터</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">자주 묻는 질문</h2>
            <p className="text-xl text-gray-600">Echo Mail에 대해 궁금한 점들</p>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-3">정말 24시간 메일을 모니터링하나요?</h3>
              <p className="text-gray-600">
                네, Echo Mail은 24시간 365일 중단 없이 메일서버를 모니터링합니다. 발주 메일이
                수신되면 즉시 감지하여 관련 담당자에게 알림을 발송합니다.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-3">설정이 복잡하지 않나요?</h3>
              <p className="text-gray-600">
                전혀 그렇지 않습니다. 간단한 메일서버 정보 입력과 업체/담당자 등록만으로 바로 사용할
                수 있습니다. 평균 30분 이내에 설정이 완료됩니다.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-3">기존 메일 시스템과 충돌하지 않나요?</h3>
              <p className="text-gray-600">
                Echo Mail은 기존 메일 시스템에 영향을 주지 않습니다. 읽기 전용으로 메일을 확인하므로
                완전히 독립적으로 작동합니다.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-3">무료체험 후 자동 결제되나요?</h3>
              <p className="text-gray-600">
                아니요, 무료체험 기간이 끝나도 자동으로 결제되지 않습니다. 계속 사용하시려면 별도로
                유료 플랜에 가입하셔야 합니다.
              </p>
            </Card>
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-24 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">지금 시작하세요</h2>
          <p className="text-xl text-gray-600 mb-8">
            14일 무료체험으로 Echo Mail의 효과를 직접 경험해보세요.
          </p>
          <Button size="lg" className="text-lg px-12 py-6" asChild>
            <a href="/auth/signup">
              무료체험 시작하기
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-24">
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Echo Mail</span>
          </div>
          <div className="text-center text-gray-400">© 2025 Echo Mail. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
