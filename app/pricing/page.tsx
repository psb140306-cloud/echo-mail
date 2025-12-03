'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { GradientText } from '@/components/ui/kinetic-text'
import { GlassmorphismCard } from '@/components/ui/glassmorphism-card'
import {
  Check,
  X,
  Mail,
  ArrowRight,
  Star,
  Building,
  Users,
  MessageCircle,
  BarChart3,
  Shield,
  Headphones,
} from 'lucide-react'
import {
  SubscriptionPlan,
  PLAN_LIMITS,
  PLAN_PRICING,
  getPlanDisplayName,
  getPlanDescription,
  formatLimit,
} from '@/lib/subscription/plans'
import { WordMarkLink } from '@/components/ui/wordmark-link'
import { ThemeToggle } from '@/components/theme-toggle'

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)

  const plans = [
    {
      id: SubscriptionPlan.FREE_TRIAL,
      popular: false,
      cta: '무료체험 시작',
    },
    {
      id: SubscriptionPlan.STARTER,
      popular: false,
      cta: '시작하기',
    },
    {
      id: SubscriptionPlan.PROFESSIONAL,
      popular: true,
      cta: '가장 인기',
    },
    {
      id: SubscriptionPlan.BUSINESS,
      popular: false,
      cta: '비즈니스 시작',
    },
  ]

  const features = [
    { name: '업체 관리', key: 'companies' as const, icon: Building },
    { name: '담당자 관리', key: 'contacts' as const, icon: Users },
    { name: '월 이메일 처리', key: 'emails' as const, icon: Mail },
    { name: '월 알림 발송', key: 'notifications' as const, icon: MessageCircle },
    { name: 'SMS 알림', feature: 'smsNotifications' as const, icon: MessageCircle },
    { name: '카카오톡 알림', feature: 'kakaoNotifications' as const, icon: MessageCircle },
    { name: 'API 액세스', feature: 'apiAccess' as const, icon: BarChart3 },
    { name: '데이터 내보내기', feature: 'exportData' as const, icon: BarChart3 },
    { name: '우선 지원', feature: 'prioritySupport' as const, icon: Headphones },
    { name: 'SLA 보장', feature: 'sla' as const, icon: Shield },
  ]

  const getPrice = (plan: SubscriptionPlan) => {
    const pricing = PLAN_PRICING[plan]
    if (pricing.monthly === 0) return '무료'
    if (pricing.monthly === -1) return '별도 문의'

    const price = isYearly ? pricing.yearly : pricing.monthly
    const discount = isYearly
      ? Math.round(((pricing.monthly * 12 - pricing.yearly) / (pricing.monthly * 12)) * 100)
      : 0

    return {
      price: `₩${price.toLocaleString()}`,
      period: isYearly ? '연' : '월',
      discount: discount > 0 ? `${discount}% 할인` : '',
    }
  }

  const getFeatureValue = (plan: SubscriptionPlan, feature: any) => {
    const limits = PLAN_LIMITS[plan]

    if ('key' in feature) {
      switch (feature.key) {
        case 'companies':
          return formatLimit(limits.maxCompanies, '개')
        case 'contacts':
          return formatLimit(limits.maxContacts, '명')
        case 'emails':
          return formatLimit(limits.maxEmailsPerMonth, '건')
        case 'notifications':
          return formatLimit(limits.maxNotificationsPerMonth, '건')
      }
    }

    if ('feature' in feature) {
      // 카카오톡 알림은 아직 준비중
      if (feature.feature === 'kakaoNotifications') {
        return (
          <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700">
            준비중
          </Badge>
        )
      }
      return limits.features[feature.feature] ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <X className="w-4 h-4 text-gray-400" />
      )
    }

    return ''
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
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
                  <a href="/">홈</a>
                </Button>
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
        <div className="container mx-auto px-4 py-16">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                <GradientText>투명하고 합리적인 요금제</GradientText>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
                비즈니스 규모에 맞는 플랜을 선택하세요. 언제든지 변경 가능합니다.
              </p>

              {/* Billing Toggle */}
              <div className="flex items-center justify-center space-x-4 mb-12">
                <span
                  className={`text-sm ${!isYearly ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  월별 결제
                </span>
                <Switch checked={isYearly} onCheckedChange={setIsYearly} />
                <span className={`text-sm ${isYearly ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                  연간 결제
                </span>
                {isYearly && (
                  <Badge variant="secondary" className="ml-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    2개월 무료!
                  </Badge>
                )}
              </div>
            </div>
          </ScrollReveal>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {plans.map(({ id, popular, cta }) => {
              const limits = PLAN_LIMITS[id]
              const priceInfo = getPrice(id)

              return (
                <Card
                  key={id}
                  className={`relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-white/20 dark:border-gray-700/50 ${popular ? 'ring-2 ring-blue-500 shadow-xl scale-105' : 'shadow-lg'} hover:shadow-xl transition-all`}
                >
                  {popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1">
                        <Star className="w-3 h-3 mr-1" />
                        가장 인기
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">{getPlanDisplayName(id)}</CardTitle>
                    <CardDescription className="text-sm text-gray-600 dark:text-gray-400 min-h-[40px]">
                      {getPlanDescription(id)}
                    </CardDescription>

                    <div className="mt-4">
                      {typeof priceInfo === 'string' ? (
                        <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{priceInfo}</div>
                      ) : (
                        <div>
                          <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            {priceInfo.price}
                            <span className="text-lg font-normal text-gray-600 dark:text-gray-400">
                              /{priceInfo.period}
                            </span>
                          </div>
                          {priceInfo.discount && (
                            <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                              {priceInfo.discount}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <ul className="space-y-3 mb-8">
                      <li className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                        <Building className="w-4 h-4 mr-2 text-blue-500" />
                        <span>업체 {formatLimit(limits.maxCompanies, '개')}</span>
                      </li>
                      <li className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                        <Users className="w-4 h-4 mr-2 text-green-500" />
                        <span>담당자 {formatLimit(limits.maxContacts, '명')}</span>
                      </li>
                      <li className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                        <Mail className="w-4 h-4 mr-2 text-purple-500" />
                        <span>월 이메일 {formatLimit(limits.maxEmailsPerMonth, '건')}</span>
                      </li>
                      <li className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                        <MessageCircle className="w-4 h-4 mr-2 text-orange-500" />
                        <span>월 알림 {formatLimit(limits.maxNotificationsPerMonth, '건')}</span>
                      </li>
                    </ul>

                    <Button
                      className={`w-full ${popular ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' : ''}`}
                      variant={popular ? 'default' : 'outline'}
                      asChild
                    >
                      <a href="/auth/signup">
                        {cta}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Feature Comparison */}
          <Card className="mb-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-white/20 dark:border-gray-700/50">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-gray-900 dark:text-white">상세 기능 비교</CardTitle>
              <CardDescription className="dark:text-gray-400">각 플랜별 제공되는 기능을 자세히 비교해보세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-4 px-4 font-medium text-gray-900 dark:text-white w-[200px]">기능</th>
                      {plans.map(({ id }) => (
                        <th key={id} className="text-center py-4 px-4 font-medium text-gray-900 dark:text-white w-[150px]">
                          {getPlanDisplayName(id)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((feature, index) => (
                      <tr key={index} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          <span className="inline-flex items-center">
                            <feature.icon className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                            {feature.name}
                          </span>
                        </td>
                        {plans.map(({ id }) => (
                          <td key={id} className="py-3 px-4 text-gray-700 dark:text-gray-300">
                            <div className="flex justify-center items-center">
                              {getFeatureValue(id, feature)}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Enterprise Section */}
          <GlassmorphismCard className="bg-gradient-to-r from-gray-900 to-gray-800 text-white border-0">
            <div className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">엔터프라이즈 솔루션</h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                대용량 처리, 맞춤형 기능, 전담 지원이 필요하시나요? 엔터프라이즈 플랜으로 비즈니스를
                한 단계 업그레이드하세요.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="inverted-outline" className="text-lg px-8" asChild>
                  <a href="/contact">상담 요청하기</a>
                </Button>
                <Button size="lg" variant="inverted-outline" className="text-lg px-8" asChild>
                  <a href="/auth/signup">무료체험 시작</a>
                </Button>
              </div>
            </div>
          </GlassmorphismCard>

          {/* FAQ */}
          <div className="mt-16 text-center">
            <h2 className="text-3xl font-bold mb-4">
              <GradientText>자주 묻는 질문</GradientText>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <GlassmorphismCard className="text-left">
                <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">언제든 플랜을 변경할 수 있나요?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  네, 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 변경사항은 다음
                  결제 주기부터 적용됩니다.
                </p>
              </GlassmorphismCard>
              <GlassmorphismCard className="text-left">
                <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">무료체험 기간은 어떻게 되나요?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  모든 플랜에서 14일 무료체험을 제공합니다. 체험 기간 중 언제든 해지할 수 있으며,
                  자동으로 결제되지 않습니다.
                </p>
              </GlassmorphismCard>
              <GlassmorphismCard className="text-left">
                <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">데이터는 안전하게 보관되나요?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  모든 데이터는 암호화되어 안전하게 보관됩니다. 정기적인 백업과 보안 점검으로 데이터
                  보안을 보장합니다.
                </p>
              </GlassmorphismCard>
              <GlassmorphismCard className="text-left">
                <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">기술 지원은 어떻게 받을 수 있나요?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  이메일, 채팅, 전화를 통해 기술 지원을 받을 수 있습니다. 프로페셔널 이상 플랜에서는
                  우선 지원을 제공합니다.
                </p>
              </GlassmorphismCard>
            </div>
          </div>
        </div>

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
                    <Link href="/help" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      도움말 센터
                    </Link>
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
