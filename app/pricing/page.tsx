'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
      return limits.features[feature.feature] ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <X className="w-4 h-4 text-gray-400" />
      )
    }

    return ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="relative z-50">
        <div className="container mx-auto px-4 py-6">
          <nav className="flex items-center justify-between">
            <WordMarkLink className="flex items-center space-x-2 text-gray-900 no-underline">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-inherit">Echo Mail</span>
            </WordMarkLink>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <a href="/">홈</a>
              </Button>
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
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            투명하고 합리적인 요금제
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            비즈니스 규모에 맞는 플랜을 선택하세요. 언제든지 변경 가능합니다.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-12">
            <span
              className={`text-sm ${!isYearly ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
            >
              월별 결제
            </span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <span className={`text-sm ${isYearly ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              연간 결제
            </span>
            {isYearly && (
              <Badge variant="secondary" className="ml-2">
                2개월 무료!
              </Badge>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {plans.map(({ id, popular, cta }) => {
            const limits = PLAN_LIMITS[id]
            const priceInfo = getPrice(id)

            return (
              <Card
                key={id}
                className={`relative ${popular ? 'ring-2 ring-blue-500 shadow-xl scale-105' : 'shadow-lg'} hover:shadow-xl transition-all`}
              >
                {popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white px-4 py-1">
                      <Star className="w-3 h-3 mr-1" />
                      가장 인기
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-xl font-bold">{getPlanDisplayName(id)}</CardTitle>
                  <CardDescription className="text-sm text-gray-600 min-h-[40px]">
                    {getPlanDescription(id)}
                  </CardDescription>

                  <div className="mt-4">
                    {typeof priceInfo === 'string' ? (
                      <div className="text-3xl font-bold text-gray-900">{priceInfo}</div>
                    ) : (
                      <div>
                        <div className="text-3xl font-bold text-gray-900">
                          {priceInfo.price}
                          <span className="text-lg font-normal text-gray-600">
                            /{priceInfo.period}
                          </span>
                        </div>
                        {priceInfo.discount && (
                          <div className="text-sm text-green-600 font-medium">
                            {priceInfo.discount}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center text-sm">
                      <Building className="w-4 h-4 mr-2 text-blue-500" />
                      <span>업체 {formatLimit(limits.maxCompanies, '개')}</span>
                    </li>
                    <li className="flex items-center text-sm">
                      <Users className="w-4 h-4 mr-2 text-green-500" />
                      <span>담당자 {formatLimit(limits.maxContacts, '명')}</span>
                    </li>
                    <li className="flex items-center text-sm">
                      <Mail className="w-4 h-4 mr-2 text-purple-500" />
                      <span>월 이메일 {formatLimit(limits.maxEmailsPerMonth, '건')}</span>
                    </li>
                    <li className="flex items-center text-sm">
                      <MessageCircle className="w-4 h-4 mr-2 text-orange-500" />
                      <span>월 알림 {formatLimit(limits.maxNotificationsPerMonth, '건')}</span>
                    </li>
                  </ul>

                  <Button
                    className={`w-full ${popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
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
        <Card className="mb-16">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">상세 기능 비교</CardTitle>
            <CardDescription>각 플랜별 제공되는 기능을 자세히 비교해보세요</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-4 px-4 font-medium">기능</th>
                    {plans.map(({ id }) => (
                      <th key={id} className="text-center py-4 px-4 font-medium">
                        {getPlanDisplayName(id)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 flex items-center">
                        <feature.icon className="w-4 h-4 mr-2 text-gray-500" />
                        {feature.name}
                      </td>
                      {plans.map(({ id }) => (
                        <td key={id} className="text-center py-3 px-4">
                          {getFeatureValue(id, feature)}
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
        <Card className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">엔터프라이즈 솔루션</h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              대용량 처리, 맞춤형 기능, 전담 지원이 필요하시나요? 엔터프라이즈 플랜으로 비즈니스를
              한 단계 업그레이드하세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="inverted-outline" className="text-lg px-8">
                상담 요청하기
              </Button>
              <Button size="lg" variant="inverted-outline" className="text-lg px-8">
                데모 요청하기
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">자주 묻는 질문</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="text-left">
              <h3 className="font-semibold text-lg mb-2">언제든 플랜을 변경할 수 있나요?</h3>
              <p className="text-gray-600">
                네, 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 변경사항은 다음
                결제 주기부터 적용됩니다.
              </p>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-lg mb-2">무료체험 기간은 어떻게 되나요?</h3>
              <p className="text-gray-600">
                모든 플랜에서 14일 무료체험을 제공합니다. 체험 기간 중 언제든 해지할 수 있으며,
                자동으로 결제되지 않습니다.
              </p>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-lg mb-2">데이터는 안전하게 보관되나요?</h3>
              <p className="text-gray-600">
                모든 데이터는 암호화되어 안전하게 보관됩니다. 정기적인 백업과 보안 점검으로 데이터
                보안을 보장합니다.
              </p>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-lg mb-2">기술 지원은 어떻게 받을 수 있나요?</h3>
              <p className="text-gray-600">
                이메일, 채팅, 전화를 통해 기술 지원을 받을 수 있습니다. 프로페셔널 이상 플랜에서는
                우선 지원을 제공합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-24">
        <div className="container mx-auto px-4 py-12">
          <WordMarkLink className="flex items-center justify-center mb-8 text-white no-underline">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-inherit">Echo Mail</span>
          </WordMarkLink>
          <div className="text-center text-gray-400">© 2025 Echo Mail. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
