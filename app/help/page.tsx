'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, Search, Book, Settings, Users, CreditCard, MessageCircle, HelpCircle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WordMarkLink } from '@/components/ui/wordmark-link'
import { ThemeToggle } from '@/components/theme-toggle'

interface FAQItem {
  question: string
  answer: string
}

interface GuideSection {
  id: string
  title: string
  icon: React.ReactNode
  description: string
  articles: {
    title: string
    href?: string
    content?: string
  }[]
}

const guideSections: GuideSection[] = [
  {
    id: 'getting-started',
    title: '시작 가이드',
    icon: <Book className="w-5 h-5" />,
    description: 'Echo Mail을 처음 사용하시나요? 여기서 시작하세요.',
    articles: [
      { title: '회원가입 및 로그인', content: '이메일과 비밀번호로 간단하게 가입하고, 회사 정보를 입력하면 14일 무료체험이 시작됩니다.' },
      { title: '메일 서버 연결하기', content: '설정 > 메일 설정에서 IMAP 서버 정보를 입력하세요. Gmail, Naver, Daum 등 대부분의 메일 서비스를 지원합니다.' },
      { title: '첫 업체 등록하기', content: '업체 관리 메뉴에서 거래처 정보와 담당자 연락처를 등록하세요. 이메일 도메인으로 자동 매칭됩니다.' },
      { title: '알림 발송 테스트', content: '설정 > 알림 설정에서 테스트 발송 기능으로 SMS가 정상 작동하는지 확인하세요.' },
    ]
  },
  {
    id: 'features',
    title: '주요 기능',
    icon: <Settings className="w-5 h-5" />,
    description: 'Echo Mail의 핵심 기능들을 알아보세요.',
    articles: [
      { title: '대시보드 사용법', content: '대시보드에서 오늘의 발주 현황, 발송 성공률, 최근 활동을 한눈에 확인할 수 있습니다.' },
      { title: '업체 및 담당자 관리', content: '업체별로 여러 담당자를 등록하고, 각 담당자별 알림 수신 여부를 설정할 수 있습니다.' },
      { title: '납품 규칙 설정', content: '지역별, 요일별 납품 규칙을 설정하면 발주 메일 감지 시 자동으로 납기일이 계산됩니다.' },
      { title: '알림 템플릿 편집', content: '발송되는 SMS/카카오톡 메시지 내용을 자유롭게 편집할 수 있습니다. 변수를 사용해 동적 내용을 삽입하세요.' },
      { title: '발송 이력 조회', content: '모든 알림 발송 내역을 날짜별, 업체별, 상태별로 조회하고 통계를 확인할 수 있습니다.' },
    ]
  },
  {
    id: 'settings',
    title: '설정 가이드',
    icon: <Settings className="w-5 h-5" />,
    description: '세부 설정을 통해 서비스를 맞춤 구성하세요.',
    articles: [
      { title: '메일 서버 설정', content: 'IMAP 호스트, 포트, 계정 정보를 입력하세요. SSL/TLS 보안 연결을 권장합니다. 메일 확인 주기는 1~5분 사이로 설정 가능합니다.' },
      { title: 'SMS 설정', content: 'SOLAPI API 키를 입력하고 발신번호를 등록하세요. 테스트 모드에서 먼저 확인 후 실제 발송을 활성화하세요.' },
      { title: '카카오톡 설정', content: '카카오 비즈니스 채널을 연동하고 알림톡 템플릿을 등록하세요. 템플릿 승인 후 발송이 가능합니다.' },
      { title: '팀원 초대', content: '설정 > 팀 관리에서 이메일로 팀원을 초대하고 역할(관리자, 운영자, 뷰어)을 지정할 수 있습니다.' },
    ]
  },
  {
    id: 'billing',
    title: '요금 및 결제',
    icon: <CreditCard className="w-5 h-5" />,
    description: '구독 플랜과 결제에 관한 안내입니다.',
    articles: [
      { title: '요금제 안내', content: 'STARTER(월 29,900원), PROFESSIONAL(월 79,900원), BUSINESS(월 199,900원), ENTERPRISE(별도 문의) 플랜이 있습니다.' },
      { title: '무료체험', content: '회원가입 시 14일간 PROFESSIONAL 플랜의 모든 기능을 무료로 체험할 수 있습니다.' },
      { title: '플랜 변경', content: '설정 > 구독 관리에서 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다.' },
      { title: '결제 수단', content: '신용카드 정기결제를 지원합니다. 토스페이먼츠를 통해 안전하게 결제됩니다.' },
      { title: '환불 정책', content: '결제일로부터 7일 이내 전액 환불이 가능합니다. 이후에는 잔여 기간에 대해 일할 계산됩니다.' },
    ]
  },
  {
    id: 'team',
    title: '팀 관리',
    icon: <Users className="w-5 h-5" />,
    description: '팀원과 함께 서비스를 사용하는 방법입니다.',
    articles: [
      { title: '팀원 초대하기', content: '설정 > 팀 관리에서 초대할 팀원의 이메일을 입력하고 역할을 선택하세요. 초대 메일이 자동 발송됩니다.' },
      { title: '역할 및 권한', content: 'OWNER: 모든 권한 / ADMIN: 설정 관리 / MANAGER: 업체 관리 / OPERATOR: 알림 발송 / VIEWER: 조회만 가능' },
      { title: '팀원 권한 변경', content: '팀 관리 페이지에서 팀원의 역할을 언제든지 변경할 수 있습니다. OWNER만 다른 사용자를 ADMIN으로 지정할 수 있습니다.' },
    ]
  },
]

const faqItems: FAQItem[] = [
  {
    question: '메일 서버 연결이 안 돼요',
    answer: 'IMAP 설정이 올바른지 확인하세요. Gmail의 경우 "보안 수준이 낮은 앱 허용" 또는 앱 비밀번호 사용이 필요합니다. Naver/Daum은 IMAP 사용 설정을 켜야 합니다.'
  },
  {
    question: 'SMS가 발송되지 않아요',
    answer: 'SOLAPI 잔액을 확인하세요. 발신번호가 정상 등록되었는지, 테스트 모드가 해제되었는지 확인하세요. 설정 > 알림에서 SMS 활성화 여부도 확인하세요.'
  },
  {
    question: '발주 메일이 감지되지 않아요',
    answer: '메일 서버 연결 상태를 확인하세요. 업체 이메일/도메인이 정확히 등록되었는지 확인하세요. 키워드 설정이 발주 메일 내용과 일치하는지 확인하세요.'
  },
  {
    question: '무료체험 기간이 끝나면 어떻게 되나요?',
    answer: '14일 무료체험 종료 후 자동으로 무료 플랜으로 전환됩니다. 데이터는 보존되며, 유료 플랜 구독 시 모든 기능이 다시 활성화됩니다.'
  },
  {
    question: '플랜별 차이가 무엇인가요?',
    answer: '주요 차이점은 등록 가능한 업체 수, 담당자 수, 월별 메일 처리량, 알림 발송량입니다. 가격 안내 페이지에서 자세한 비교표를 확인하세요.'
  },
  {
    question: '여러 메일 계정을 연동할 수 있나요?',
    answer: '현재는 테넌트당 1개의 메일 계정만 연동 가능합니다. 여러 계정이 필요하시면 ENTERPRISE 플랜을 문의해 주세요.'
  },
  {
    question: '카카오톡 알림은 언제 사용 가능한가요?',
    answer: '카카오 비즈니스 채널 승인과 알림톡 템플릿 심사가 완료되면 사용 가능합니다. 보통 2-3주 정도 소요됩니다.'
  },
  {
    question: '데이터는 어떻게 보호되나요?',
    answer: '모든 데이터는 암호화되어 저장되며, SSL/TLS로 전송됩니다. 테넌트별 데이터는 완전히 격리되어 다른 사용자가 접근할 수 없습니다.'
  },
]

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started')
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const filteredSections = guideSections.map(section => ({
    ...section,
    articles: section.articles.filter(article =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.articles.length > 0 || section.title.toLowerCase().includes(searchQuery.toLowerCase()))

  const filteredFaqs = faqItems.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-gray-900/70 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <WordMarkLink className="flex items-center gap-3 no-underline">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Echo Mail
              </span>
            </WordMarkLink>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button variant="ghost" asChild>
                <Link href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  홈으로
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <HelpCircle className="w-16 h-16 mx-auto mb-6 opacity-90" />
          <h1 className="text-4xl font-bold mb-4">도움말 센터</h1>
          <p className="text-xl opacity-90 mb-8">Echo Mail 사용에 필요한 모든 정보를 찾아보세요</p>

          {/* Search */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="검색어를 입력하세요..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 text-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-0 shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Guide Sections */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">사용 가이드</h2>

            {filteredSections.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">검색 결과가 없습니다.</p>
              </div>
            ) : (
              filteredSections.map((section) => (
                <div key={section.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white">
                        {section.icon}
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{section.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{section.description}</p>
                      </div>
                    </div>
                    {expandedSection === section.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {expandedSection === section.id && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      {section.articles.map((article, idx) => (
                        <div key={idx} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                          <button
                            onClick={() => setExpandedArticle(expandedArticle === `${section.id}-${idx}` ? null : `${section.id}-${idx}`)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <span className="text-gray-700 dark:text-gray-300">{article.title}</span>
                            {expandedArticle === `${section.id}-${idx}` ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          {expandedArticle === `${section.id}-${idx}` && article.content && (
                            <div className="px-6 pb-4">
                              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                {article.content}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Sidebar - FAQ */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">자주 묻는 질문</h2>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              {filteredFaqs.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400">검색 결과가 없습니다.</p>
                </div>
              ) : (
                filteredFaqs.map((faq, idx) => (
                  <div key={idx} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                      className="w-full px-5 py-4 flex items-start justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                    >
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 pr-4">{faq.question}</span>
                      {expandedFaq === idx ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                    {expandedFaq === idx && (
                      <div className="px-5 pb-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Contact Support */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 text-white">
              <MessageCircle className="w-10 h-10 mb-4 opacity-90" />
              <h3 className="font-semibold text-lg mb-2">추가 도움이 필요하신가요?</h3>
              <p className="text-sm opacity-90 mb-4">
                원하는 답을 찾지 못하셨다면 직접 문의해 주세요.
              </p>
              <Button variant="secondary" className="w-full" asChild>
                <Link href="/contact">
                  문의하기
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>

            {/* Quick Links */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">빠른 링크</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/pricing" className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    요금제 안내
                  </Link>
                </li>
                <li>
                  <Link href="/features" className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    기능 소개
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-2">
                    <Book className="w-4 h-4" />
                    이용약관
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-2">
                    <Book className="w-4 h-4" />
                    개인정보처리방침
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-12 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md">
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
                <Link href="/terms" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  이용약관
                </Link>
                <Link href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  개인정보처리방침
                </Link>
                <Link href="/cookies" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  쿠키 정책
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
