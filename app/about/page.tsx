'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { GlassmorphismCard } from '@/components/ui/glassmorphism-card'
import { GradientText } from '@/components/ui/kinetic-text'
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ui/scroll-reveal'
import { FloatingElement } from '@/components/ui/3d-card'
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
  Sparkles,
  CheckCircle,
  Rocket,
  Star,
  Lightbulb,
} from 'lucide-react'

export default function AboutPage() {
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
              <Link href="/" className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur-lg opacity-50" />
                  <div className="relative w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                </div>
                <span className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Echo Mail
                </span>
              </Link>
              <div className="flex items-center gap-4">
                <Button variant="ghost" asChild className="hidden md:inline-flex">
                  <Link href="/features">기능</Link>
                </Button>
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
                <span className="text-sm font-medium">About Echo Mail</span>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                우리는
                <br />
                <GradientText>비즈니스 자동화의 미래</GradientText>를 만듭니다
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.4}>
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8">
                Echo Mail은 발주 관리 자동화를 통해
                <br />
                비즈니스의 효율성을 극대화하는 SaaS 플랫폼입니다.
              </p>
            </ScrollReveal>
          </div>

          {/* Mission & Vision */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
            <ScrollReveal>
              <GlassmorphismCard className="h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">우리의 미션</h2>
                <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
                  모든 비즈니스가 반복적인 업무에서 벗어나 진정으로 중요한 일에 집중할 수 있도록 돕습니다.
                  발주 확인과 알림 발송을 자동화하여 시간과 비용을 절감하고, 고객 만족도를 높입니다.
                </p>
              </GlassmorphismCard>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <GlassmorphismCard className="h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">우리의 비전</h2>
                <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
                  국내를 넘어 글로벌 시장에서 비즈니스 자동화 솔루션의 선두주자가 되고자 합니다. AI와
                  머신러닝을 활용한 차세대 스마트 자동화 플랫폼으로 진화해 나갈 것입니다.
                </p>
              </GlassmorphismCard>
            </ScrollReveal>
          </div>

          {/* Core Values */}
          <ScrollReveal>
            <GlassmorphismCard className="mb-24">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  <GradientText>핵심 가치</GradientText>
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">Echo Mail이 지향하는 가치들입니다</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    icon: Zap,
                    title: '혁신',
                    desc: '끊임없는 기술 혁신으로 더 나은 서비스를 제공합니다. 사용자의 피드백을 빠르게 반영하여 지속적으로 발전합니다.',
                    color: 'from-blue-500 to-cyan-500',
                  },
                  {
                    icon: Heart,
                    title: '고객 중심',
                    desc: '고객의 성공이 우리의 성공입니다. 고객의 니즈를 최우선으로 생각하며, 최상의 고객 경험을 제공합니다.',
                    color: 'from-green-500 to-emerald-500',
                  },
                  {
                    icon: Shield,
                    title: '신뢰',
                    desc: '엔터프라이즈급 보안과 99.9% 가용성으로 고객의 신뢰를 얻습니다. 데이터 보호를 최우선으로 합니다.',
                    color: 'from-purple-500 to-pink-500',
                  },
                ].map((value, i) => (
                  <div key={i} className="text-center">
                    <div
                      className={`w-20 h-20 bg-gradient-to-br ${value.color} rounded-full flex items-center justify-center mx-auto mb-6`}
                    >
                      <value.icon className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300">{value.desc}</p>
                  </div>
                ))}
              </div>
            </GlassmorphismCard>
          </ScrollReveal>

          {/* Company Story */}
          <ScrollReveal>
            <GlassmorphismCard className="mb-24 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <Lightbulb className="w-10 h-10" />
                  <h2 className="text-3xl md:text-4xl font-bold text-center">우리의 이야기</h2>
                </div>
                <div className="space-y-6 text-lg leading-relaxed">
                  <p className="opacity-95">
                    Echo Mail은 실제 비즈니스 현장에서 겪었던 불편함에서 시작되었습니다. 수많은 발주 메일을
                    확인하고, 담당자에게 일일이 연락하는 반복적인 업무가 비효율적이라는 것을 깨달았습니다.
                  </p>
                  <p className="opacity-95">
                    <span className="font-semibold">
                      "이 과정을 자동화할 수 있다면 얼마나 많은 시간과 비용을 절약할 수 있을까?"
                    </span>{' '}
                    라는 질문에서 Echo Mail이 탄생했습니다.
                  </p>
                  <p className="opacity-95">
                    2024년, 소규모 팀으로 시작한 Echo Mail은 현재 수백 개의 기업이 신뢰하는 플랫폼으로
                    성장했습니다. 고객들의 소중한 피드백을 바탕으로 지속적으로 발전하고 있으며, 더 많은
                    비즈니스가 자동화의 혜택을 누릴 수 있도록 노력하고 있습니다.
                  </p>
                </div>
              </div>
            </GlassmorphismCard>
          </ScrollReveal>

          {/* Stats */}
          <ScrollReveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-24">
              {[
                { value: '100+', label: '활성 고객사', icon: Users, color: 'text-blue-600' },
                { value: '50K+', label: '월 처리 메일', icon: Mail, color: 'text-green-600' },
                { value: '99.9%', label: '시스템 가용성', icon: Shield, color: 'text-purple-600' },
                { value: '24/7', label: '무중단 모니터링', icon: Globe, color: 'text-orange-600' },
              ].map((stat, i) => (
                <GlassmorphismCard key={i} className="text-center" hover={false}>
                  <stat.icon className={`w-10 h-10 mx-auto mb-3 ${stat.color}`} />
                  <div className={`text-4xl font-bold mb-2 ${stat.color}`}>{stat.value}</div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{stat.label}</p>
                </GlassmorphismCard>
              ))}
            </div>
          </ScrollReveal>

          {/* Why Choose Us */}
          <ScrollReveal>
            <GlassmorphismCard className="mb-24">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Echo Mail을 <GradientText>선택하는 이유</GradientText>
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  수많은 기업들이 Echo Mail을 신뢰하는 이유입니다
                </p>
              </div>

              <StaggerContainer className="grid md:grid-cols-2 gap-8">
                {[
                  {
                    icon: Award,
                    title: '검증된 기술력',
                    desc: '최신 기술 스택과 엔터프라이즈급 인프라로 안정적인 서비스를 제공합니다. 수년간의 개발 경험과 노하우가 담겨 있습니다.',
                    color: 'from-blue-500 to-cyan-500',
                  },
                  {
                    icon: Users,
                    title: '전문 고객 지원',
                    desc: '빠른 응답과 친절한 상담으로 고객의 문제를 신속하게 해결합니다. 온보딩부터 운영까지 전 과정을 지원합니다.',
                    color: 'from-green-500 to-emerald-500',
                  },
                  {
                    icon: TrendingUp,
                    title: '지속적인 개선',
                    desc: '매월 새로운 기능이 추가되고 기존 기능이 개선됩니다. 고객의 피드백을 적극 반영하여 함께 성장합니다.',
                    color: 'from-purple-500 to-pink-500',
                  },
                  {
                    icon: Shield,
                    title: '투명한 운영',
                    desc: '명확한 요금제, 숨겨진 비용 없음, 언제든 해지 가능한 유연한 정책으로 고객의 권리를 최우선으로 합니다.',
                    color: 'from-orange-500 to-red-500',
                  },
                ].map((reason, i) => (
                  <StaggerItem key={i}>
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 bg-gradient-to-br ${reason.color} rounded-xl flex items-center justify-center flex-shrink-0`}
                      >
                        <reason.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{reason.title}</h3>
                        <p className="text-gray-600 dark:text-gray-300">{reason.desc}</p>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </GlassmorphismCard>
          </ScrollReveal>

          {/* Team Section */}
          <ScrollReveal>
            <GlassmorphismCard className="mb-24">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  <GradientText>우리 팀</GradientText>
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  다양한 분야의 전문가들이 Echo Mail을 만들어갑니다
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    emoji: '💻',
                    title: '개발팀',
                    desc: '최신 기술로 안정적이고 확장 가능한 시스템을 구축합니다',
                    color: 'from-blue-400 to-blue-600',
                  },
                  {
                    emoji: '🎨',
                    title: '디자인팀',
                    desc: '직관적이고 아름다운 사용자 경험을 디자인합니다',
                    color: 'from-green-400 to-green-600',
                  },
                  {
                    emoji: '💬',
                    title: '고객지원팀',
                    desc: '고객의 성공을 위해 항상 함께합니다',
                    color: 'from-purple-400 to-purple-600',
                  },
                ].map((team, i) => (
                  <div key={i} className="text-center">
                    <div
                      className={`w-24 h-24 bg-gradient-to-br ${team.color} rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg`}
                    >
                      <span className="text-4xl">{team.emoji}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{team.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300">{team.desc}</p>
                  </div>
                ))}
              </div>
            </GlassmorphismCard>
          </ScrollReveal>

          {/* Roadmap */}
          <ScrollReveal>
            <GlassmorphismCard className="mb-24">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  <GradientText>로드맵</GradientText>
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">Echo Mail의 미래를 함께 만들어갑니다</p>
              </div>

              <div className="space-y-6">
                {[
                  {
                    quarter: '2025 Q1',
                    title: 'AI 기반 이메일 분류 고도화',
                    items: ['머신러닝 모델 정확도 향상', '자동 학습 시스템 구축', '다국어 지원'],
                    status: 'completed',
                  },
                  {
                    quarter: '2025 Q2',
                    title: '모바일 앱 출시',
                    items: ['iOS/Android 네이티브 앱', '푸시 알림 기능', '오프라인 모드'],
                    status: 'in-progress',
                  },
                  {
                    quarter: '2025 Q3',
                    title: 'API 플랫폼 오픈',
                    items: ['RESTful API 공개', '개발자 문서 제공', '파트너 프로그램 런칭'],
                    status: 'planned',
                  },
                  {
                    quarter: '2025 Q4',
                    title: '글로벌 확장',
                    items: ['해외 시장 진출', '다중 통화 지원', '현지화 서비스'],
                    status: 'planned',
                  },
                ].map((milestone, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-6 bg-white/30 dark:bg-white/5 rounded-2xl backdrop-blur-sm"
                  >
                    <div className="flex-shrink-0">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          milestone.status === 'completed'
                            ? 'bg-green-500'
                            : milestone.status === 'in-progress'
                              ? 'bg-blue-500'
                              : 'bg-gray-400'
                        }`}
                      >
                        {milestone.status === 'completed' ? (
                          <CheckCircle className="w-6 h-6 text-white" />
                        ) : milestone.status === 'in-progress' ? (
                          <Rocket className="w-6 h-6 text-white" />
                        ) : (
                          <Star className="w-6 h-6 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {milestone.quarter}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            milestone.status === 'completed'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : milestone.status === 'in-progress'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {milestone.status === 'completed'
                            ? '완료'
                            : milestone.status === 'in-progress'
                              ? '진행중'
                              : '예정'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold mb-2">{milestone.title}</h3>
                      <ul className="space-y-1">
                        {milestone.items.map((item, j) => (
                          <li key={j} className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </GlassmorphismCard>
          </ScrollReveal>

          {/* Final CTA */}
          <ScrollReveal>
            <GlassmorphismCard className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Echo Mail과 함께 <GradientText>성장</GradientText>하세요
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                14일 무료체험으로 Echo Mail의 가치를 직접 경험해보세요
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
                  <Link href="/contact">문의하기</Link>
                </Button>
              </div>
            </GlassmorphismCard>
          </ScrollReveal>
        </main>

        {/* Footer */}
        <footer className="relative z-50 mt-32 border-t border-white/20 backdrop-blur-md">
          <div className="container mx-auto px-4 py-12">
            <div className="flex items-center justify-center mb-8">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mr-3">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Echo Mail
              </span>
            </div>
            <div className="flex justify-center flex-wrap gap-6 mb-8">
              <Link
                href="/features"
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                기능
              </Link>
              <Link
                href="/pricing"
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                요금제
              </Link>
              <Link
                href="/about"
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                회사소개
              </Link>
              <Link
                href="/contact"
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                문의하기
              </Link>
            </div>
            <div className="text-center text-gray-600 dark:text-gray-400">
              © 2025 Echo Mail. All rights reserved.
            </div>
          </div>
        </footer>
      </AuroraBackground>
    </div>
  )
}
