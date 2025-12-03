'use client'

import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WordMarkLink } from '@/components/ui/wordmark-link'
import { ThemeToggle } from '@/components/theme-toggle'

export default function CookiesPage() {
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

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">쿠키 정책</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">최종 수정일: 2025년 1월 1일</p>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <section className="mb-8">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Echo Mail(이하 "회사")은 서비스 제공을 위해 쿠키 및 유사 기술을 사용합니다.
                본 쿠키 정책은 회사가 쿠키를 어떻게 사용하는지, 그리고 사용자가 쿠키 사용을 어떻게 관리할 수 있는지에 대해 설명합니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">1. 쿠키란 무엇인가요?</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                쿠키는 웹사이트를 방문할 때 사용자의 브라우저에 저장되는 작은 텍스트 파일입니다.
                쿠키는 웹사이트가 사용자의 장치를 인식하고, 사용자의 선호도를 기억하며, 사용자 경험을 개선하는 데 도움이 됩니다.
                쿠키는 일반적으로 웹사이트 이름, 고유 ID, 만료일 등의 정보를 포함합니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">2. 쿠키의 종류</h2>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-6 mb-3">지속 기간에 따른 분류</h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2 ml-4">
                <li><strong>세션 쿠키:</strong> 브라우저를 닫으면 자동으로 삭제되는 임시 쿠키입니다.</li>
                <li><strong>영구 쿠키:</strong> 설정된 만료일까지 사용자의 장치에 저장되는 쿠키입니다.</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-6 mb-3">설정 주체에 따른 분류</h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2 ml-4">
                <li><strong>자사 쿠키:</strong> 방문하는 웹사이트에서 직접 설정하는 쿠키입니다.</li>
                <li><strong>제3자 쿠키:</strong> 방문하는 웹사이트가 아닌 다른 도메인에서 설정하는 쿠키입니다.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">3. Echo Mail이 사용하는 쿠키</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                회사는 다음과 같은 목적으로 쿠키를 사용합니다:
              </p>

              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">필수 쿠키 (Essential Cookies)</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                    서비스의 기본적인 기능을 위해 반드시 필요한 쿠키입니다. 이 쿠키 없이는 서비스를 제공할 수 없습니다.
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                    <li>• 로그인 상태 유지</li>
                    <li>• 세션 관리</li>
                    <li>• 보안 토큰 저장</li>
                    <li>• CSRF 보호</li>
                  </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">기능 쿠키 (Functional Cookies)</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                    사용자 경험을 향상시키기 위해 사용되는 쿠키입니다.
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                    <li>• 테마 설정 (다크모드/라이트모드)</li>
                    <li>• 언어 설정</li>
                    <li>• 사용자 인터페이스 선호도</li>
                  </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">분석 쿠키 (Analytics Cookies)</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                    서비스 사용 현황을 분석하고 개선하기 위해 사용되는 쿠키입니다.
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                    <li>• 방문자 수 및 트래픽 소스 분석</li>
                    <li>• 페이지 조회 통계</li>
                    <li>• 서비스 사용 패턴 분석</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">4. 쿠키 사용 세부 내역</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-left text-gray-700 dark:text-gray-300">쿠키명</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-left text-gray-700 dark:text-gray-300">목적</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-left text-gray-700 dark:text-gray-300">유형</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-4 py-2 text-left text-gray-700 dark:text-gray-300">만료</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 dark:text-gray-400">
                    <tr>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">sb-*-auth-token</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">인증 토큰</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">필수</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">세션</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">theme</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">테마 설정</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">기능</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">1년</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">_ga</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">Google Analytics</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">분석</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">2년</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">5. 쿠키 관리 방법</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                대부분의 웹 브라우저는 쿠키를 자동으로 허용하도록 설정되어 있습니다.
                그러나 브라우저 설정을 변경하여 쿠키를 차단하거나, 쿠키가 설정될 때 알림을 받을 수 있습니다.
              </p>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-6 mb-3">브라우저별 쿠키 설정 방법</h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>Chrome:</strong> 설정 → 개인정보 및 보안 → 쿠키 및 기타 사이트 데이터</li>
                <li><strong>Firefox:</strong> 설정 → 개인정보 및 보안 → 쿠키 및 사이트 데이터</li>
                <li><strong>Safari:</strong> 환경설정 → 개인정보 → 쿠키 및 웹사이트 데이터</li>
                <li><strong>Edge:</strong> 설정 → 쿠키 및 사이트 권한 → 쿠키 및 사이트 데이터 관리</li>
              </ul>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mt-4">
                <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                  <strong>주의:</strong> 필수 쿠키를 차단하면 로그인, 세션 유지 등 서비스의 기본적인 기능이 작동하지 않을 수 있습니다.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">6. 쿠키 정책 변경</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                회사는 법률이나 서비스의 변경사항을 반영하기 위해 본 쿠키 정책을 수시로 업데이트할 수 있습니다.
                중요한 변경사항이 있을 경우 서비스 내 공지 또는 이메일을 통해 알려드립니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">7. 문의하기</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                쿠키 사용에 대해 질문이 있으시면 아래로 연락해 주세요:
              </p>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-gray-600 dark:text-gray-300">이메일: echomail0924@gmail.com</p>
                <p className="text-gray-600 dark:text-gray-300">전화: 010-9370-4931</p>
              </div>
            </section>

            <section className="pt-8 border-t border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                본 쿠키 정책은 2025년 1월 1일부터 시행됩니다.
              </p>
            </section>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/terms"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
          >
            이용약관
          </Link>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <Link
            href="/privacy"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
          >
            개인정보처리방침
          </Link>
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
