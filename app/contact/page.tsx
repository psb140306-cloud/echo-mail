'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  CheckCircle,
  Loader2,
} from 'lucide-react'

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
        title: '문의가 접수되었습니다',
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
        title: '오류',
        description: '문의 접수 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              <span className="text-blue-600">문의하기</span>
            </h1>
            <p className="text-xl text-gray-600">
              Echo Mail에 대해 궁금한 점이 있으신가요? 언제든지 연락주세요.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            {/* Contact Information */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-6">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-4 mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">이메일</h3>
                      <p className="text-gray-600">support@echomail.co.kr</p>
                      <p className="text-sm text-gray-500 mt-1">24시간 내 답변</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4 mb-6">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">전화</h3>
                      <p className="text-gray-600">02-1234-5678</p>
                      <p className="text-sm text-gray-500 mt-1">평일 09:00 - 18:00</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4 mb-6">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">카카오톡</h3>
                      <p className="text-gray-600">@echomail</p>
                      <p className="text-sm text-gray-500 mt-1">실시간 상담</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">주소</h3>
                      <p className="text-gray-600">
                        서울특별시 강남구
                        <br />
                        테헤란로 123, 4층
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="p-6 bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Clock className="w-6 h-6 text-blue-600" />
                    <h3 className="font-semibold text-lg">운영 시간</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">평일</span>
                      <span className="font-medium">09:00 - 18:00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">토요일</span>
                      <span className="font-medium">10:00 - 15:00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">일요일/공휴일</span>
                      <span className="font-medium text-red-600">휴무</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    * 이메일 문의는 24시간 접수 가능하며, 영업일 기준 24시간 내 답변드립니다.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card className="p-8">
                <CardContent className="pt-6">
                  <h2 className="text-2xl font-bold mb-6">문의 양식</h2>
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
                        />
                      </div>

                      <div>
                        <Label htmlFor="company">회사명</Label>
                        <Input
                          id="company"
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          placeholder="회사명 (선택)"
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
                        <SelectTrigger>
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
                      />
                    </div>

                    <Button type="submit" size="lg" className="w-full" disabled={loading}>
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

                    <p className="text-sm text-gray-500 text-center">
                      문의 접수 후 영업일 기준 24시간 내에 답변드립니다.
                    </p>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-3xl shadow-xl p-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">자주 묻는 질문</h2>
              <p className="text-xl text-gray-600">
                문의하기 전에 아래 FAQ를 먼저 확인해보세요
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3 mb-3">
                    <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                    <h3 className="font-semibold">무료체험은 어떻게 시작하나요?</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    회원가입 후 신용카드 등록 없이 바로 14일 무료체험을 시작할 수 있습니다. 체험 기간이
                    끝나면 자동으로 결제되지 않습니다.
                  </p>
                </CardContent>
              </Card>

              <Card className="p-6 hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3 mb-3">
                    <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                    <h3 className="font-semibold">설치나 설정이 어렵나요?</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    별도 설치 없이 웹 브라우저에서 바로 사용할 수 있습니다. 메일 서버 정보만 입력하면
                    30분 내에 설정이 완료됩니다.
                  </p>
                </CardContent>
              </Card>

              <Card className="p-6 hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3 mb-3">
                    <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                    <h3 className="font-semibold">플랜 변경은 언제든지 가능한가요?</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    네, 언제든지 업그레이드 또는 다운그레이드가 가능합니다. 변경 즉시 적용되며, 비용은
                    일할 계산됩니다.
                  </p>
                </CardContent>
              </Card>

              <Card className="p-6 hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3 mb-3">
                    <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                    <h3 className="font-semibold">데이터 보안은 어떻게 보장하나요?</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    SSL/TLS 암호화 통신과 엔터프라이즈급 보안 시스템으로 데이터를 안전하게 보호합니다.
                    정기적인 백업도 수행됩니다.
                  </p>
                </CardContent>
              </Card>

              <Card className="p-6 hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3 mb-3">
                    <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                    <h3 className="font-semibold">환불 정책은 어떻게 되나요?</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    서비스에 만족하지 못하신 경우 결제 후 7일 이내 전액 환불이 가능합니다. 별도 수수료는
                    없습니다.
                  </p>
                </CardContent>
              </Card>

              <Card className="p-6 hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3 mb-3">
                    <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                    <h3 className="font-semibold">기술 지원은 어떻게 받나요?</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    이메일, 전화, 카카오톡을 통해 기술 지원을 받을 수 있습니다. 유료 플랜은 우선
                    지원이 제공됩니다.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-12">
              <p className="text-gray-600 mb-4">더 궁금한 사항이 있으신가요?</p>
              <Button variant="outline" size="lg" asChild>
                <Link href="#contact-form" onClick={(e) => {
                  e.preventDefault()
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}>
                  문의하기
                </Link>
              </Button>
            </div>
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