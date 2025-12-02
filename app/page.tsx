'use client'

import { useAuth, GuestGuard } from '@/components/providers/auth-provider'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { GlassmorphismCard } from '@/components/ui/glassmorphism-card'
import { BentoGrid, BentoCard } from '@/components/ui/bento-grid'
import { KineticText, GradientText, FloatingText } from '@/components/ui/kinetic-text'
import { Card3D, FloatingElement } from '@/components/ui/3d-card'
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ui/scroll-reveal'
import { WordMarkLink } from '@/components/ui/wordmark-link'
import {
  Mail,
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  BarChart3,
  MessageCircle,
  Clock,
  Users,
  Building,
  CheckCircle2,
  Star,
} from 'lucide-react'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <FloatingElement>
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
            <Mail className="w-10 h-10 text-white animate-pulse" />
          </div>
        </FloatingElement>
      </div>
    )
  }

  return (
    <GuestGuard fallback={<div>대시보드로 이동 중...</div>}>
      <ModernLandingPage />
    </GuestGuard>
  )
}

function ModernLandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Aurora Background */}
      <AuroraBackground className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
        {/* Floating Elements */}
        <div className="absolute top-20 right-20 opacity-20">
          <FloatingElement delay={0}>
            <div className="w-32 h-32 bg-blue-500/30 rounded-full blur-3xl" />
          </FloatingElement>
        </div>
        <div className="absolute bottom-40 left-20 opacity-20">
          <FloatingElement delay={1}>
            <div className="w-40 h-40 bg-purple-500/30 rounded-full blur-3xl" />
          </FloatingElement>
        </div>

        {/* Header */}
        <header className="relative z-50 border-b border-white/20 backdrop-blur-md">
          <div className="container mx-auto px-4 py-6">
            <nav className="flex items-center justify-between">
              <WordMarkLink className="flex items-center space-x-3 no-underline">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur-lg opacity-50" />
                  <div className="relative w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                </div>
                <span className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Echo Mail
                </span>
              </WordMarkLink>
              <div className="flex items-center gap-4">
                <Button variant="ghost" asChild className="hidden md:inline-flex">
                  <a href="/auth/login">로그인</a>
                </Button>
                <Button
                  asChild
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <a href="/auth/signup">무료로 시작하기</a>
                </Button>
              </div>
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-5xl mx-auto text-center">
            <ScrollReveal>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-white/20 mb-8">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">2025 최신 AI 기반 자동화</span>
              </div>
            </ScrollReveal>

            <KineticText className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              발주 확인 자동화로 비즈니스를 혁신하세요
            </KineticText>

            <ScrollReveal delay={0.4}>
              <div className="text-3xl md:text-4xl font-semibold mb-8">
                <GradientText from="from-blue-600" to="to-purple-600">
                  24/7 자동 모니터링으로 모든 발주를 놓치지 마세요
                </GradientText>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
                Echo Mail이 발주 메일을 자동으로 확인하고 SMS/카카오톡으로 즉시 알림을 발송합니다.
                <br />
                <span className="font-semibold text-blue-600">
                  놓치는 발주가 없도록 24/7 모니터링
                </span>
                합니다.
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="text-lg px-10 py-7 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-2xl shadow-blue-500/50"
                  asChild
                >
                  <a href="/auth/signup">
                    14일 무료체험 시작
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-10 py-7 border-2 backdrop-blur-sm"
                  asChild
                >
                  <a href="#features">기능 둘러보기</a>
                </Button>
              </div>
            </ScrollReveal>

            {/* Stats */}
            <ScrollReveal>
              <div className="mt-20 grid grid-cols-3 gap-8">
                <GlassmorphismCard className="text-center" hover={false}>
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    99.9%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">정확도</div>
                </GlassmorphismCard>
                <GlassmorphismCard className="text-center" hover={false}>
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    24/7
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">모니터링</div>
                </GlassmorphismCard>
                <GlassmorphismCard className="text-center" hover={false}>
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    1~5분
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">메일 확인 주기</div>
                </GlassmorphismCard>
              </div>
            </ScrollReveal>
          </div>

          {/* Bento Grid Features */}
          <div id="features" className="mt-32">
            <ScrollReveal>
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold mb-4">
                  <GradientText>강력한 기능</GradientText>으로 업무 자동화
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  Echo Mail의 혁신적인 기능들을 경험하세요
                </p>
              </div>
            </ScrollReveal>

            <BentoGrid>
              <BentoCard colSpan={2} delay={0}>
                <div className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6">
                      <Mail className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">AI 기반 메일 모니터링</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      머신러닝으로 발주 메일을 자동 감지하고 분류합니다. 키워드, 첨부파일, 발신자
                      패턴을 학습하여 정확도를 지속적으로 향상시킵니다.
                    </p>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full text-xs font-medium text-blue-600 dark:text-blue-400">
                      AI 자동 학습
                    </div>
                    <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-full text-xs font-medium text-purple-600 dark:text-purple-400">
                      99.9% 정확도
                    </div>
                  </div>
                </div>
              </BentoCard>

              <BentoCard delay={0.1}>
                <div className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                      <MessageCircle className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">자동 알림 발송</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      발주 메일 감지 즉시 SMS로 담당자에게 알림
                    </p>
                  </div>
                </div>
              </BentoCard>

              <BentoCard delay={0.2}>
                <div className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6">
                      <Zap className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">자동 납기일 계산</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      지역별 규칙으로 정확한 납기일 자동 산출
                    </p>
                  </div>
                </div>
              </BentoCard>

              <BentoCard colSpan={2} delay={0.3}>
                <div className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mb-6">
                      <BarChart3 className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">실시간 대시보드 & 분석</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      발송 현황, 성공률, 업체별 통계를 한눈에 확인하세요. 데이터 기반 의사결정으로
                      비즈니스 성과를 극대화합니다.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="text-center p-3 bg-white/50 dark:bg-white/5 rounded-xl">
                      <div className="text-2xl font-bold text-blue-600">98%</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">발송 성공률</div>
                    </div>
                    <div className="text-center p-3 bg-white/50 dark:bg-white/5 rounded-xl">
                      <div className="text-2xl font-bold text-green-700">2.3초</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">평균 응답시간</div>
                    </div>
                    <div className="text-center p-3 bg-white/50 dark:bg-white/5 rounded-xl">
                      <div className="text-2xl font-bold text-purple-600">10K+</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">월 처리량</div>
                    </div>
                  </div>
                </div>
              </BentoCard>
            </BentoGrid>
          </div>

          {/* Benefits */}
          <div className="mt-32">
            <ScrollReveal>
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold mb-4">
                  왜 <GradientText>Echo Mail</GradientText>을 선택해야 할까요?
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  비즈니스 성장에 집중하세요. Echo Mail이 발주 관리를 자동화합니다.
                </p>
              </div>
            </ScrollReveal>

            <StaggerContainer className="grid md:grid-cols-2 gap-6">
              {[
                { icon: Shield, title: '놓치는 발주 0건 달성', color: 'from-blue-500 to-cyan-500' },
                { icon: Clock, title: '수작업 90% 절감', color: 'from-purple-500 to-pink-500' },
                { icon: Star, title: '고객 만족도 향상', color: 'from-orange-500 to-red-500' },
                { icon: Zap, title: '비용 효율적 운영', color: 'from-green-500 to-emerald-500' },
              ].map((benefit, i) => (
                <StaggerItem key={i}>
                  <GlassmorphismCard delay={i * 0.1}>
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 bg-gradient-to-br ${benefit.color} rounded-xl flex items-center justify-center flex-shrink-0`}
                      >
                        <benefit.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-lg font-semibold">{benefit.title}</span>
                    </div>
                  </GlassmorphismCard>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>

          {/* CTA */}
          <div className="mt-32 text-center">
            <ScrollReveal>
              <GlassmorphismCard className="max-w-4xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  <GradientText>지금 시작하세요</GradientText>
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                  14일 무료체험으로 Echo Mail의 효과를 직접 경험해보세요.
                  <br />
                  신용카드 정보 없이 바로 시작할 수 있습니다.
                </p>
                <Button
                  size="lg"
                  className="text-lg px-12 py-7 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-2xl shadow-blue-500/50"
                  asChild
                >
                  <a href="/auth/signup">
                    무료체험 시작하기
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
              </GlassmorphismCard>
            </ScrollReveal>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-50 mt-32 border-t border-white/20 backdrop-blur-md">
          <div className="container mx-auto px-4 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
              {/* Logo & Description */}
              <div className="lg:col-span-2">
              <WordMarkLink className="flex items-center gap-3 mb-4 no-underline">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Echo Mail
                </span>
              </WordMarkLink>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm">
                  발주 확인 메일을 자동으로 모니터링하고 SMS/카카오톡으로 즉시 알림을 발송하는
                  AI 기반 비즈니스 자동화 솔루션입니다.
                </p>
                <div className="flex gap-3">
                  <a
                    href="#"
                    className="w-10 h-10 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg flex items-center justify-center transition-colors"
                    aria-label="GitHub"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                  </a>
                  <a
                    href="#"
                    className="w-10 h-10 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg flex items-center justify-center transition-colors"
                    aria-label="Twitter"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <a
                    href="#"
                    className="w-10 h-10 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg flex items-center justify-center transition-colors"
                    aria-label="LinkedIn"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Product */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">제품</h3>
                <ul className="space-y-3">
                  <li>
                    <a href="/features" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      주요 기능
                    </a>
                  </li>
                  <li>
                    <a href="/pricing" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      가격 안내
                    </a>
                  </li>
                  <li>
                    <a href="/about" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      서비스 소개
                    </a>
                  </li>
                  <li>
                    <a href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      문의하기
                    </a>
                  </li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">회사</h3>
                <ul className="space-y-3">
                  <li>
                    <a href="/about" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      회사 소개
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      블로그
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      채용
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      파트너십
                    </a>
                  </li>
                </ul>
              </div>

              {/* Support */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">지원</h3>
                <ul className="space-y-3">
                  <li>
                    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      도움말 센터
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      API 문서
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      커뮤니티
                    </a>
                  </li>
                  <li>
                    <a href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      문의하기
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  © 2025 Echo Mail. All rights reserved.
                </div>
                <div className="flex gap-6 text-sm">
                  <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    이용약관
                  </a>
                  <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    개인정보처리방침
                  </a>
                  <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    쿠키 정책
                  </a>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </AuroraBackground>
    </div>
  )
}
