'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Mail,
  ArrowRight,
  CheckCircle,
  MessageCircle,
  BarChart3,
  Clock,
  Shield,
  Zap,
  Settings,
  Bell,
  FileText,
  Users,
  TrendingUp,
} from 'lucide-react'

export default function FeaturesPage() {
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
            강력한 기능으로
            <br />
            <span className="text-blue-600">발주 관리를 자동화하세요</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Echo Mail의 핵심 기능들로 비즈니스 효율을 극대화하세요
          </p>
        </div>

        {/* Main Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          <Card className="p-8 hover:shadow-xl transition-all border-2">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4">자동 메일 모니터링</h3>
              <p className="text-gray-600 mb-4">
                IMAP 프로토콜을 통해 24/7 메일서버를 모니터링합니다. 새로운 발주 메일이 도착하면 즉시
                감지하여 처리를 시작합니다.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  실시간 메일 수신 감지
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  제목/본문 키워드 필터링
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  첨부파일 자동 검증
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  발신자 이메일 매칭
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all border-2">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                <MessageCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4">즉시 알림 발송</h3>
              <p className="text-gray-600 mb-4">
                발주 메일 감지 즉시 SMS/카카오톡으로 담당자에게 알림을 발송합니다. 다양한 알림 채널을
                지원합니다.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  SMS 문자 발송
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  카카오톡 알림톡/친구톡
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  실패 시 SMS 폴백
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  커스텀 메시지 템플릿
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all border-2">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <Clock className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4">스마트 납기일 계산</h3>
              <p className="text-gray-600 mb-4">
                지역별 배송 규칙에 따라 자동으로 납기일을 계산합니다. 공휴일과 주말을 고려한 정확한
                계산을 제공합니다.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  지역별 배송 규칙 설정
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  공휴일 자동 반영
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  오전/오후 구분 처리
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  영업일 기준 계산
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all border-2">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center mb-6">
                <Users className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4">업체 관리</h3>
              <p className="text-gray-600 mb-4">
                거래처와 담당자 정보를 체계적으로 관리합니다. 업체별로 다른 알림 설정과 납품 규칙을
                적용할 수 있습니다.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  업체 정보 통합 관리
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  담당자 다중 등록
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  업체별 설정 커스터마이징
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  미등록 업체 자동 처리
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all border-2">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4">실시간 대시보드</h3>
              <p className="text-gray-600 mb-4">
                발송 현황, 성공률, 업체별 통계를 실시간으로 확인할 수 있는 직관적인 대시보드를
                제공합니다.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  실시간 발송 현황
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  통계 차트 및 그래프
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  업체별 상세 분석
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  CSV 데이터 내보내기
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all border-2">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4">보안 및 안정성</h3>
              <p className="text-gray-600 mb-4">
                엔터프라이즈급 보안과 99.9% 가용성을 보장합니다. 데이터는 암호화되어 안전하게
                보관됩니다.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  SSL/TLS 암호화 통신
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  데이터 백업 및 복구
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  접근 권한 관리 (RBAC)
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  24/7 시스템 모니터링
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Additional Features */}
        <div className="bg-white rounded-3xl shadow-xl p-12 mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">추가 기능</h2>
            <p className="text-xl text-gray-600">더 나은 업무 환경을 위한 다양한 기능들</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Settings className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">유연한 설정</h3>
                <p className="text-gray-600">
                  메일 서버, SMS/카카오톡 API, 알림 템플릿 등 모든 설정을 웹 인터페이스에서 간편하게
                  관리할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bell className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">예외 처리</h3>
                <p className="text-gray-600">
                  미등록 업체, 메일 형식 오류 등 예외 상황을 자동으로 감지하고 관리자에게 알림을
                  발송합니다.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">상세 로그</h3>
                <p className="text-gray-600">
                  모든 메일 수신, 알림 발송 내역을 상세하게 기록하고 추적할 수 있어 문제 발생 시 빠른
                  대응이 가능합니다.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">빠른 처리 속도</h3>
                <p className="text-gray-600">
                  큐 시스템과 비동기 처리로 수백 건의 메일도 신속하게 처리합니다. 평균 처리 시간은 3초
                  이내입니다.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">확장 가능</h3>
                <p className="text-gray-600">
                  비즈니스 성장에 따라 플랜을 업그레이드하고 더 많은 업체와 알림을 처리할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-pink-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">팀 협업</h3>
                <p className="text-gray-600">
                  여러 팀원을 초대하고 역할에 따라 다른 권한을 부여하여 효율적으로 협업할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl shadow-xl p-12 text-white mb-24">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">다양한 플랫폼과 연동</h2>
            <p className="text-xl opacity-90">
              Echo Mail은 다양한 서비스와 원활하게 연동됩니다
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <Mail className="w-12 h-12 mx-auto mb-3" />
              <p className="font-semibold">Gmail / Naver</p>
              <p className="text-sm opacity-75 mt-2">IMAP 지원 메일</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <MessageCircle className="w-12 h-12 mx-auto mb-3" />
              <p className="font-semibold">알리고 / NCP</p>
              <p className="text-sm opacity-75 mt-2">SMS 서비스</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <MessageCircle className="w-12 h-12 mx-auto mb-3" />
              <p className="font-semibold">카카오톡</p>
              <p className="text-sm opacity-75 mt-2">비즈메시지 API</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <Shield className="w-12 h-12 mx-auto mb-3" />
              <p className="font-semibold">토스페이먼츠</p>
              <p className="text-sm opacity-75 mt-2">안전한 결제</p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center bg-white rounded-3xl shadow-xl p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Echo Mail로 업무 효율을 높이세요
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            14일 무료체험으로 모든 기능을 체험해보세요. 신용카드 등록 불필요합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/auth/signup">
                무료체험 시작하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6" asChild>
              <Link href="/pricing">요금제 보기</Link>
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