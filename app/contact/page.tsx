'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { GlassmorphismCard } from '@/components/ui/glassmorphism-card'
import { GradientText } from '@/components/ui/kinetic-text'
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ui/scroll-reveal'
import { FloatingElement } from '@/components/ui/3d-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import {
  Mail,
  Send,
  MessageCircle,
  Phone,
  MapPin,
  Clock,
  HelpCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { WordMarkLink } from '@/components/ui/wordmark-link'
import { ThemeToggle } from '@/components/theme-toggle'

export default function ContactPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    type: 'inquiry',
    subject: '',
    message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // API 호출 시뮬레이션 (실제로는 /api/contact 엔드포인트 필요)
      await new Promise((resolve) => setTimeout(resolve, 1500))

      toast({
        title: '✅ 문의가 접수되었습니다',
        description: '24시간 내에 답변드리겠습니다.',
      })

      // 폼 초기화
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        type: 'inquiry',
        subject: '',
        message: '',
      })
    } catch (error) {
      toast({
        title: '❌ 오류',
        description: '문의 접수 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

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

        {/* Main Content */}
        <main className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-6xl mx-auto">
            {/* Hero */}
            <div className="text-center mb-20">
              <ScrollReveal>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-white/20 mb-8">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Contact Us</span>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={0.2}>
                <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                  <GradientText>문의하기</GradientText>
                </h1>
              </ScrollReveal>

              <ScrollReveal delay={0.4}>
                <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300">
                  Echo Mail에 대해 궁금한 점이 있으신가요?
                  <br />
                  언제든지 연락주세요.
                </p>
              </ScrollReveal>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-24">
              {/* Contact Information */}
              <div className="lg:col-span-1 space-y-6">
                <ScrollReveal>
                  <GlassmorphismCard>
                    <div className="space-y-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Mail className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">이메일</h3>
                          <p className="text-gray-600 dark:text-gray-300">echomail0924@gmail.com</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            24시간 내 답변
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Phone className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">전화</h3>
                          <p className="text-gray-600 dark:text-gray-300">010-9370-4931</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            평일 09:00 - 16:00
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <MessageCircle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">카카오톡</h3>
                          <p className="text-gray-600 dark:text-gray-300">준비중</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">오픈 예정</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">주소</h3>
                          <p className="text-gray-600 dark:text-gray-300">
                            경기도 광명시 하안동
                          </p>
                        </div>
                      </div>
                    </div>
                  </GlassmorphismCard>
                </ScrollReveal>

                <ScrollReveal delay={0.2}>
                  <GlassmorphismCard className="bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                    <div className="flex items-center gap-3 mb-4">
                      <Clock className="w-6 h-6 text-blue-600" />
                      <h3 className="font-semibold text-lg">운영 시간</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">평일 (월~목)</span>
                        <span className="font-medium">08:00 - 17:00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">금요일</span>
                        <span className="font-medium">08:00 - 12:00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">토/일/공휴일</span>
                        <span className="font-medium text-red-600">휴무</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                      * 이메일 문의는 24시간 접수 가능하며, 영업일 기준 24시간 내 답변드립니다.
                    </p>
                  </GlassmorphismCard>
                </ScrollReveal>
              </div>

              {/* Contact Form */}
              <ScrollReveal delay={0.2} className="lg:col-span-2">
                <GlassmorphismCard>
                  <h2 className="text-2xl md:text-3xl font-bold mb-6">
                    <GradientText>문의 양식</GradientText>
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="name">
                          이름 <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="name"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="홍길동"
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="email">
                          이메일 <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="your@email.com"
                          className="mt-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="phone">연락처</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="010-1234-5678"
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="company">회사명</Label>
                        <Input
                          id="company"
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          placeholder="회사명 (선택)"
                          className="mt-2"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="type">
                        문의 유형 <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value) => setFormData({ ...formData, type: value })}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inquiry">일반 문의</SelectItem>
                          <SelectItem value="demo">데모 요청</SelectItem>
                          <SelectItem value="pricing">요금 문의</SelectItem>
                          <SelectItem value="technical">기술 지원</SelectItem>
                          <SelectItem value="partnership">제휴 문의</SelectItem>
                          <SelectItem value="other">기타</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="subject">
                        제목 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="subject"
                        required
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="문의 제목을 입력하세요"
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="message">
                        내용 <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="message"
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="문의 내용을 상세히 입력해주세요"
                        rows={6}
                        className="mt-2"
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-xl"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          전송 중...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-5 w-5" />
                          문의 보내기
                        </>
                      )}
                    </Button>

                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      문의 접수 후 영업일 기준 24시간 내에 답변드립니다.
                    </p>
                  </form>
                </GlassmorphismCard>
              </ScrollReveal>
            </div>

            {/* FAQ Section */}
            <ScrollReveal>
              <GlassmorphismCard>
                <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    <GradientText>자주 묻는 질문</GradientText>
                  </h2>
                  <p className="text-xl text-gray-600 dark:text-gray-300">
                    문의하기 전에 아래 FAQ를 먼저 확인해보세요
                  </p>
                </div>

                <StaggerContainer className="grid md:grid-cols-2 gap-6">
                  {[
                    {
                      q: '무료체험은 어떻게 시작하나요?',
                      a: '회원가입 후 신용카드 등록 없이 바로 14일 무료체험을 시작할 수 있습니다. 체험 기간이 끝나면 자동으로 결제되지 않습니다.',
                    },
                    {
                      q: '설치나 설정이 어렵나요?',
                      a: '별도 설치 없이 웹 브라우저에서 바로 사용할 수 있습니다. 메일 서버 정보만 입력하면 30분 내에 설정이 완료됩니다.',
                    },
                    {
                      q: '플랜 변경은 언제든지 가능한가요?',
                      a: '네, 언제든지 업그레이드 또는 다운그레이드가 가능합니다. 변경 즉시 적용되며, 비용은 일할 계산됩니다.',
                    },
                    {
                      q: '데이터 보안은 어떻게 보장하나요?',
                      a: 'SSL/TLS 암호화 통신과 엔터프라이즈급 보안 시스템으로 데이터를 안전하게 보호합니다. 정기적인 백업도 수행됩니다.',
                    },
                    {
                      q: '환불 정책은 어떻게 되나요?',
                      a: '서비스에 만족하지 못하신 경우 결제 후 7일 이내 전액 환불이 가능합니다. 별도 수수료는 없습니다.',
                    },
                    {
                      q: '기술 지원은 어떻게 받나요?',
                      a: '이메일, 전화, 카카오톡을 통해 기술 지원을 받을 수 있습니다. 유료 플랜은 우선 지원이 제공됩니다.',
                    },
                  ].map((faq, i) => (
                    <StaggerItem key={i}>
                      <div className="p-6 bg-white/30 dark:bg-white/5 rounded-2xl backdrop-blur-sm hover:bg-white/50 dark:hover:bg-white/10 transition-all">
                        <div className="flex items-start gap-3 mb-3">
                          <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                          <h3 className="font-semibold">{faq.q}</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 text-sm">{faq.a}</p>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>

                <div className="text-center mt-12">
                  <p className="text-gray-600 dark:text-gray-300 mb-4">더 궁금한 사항이 있으신가요?</p>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  >
                    위로 가서 문의하기
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </GlassmorphismCard>
            </ScrollReveal>

            {/* CTA Section */}
            <ScrollReveal>
              <GlassmorphismCard className="text-center mt-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  아직도 <GradientText>고민</GradientText>하시나요?
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                  14일 무료체험으로 Echo Mail을 직접 경험해보세요
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
