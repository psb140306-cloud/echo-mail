'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Mail,
  ArrowRight,
  Target,
  Heart,
  Zap,
  Shield,
  Users,
  TrendingUp,
  Award,
  Globe,
} from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="relative z-50">
        <div className="container mx-auto px-4 py-6">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">Echo Mail</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/features">기능</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/pricing">요금제</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/auth/login">로그인</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/signup">무료로 시작하기</Link>
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            우리는
            <br />
            <span className="text-blue-600">비즈니스 자동화의 미래를 만듭니다</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Echo Mail은 발주 관리 자동화를 통해 비즈니스의 효율성을 극대화하는 SaaS 플랫폼입니다.
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          <Card className="p-8 bg-white">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <Target className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold mb-4">우리의 미션</h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                모든 비즈니스가 반복적인 업무에서 벗어나 진정으로 중요한 일에 집중할 수 있도록 돕습니다.
                발주 확인과 알림 발송을 자동화하여 시간과 비용을 절감하고, 고객 만족도를 높입니다.
              </p>
            </CardContent>
          </Card>

          <Card className="p-8 bg-white">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <Globe className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold mb-4">우리의 비전</h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                국내를 넘어 글로벌 시장에서 비즈니스 자동화 솔루션의 선두주자가 되고자 합니다. AI와
                머신러닝을 활용한 차세대 스마트 자동화 플랫폼으로 진화해 나갈 것입니다.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Core Values */}
        <div className="bg-white rounded-3xl shadow-xl p-12 mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">핵심 가치</h2>
            <p className="text-xl text-gray-600">Echo Mail이 지향하는 가치들입니다</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Zap className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">혁신</h3>
              <p className="text-gray-600">
                끊임없는 기술 혁신으로 더 나은 서비스를 제공합니다. 사용자의 피드백을 빠르게 반영하여
                지속적으로 발전합니다.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">고객 중심</h3>
              <p className="text-gray-600">
                고객의 성공이 우리의 성공입니다. 고객의 니즈를 최우선으로 생각하며, 최상의 고객
                경험을 제공합니다.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">신뢰</h3>
              <p className="text-gray-600">
                엔터프라이즈급 보안과 99.9% 가용성으로 고객의 신뢰를 얻습니다. 데이터 보호를 최우선으로
                합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Company Story */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl shadow-xl p-12 text-white mb-24">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center">우리의 이야기</h2>
            <div className="space-y-6 text-lg leading-relaxed">
              <p>
                Echo Mail은 실제 비즈니스 현장에서 겪었던 불편함에서 시작되었습니다. 수많은 발주 메일을
                확인하고, 담당자에게 일일이 연락하는 반복적인 업무가 비효율적이라는 것을 깨달았습니다.
              </p>
              <p>
                "이 과정을 자동화할 수 있다면 얼마나 많은 시간과 비용을 절약할 수 있을까?" 라는 질문에서
                Echo Mail이 탄생했습니다.
              </p>
              <p>
                2024년, 소규모 팀으로 시작한 Echo Mail은 현재 수백 개의 기업이 신뢰하는 플랫폼으로
                성장했습니다. 고객들의 소중한 피드백을 바탕으로 지속적으로 발전하고 있으며, 더 많은
                비즈니스가 자동화의 혜택을 누릴 수 있도록 노력하고 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-24">
          <Card className="p-8 text-center bg-white">
            <CardContent className="pt-6">
              <div className="text-4xl font-bold text-blue-600 mb-2">100+</div>
              <p className="text-gray-600">활성 고객사</p>
            </CardContent>
          </Card>

          <Card className="p-8 text-center bg-white">
            <CardContent className="pt-6">
              <div className="text-4xl font-bold text-green-600 mb-2">50K+</div>
              <p className="text-gray-600">월 처리 메일</p>
            </CardContent>
          </Card>

          <Card className="p-8 text-center bg-white">
            <CardContent className="pt-6">
              <div className="text-4xl font-bold text-purple-600 mb-2">99.9%</div>
              <p className="text-gray-600">시스템 가용성</p>
            </CardContent>
          </Card>

          <Card className="p-8 text-center bg-white">
            <CardContent className="pt-6">
              <div className="text-4xl font-bold text-orange-600 mb-2">24/7</div>
              <p className="text-gray-600">무중단 모니터링</p>
            </CardContent>
          </Card>
        </div>

        {/* Why Choose Us */}
        <div className="bg-white rounded-3xl shadow-xl p-12 mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Echo Mail을 선택하는 이유</h2>
            <p className="text-xl text-gray-600">
              수많은 기업들이 Echo Mail을 신뢰하는 이유입니다
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Award className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">검증된 기술력</h3>
                <p className="text-gray-600">
                  최신 기술 스택과 엔터프라이즈급 인프라로 안정적인 서비스를 제공합니다. 수년간의
                  개발 경험과 노하우가 담겨 있습니다.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">전문 고객 지원</h3>
                <p className="text-gray-600">
                  빠른 응답과 친절한 상담으로 고객의 문제를 신속하게 해결합니다. 온보딩부터 운영까지
                  전 과정을 지원합니다.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">지속적인 개선</h3>
                <p className="text-gray-600">
                  매월 새로운 기능이 추가되고 기존 기능이 개선됩니다. 고객의 피드백을 적극 반영하여
                  함께 성장합니다.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">투명한 운영</h3>
                <p className="text-gray-600">
                  명확한 요금제, 숨겨진 비용 없음, 언제든 해지 가능한 유연한 정책으로 고객의 권리를
                  최우선으로 합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Team Section */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl shadow-xl p-12 mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">우리 팀</h2>
            <p className="text-xl text-gray-600">
              다양한 분야의 전문가들이 Echo Mail을 만들어갑니다
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl text-white font-bold">개</span>
              </div>
              <h3 className="text-xl font-bold mb-2">개발팀</h3>
              <p className="text-gray-600">
                최신 기술로 안정적이고 확장 가능한 시스템을 구축합니다
              </p>
            </div>

            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl text-white font-bold">디</span>
              </div>
              <h3 className="text-xl font-bold mb-2">디자인팀</h3>
              <p className="text-gray-600">직관적이고 아름다운 사용자 경험을 디자인합니다</p>
            </div>

            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl text-white font-bold">고</span>
              </div>
              <h3 className="text-xl font-bold mb-2">고객지원팀</h3>
              <p className="text-gray-600">고객의 성공을 위해 항상 함께합니다</p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center bg-white rounded-3xl shadow-xl p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Echo Mail과 함께 성장하세요</h2>
          <p className="text-xl text-gray-600 mb-8">
            14일 무료체험으로 Echo Mail의 가치를 직접 경험해보세요
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/auth/signup">
                무료체험 시작하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6" asChild>
              <Link href="/contact">문의하기</Link>
            </Button>
          </div>
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
          <div className="flex justify-center space-x-8 mb-8">
            <Link href="/features" className="text-gray-400 hover:text-white">
              기능
            </Link>
            <Link href="/pricing" className="text-gray-400 hover:text-white">
              요금제
            </Link>
            <Link href="/about" className="text-gray-400 hover:text-white">
              회사소개
            </Link>
            <Link href="/contact" className="text-gray-400 hover:text-white">
              문의하기
            </Link>
          </div>
          <div className="text-center text-gray-400">© 2025 Echo Mail. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}