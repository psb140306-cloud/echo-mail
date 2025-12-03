'use client'

import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WordMarkLink } from '@/components/ui/wordmark-link'
import { ThemeToggle } from '@/components/theme-toggle'

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">개인정보처리방침</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">최종 수정일: 2025년 1월 1일</p>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <section className="mb-8">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Echo Mail(이하 "회사")은 정보주체의 자유와 권리 보호를 위해 「개인정보 보호법」 및 관계 법령이 정한 바를 준수하여,
                적법하게 개인정보를 처리하고 안전하게 관리하고 있습니다.
                이에 「개인정보 보호법」 제30조에 따라 정보주체에게 개인정보 처리에 관한 절차 및 기준을 안내하고,
                이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제1조 (개인정보의 처리 목적)</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며,
                이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>회원 가입 및 관리:</strong> 회원제 서비스 이용에 따른 본인확인, 개인식별, 가입의사 확인, 회원자격 유지·관리</li>
                <li><strong>서비스 제공:</strong> 메일 모니터링, 알림 발송, 업체/담당자 관리, 발송 이력 조회 등 서비스 제공</li>
                <li><strong>요금 결제:</strong> 유료 서비스 이용에 따른 요금 결제 및 정산</li>
                <li><strong>고객 문의 처리:</strong> 고객 문의사항 접수 및 처리, 서비스 이용 관련 안내</li>
                <li><strong>서비스 개선:</strong> 서비스 이용 통계 분석, 신규 서비스 개발 및 기존 서비스 개선</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제2조 (처리하는 개인정보 항목)</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">회사는 다음의 개인정보 항목을 처리하고 있습니다:</p>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-6 mb-3">1. 회원 가입 시 수집 항목</h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>필수: 이메일 주소, 비밀번호, 회사명</li>
                <li>선택: 담당자명, 연락처</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-6 mb-3">2. 서비스 이용 시 수집 항목</h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>메일 서버 연결 정보 (IMAP 호스트, 포트, 계정정보)</li>
                <li>업체 정보 (업체명, 이메일, 도메인)</li>
                <li>담당자 정보 (이름, 연락처)</li>
                <li>서비스 이용 기록, 접속 로그, 접속 IP</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mt-6 mb-3">3. 결제 시 수집 항목</h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>신용카드 결제: 카드사명, 카드번호 (일부 마스킹)</li>
                <li>계좌이체: 은행명, 계좌번호 (일부 마스킹)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제3조 (개인정보의 처리 및 보유기간)</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>회원 정보:</strong> 회원 탈퇴 시까지 (단, 관계 법령에 따라 보존이 필요한 경우 해당 기간)</li>
                <li><strong>서비스 이용 기록:</strong> 3년</li>
                <li><strong>결제 기록:</strong> 5년 (전자상거래법)</li>
                <li><strong>접속 로그:</strong> 3개월 (통신비밀보호법)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제4조 (개인정보의 제3자 제공)</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며,
                정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                현재 회사는 다음과 같이 개인정보를 제3자에게 제공하고 있습니다:
              </p>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left py-2 text-gray-700 dark:text-gray-300">제공받는 자</th>
                      <th className="text-left py-2 text-gray-700 dark:text-gray-300">제공 목적</th>
                      <th className="text-left py-2 text-gray-700 dark:text-gray-300">제공 항목</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 dark:text-gray-400">
                    <tr>
                      <td className="py-2">SMS 발송 서비스 제공업체</td>
                      <td className="py-2">SMS 알림 발송</td>
                      <td className="py-2">수신자 휴대폰 번호</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제5조 (개인정보의 파기)</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>전자적 파일:</strong> 복구 및 재생이 불가능한 방법으로 영구 삭제</li>
                <li><strong>종이 문서:</strong> 분쇄기로 분쇄하거나 소각</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제6조 (정보주체의 권리·의무 및 행사방법)</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li>개인정보 열람 요구</li>
                <li>오류 등이 있을 경우 정정 요구</li>
                <li>삭제 요구</li>
                <li>처리정지 요구</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4">
                위 권리 행사는 서비스 내 설정 메뉴 또는 고객센터(echomail0924@gmail.com)를 통해 하실 수 있습니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제7조 (개인정보의 안전성 확보조치)</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>관리적 조치:</strong> 내부관리계획 수립·시행, 직원 교육</li>
                <li><strong>기술적 조치:</strong> 개인정보처리시스템 등의 접근권한 관리, 암호화 기술 적용, 보안프로그램 설치</li>
                <li><strong>물리적 조치:</strong> 전산실, 자료보관실 등의 접근통제</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제8조 (개인정보 보호책임자)</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여
                아래와 같이 개인정보 보호책임자를 지정하고 있습니다:
              </p>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-gray-600 dark:text-gray-300"><strong>개인정보 보호책임자</strong></p>
                <p className="text-gray-600 dark:text-gray-300">이메일: echomail0924@gmail.com</p>
                <p className="text-gray-600 dark:text-gray-300">전화: 010-9370-4931</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제9조 (개인정보처리방침 변경)</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                이 개인정보처리방침은 2025년 1월 1일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는
                변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
              </p>
            </section>

            <section className="pt-8 border-t border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                본 개인정보처리방침은 2025년 1월 1일부터 시행됩니다.
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
            href="/cookies"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
          >
            쿠키 정책
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
