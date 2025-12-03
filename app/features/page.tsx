'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { GlassmorphismCard } from '@/components/ui/glassmorphism-card'
import { BentoGrid, BentoCard } from '@/components/ui/bento-grid'
import { GradientText } from '@/components/ui/kinetic-text'
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ui/scroll-reveal'
import { FloatingElement } from '@/components/ui/3d-card'
import { WordMarkLink } from '@/components/ui/wordmark-link'
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
  Sparkles,
  Globe,
  Lock,
  Activity,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

export default function FeaturesPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
        {/* Floating Background Elements */}
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
                <ThemeToggle />
                <Button variant="ghost" asChild className="hidden md:inline-flex">
                  <Link href="/pricing">요금제</Link>
                </Button>
                <Button variant="ghost" asChild className="hidden md:inline-flex">
                  <Link href="/auth/login">로그인</Link>
                </Button>
                <Button
                  asChild
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Link href="/auth/signup">무료로 시작하기</Link>
                </Button>
              </div>
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-5xl mx-auto text-center mb-20">
            <ScrollReveal>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-white/20 mb-8">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">강력한 기능들</span>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                비즈니스를 <GradientText>가속화</GradientText>하는
                <br />
                혁신적인 기능들
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.4}>
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8">
                Echo Mail의 핵심 기능들로 발주 관리를 완전히 자동화하세요
              </p>
            </ScrollReveal>
          </div>

          {/* Core Features - Bento Grid */}
          <div className="mb-24">
            <ScrollReveal>
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                <GradientText>핵심 기능</GradientText>
              </h2>
            </ScrollReveal>

            <BentoGrid>
              {/* 자동 메일 모니터링 */}
              <BentoCard colSpan={2} delay={0}>
                <div className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6">
                      <Mail className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">자동 메일 모니터링</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      IMAP 프로토콜로 24/7 자동 모니터링. 키워드 기반으로 발주 메일을 자동 감지하고
                      분류합니다.
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        1~5분 간격 메일 자동 확인
                      </li>
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        키워드 필터링 (제목/본문)
                      </li>
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        첨부파일 유무 확인
                      </li>
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        발신자 이메일/도메인 매칭
                      </li>
                    </ul>
                  </div>
                </div>
              </BentoCard>

              {/* 자동 알림 발송 */}
              <BentoCard delay={0.1}>
                <div className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                      <MessageCircle className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">자동 알림 발송</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                      발주 메일 감지 즉시 SMS로 담당자에게 알림. 카카오톡 연동 예정.
                    </p>
                    <ul className="space-y-2 text-xs">
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        NCP SMS 문자 발송
                      </li>
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        카카오 알림톡 (예정)
                      </li>
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        1~5분 간격 확인
                      </li>
                    </ul>
                  </div>
                </div>
              </BentoCard>

              {/* 스마트 납기일 계산 */}
              <BentoCard delay={0.2}>
                <div className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6">
                      <Clock className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">스마트 납기일 계산</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                      지역별 규칙과 공휴일을 자동 반영하여 정확한 납기일 계산.
                    </p>
                    <ul className="space-y-2 text-xs">
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        지역별 배송 규칙
                      </li>
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        공휴일 자동 반영
                      </li>
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        영업일 기준 계산
                      </li>
                    </ul>
                  </div>
                </div>
              </BentoCard>

              {/* 실시간 대시보드 */}
              <BentoCard colSpan={2} delay={0.3}>
                <div className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mb-6">
                      <BarChart3 className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">대시보드 & 발송 이력</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      발송 현황, 업체별 통계를 한눈에 확인. 모든 발송 이력을 상세하게 기록합니다.
                    </p>
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <div className="text-center p-3 bg-white/50 dark:bg-white/5 rounded-xl">
                        <div className="text-2xl font-bold text-blue-600">24/7</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">자동 모니터링</div>
                      </div>
                      <div className="text-center p-3 bg-white/50 dark:bg-white/5 rounded-xl">
                        <div className="text-2xl font-bold text-green-700">1~5분</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">확인 주기</div>
                      </div>
                      <div className="text-center p-3 bg-white/50 dark:bg-white/5 rounded-xl">
                        <div className="text-2xl font-bold text-purple-600">SMS</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">즉시 발송</div>
                      </div>
                    </div>
                  </div>
                </div>
              </BentoCard>

              {/* 업체 관리 */}
              <BentoCard delay={0.4}>
                <div className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                      <Users className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">업체 관리</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                      거래처와 담당자 정보를 체계적으로 관리하고 커스터마이징.
                    </p>
                    <ul className="space-y-2 text-xs">
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        업체 정보 통합 관리
                      </li>
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        담당자 다중 등록
                      </li>
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        미등록 업체 로그 기록
                      </li>
                    </ul>
                  </div>
                </div>
              </BentoCard>

              {/* 보안 및 안정성 */}
              <BentoCard delay={0.5}>
                <div className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center mb-6">
                      <Shield className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">보안 & 안정성</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                      안전한 데이터 보호와 멀티테넌트 격리. 역할 기반 접근 제어.
                    </p>
                    <ul className="space-y-2 text-xs">
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        SSL/TLS 암호화
                      </li>
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        테넌트 데이터 격리
                      </li>
                      <li className="flex items-center text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        역할 기반 권한 관리
                      </li>
                    </ul>
                  </div>
                </div>
              </BentoCard>
            </BentoGrid>
          </div>

          {/* Additional Features */}
          <div className="mb-24">
            <ScrollReveal>
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  <GradientText>추가 기능</GradientText>
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  더 나은 업무 환경을 위한 다양한 기능들
                </p>
              </div>
            </ScrollReveal>

            <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Settings,
                  title: '유연한 설정',
                  desc: '메일 서버, SMS/카카오톡 API, 알림 템플릿 등 모든 설정을 웹에서 간편하게 관리',
                  color: 'from-blue-500 to-cyan-500',
                },
                {
                  icon: Bell,
                  title: '예외 처리',
                  desc: '미등록 업체, 메일 형식 오류 등 예외 상황을 자동 감지하고 알림',
                  color: 'from-green-500 to-emerald-500',
                },
                {
                  icon: FileText,
                  title: '상세 로그',
                  desc: '모든 메일 수신, 알림 발송 내역을 상세하게 기록하고 추적',
                  color: 'from-purple-500 to-pink-500',
                },
                {
                  icon: Zap,
                  title: '빠른 처리',
                  desc: '메일 감지 후 즉시 SMS 알림 발송',
                  color: 'from-orange-500 to-red-500',
                },
                {
                  icon: TrendingUp,
                  title: '확장 가능',
                  desc: '비즈니스 성장에 따라 플랜 업그레이드 및 기능 확장',
                  color: 'from-indigo-500 to-blue-500',
                },
                {
                  icon: Users,
                  title: '팀 협업',
                  desc: '여러 팀원 초대 및 역할별 권한 관리로 효율적 협업',
                  color: 'from-pink-500 to-rose-500',
                },
              ].map((feature, i) => (
                <StaggerItem key={i}>
                  <GlassmorphismCard delay={i * 0.1} className="h-full">
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center flex-shrink-0`}
                      >
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{feature.desc}</p>
                      </div>
                    </div>
                  </GlassmorphismCard>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>

          {/* Integration Section */}
          <ScrollReveal>
            <GlassmorphismCard className="mb-24 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">다양한 플랫폼과 연동</h2>
                <p className="text-xl opacity-90">Echo Mail은 다양한 서비스와 원활하게 연동됩니다</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { icon: Mail, name: 'Gmail / Naver / Daum', desc: 'IMAP 지원 메일' },
                  { icon: MessageCircle, name: 'NCP SMS', desc: 'SMS 발송 서비스' },
                  { icon: MessageCircle, name: '카카오톡', desc: '알림톡 (예정)' },
                  { icon: Lock, name: '토스페이먼츠', desc: '결제 연동 (예정)' },
                ].map((integration, i) => (
                  <div
                    key={i}
                    className="bg-white/10 backdrop-blur rounded-xl p-6 text-center hover:bg-white/20 transition-all"
                  >
                    <integration.icon className="w-12 h-12 mx-auto mb-3" />
                    <p className="font-semibold">{integration.name}</p>
                    <p className="text-sm opacity-75 mt-2">{integration.desc}</p>
                  </div>
                ))}
              </div>
            </GlassmorphismCard>
          </ScrollReveal>

          {/* Performance Stats */}
          <ScrollReveal>
            <GlassmorphismCard className="mb-24">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">
                  <GradientText>Echo Mail의 특징</GradientText>
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  발주 확인 자동화를 위한 핵심 기능
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {[
                  { value: '24/7', label: '자동 모니터링', icon: Activity },
                  { value: '1~5분', label: '메일 확인 주기', icon: Zap },
                  { value: 'SMS', label: '즉시 알림 발송', icon: Users },
                  { value: 'IMAP', label: '표준 프로토콜', icon: Globe },
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <stat.icon className="w-8 h-8 mx-auto mb-3 text-blue-600" />
                    <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{stat.label}</div>
                  </div>
                ))}
              </div>
            </GlassmorphismCard>
          </ScrollReveal>

          {/* Final CTA */}
          <ScrollReveal>
            <GlassmorphismCard className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                <GradientText>지금 시작하세요</GradientText>
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                14일 무료체험으로 모든 기능을 체험해보세요.
                <br />
                신용카드 등록 불필요합니다.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="text-lg px-10 py-7 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-2xl shadow-blue-500/50"
                  asChild
                >
                  <Link href="/auth/signup">
                    무료체험 시작하기
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-10 py-7 border-2 backdrop-blur-sm"
                  asChild
                >
                  <Link href="/pricing">요금제 보기</Link>
                </Button>
              </div>
            </GlassmorphismCard>
          </ScrollReveal>
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
                  비즈니스 자동화 솔루션입니다.
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
                    <Link href="/features" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      주요 기능
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      가격 안내
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      문의하기
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">회사</h3>
                <ul className="space-y-3">
                  <li>
                    <span className="text-gray-400 dark:text-gray-500">블로그 (준비중)</span>
                  </li>
                  <li>
                    <span className="text-gray-400 dark:text-gray-500">채용 (준비중)</span>
                  </li>
                  <li>
                    <span className="text-gray-400 dark:text-gray-500">파트너십 (준비중)</span>
                  </li>
                </ul>
              </div>

              {/* Support */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">지원</h3>
                <ul className="space-y-3">
                  <li>
                    <span className="text-gray-400 dark:text-gray-500">도움말 센터 (준비중)</span>
                  </li>
                  <li>
                    <span className="text-gray-400 dark:text-gray-500">API 문서 (준비중)</span>
                  </li>
                  <li>
                    <span className="text-gray-400 dark:text-gray-500">커뮤니티 (준비중)</span>
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
