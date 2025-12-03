'use client'

import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WordMarkLink } from '@/components/ui/wordmark-link'
import { ThemeToggle } from '@/components/theme-toggle'

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">이용약관</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">최종 수정일: 2025년 1월 1일</p>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제1조 (목적)</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                본 약관은 Echo Mail(이하 "서비스")이 제공하는 발주 확인 자동 알림 서비스의 이용조건 및 절차,
                회사와 회원 간의 권리, 의무 및 책임사항 등을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제2조 (용어의 정의)</h2>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>"서비스"</strong>란 Echo Mail이 제공하는 메일 모니터링 및 알림 발송 서비스를 말합니다.</li>
                <li><strong>"회원"</strong>이란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.</li>
                <li><strong>"테넌트"</strong>란 서비스를 이용하는 개별 기업 또는 단체를 말합니다.</li>
                <li><strong>"업체"</strong>란 회원이 등록한 거래처 정보를 말합니다.</li>
                <li><strong>"담당자"</strong>란 업체에 소속된 연락 대상자를 말합니다.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제3조 (약관의 효력 및 변경)</h2>
              <ol className="list-decimal list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li>본 약관은 서비스를 이용하고자 하는 모든 회원에게 적용됩니다.</li>
                <li>회사는 필요한 경우 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있습니다.</li>
                <li>약관이 변경되는 경우, 회사는 변경 내용을 서비스 내 공지사항 또는 이메일을 통해 사전에 공지합니다.</li>
                <li>회원이 변경된 약관에 동의하지 않는 경우, 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제4조 (회원가입 및 이용계약)</h2>
              <ol className="list-decimal list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li>회원가입은 이용자가 본 약관에 동의하고 회원정보를 기입한 후 회사가 승낙함으로써 체결됩니다.</li>
                <li>회사는 다음 각 호에 해당하는 경우 가입을 거부할 수 있습니다:
                  <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                    <li>타인의 정보를 도용한 경우</li>
                    <li>허위 정보를 기재한 경우</li>
                    <li>기타 회사가 정한 이용요건을 충족하지 못한 경우</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제5조 (서비스의 제공)</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">회사는 다음과 같은 서비스를 제공합니다:</p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li>이메일 자동 모니터링 서비스 (IMAP 프로토콜 기반)</li>
                <li>발주 메일 자동 감지 및 분류</li>
                <li>SMS 알림 발송 서비스</li>
                <li>카카오톡 알림 발송 서비스 (예정)</li>
                <li>업체 및 담당자 관리 기능</li>
                <li>발송 이력 조회 및 통계 기능</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제6조 (서비스 이용요금)</h2>
              <ol className="list-decimal list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li>서비스 이용요금은 회사가 정한 요금정책에 따릅니다.</li>
                <li>회사는 요금제별 기능 및 한도를 별도로 안내하며, 회원은 가입 시 선택한 요금제에 따른 서비스를 이용할 수 있습니다.</li>
                <li>SMS 발송 비용은 실제 발송 건수에 따라 별도 과금될 수 있습니다.</li>
                <li>요금제 변경은 서비스 내 설정에서 가능하며, 변경된 요금제는 다음 결제일부터 적용됩니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제7조 (회원의 의무)</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">회원은 다음 각 호의 행위를 해서는 안 됩니다:</p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li>타인의 정보를 도용하거나 허위 정보를 등록하는 행위</li>
                <li>서비스를 이용하여 스팸 또는 불법적인 메시지를 발송하는 행위</li>
                <li>서비스의 정상적인 운영을 방해하는 행위</li>
                <li>회사 또는 제3자의 지적재산권을 침해하는 행위</li>
                <li>기타 관련 법령 또는 본 약관을 위반하는 행위</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제8조 (서비스 이용 제한)</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                회사는 회원이 본 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우,
                경고, 일시정지, 영구정지 등의 조치를 취할 수 있습니다.
                이 경우 회사는 해당 회원에게 사전 또는 사후에 통지합니다.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제9조 (면책조항)</h2>
              <ol className="list-decimal list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li>회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적인 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.</li>
                <li>회사는 회원의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</li>
                <li>회사는 회원이 등록한 업체 및 담당자 정보의 정확성에 대해 보증하지 않습니다.</li>
                <li>SMS 발송의 경우, 통신사 상황에 따라 발송이 지연되거나 실패할 수 있으며, 이에 대해 회사는 책임을 지지 않습니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제10조 (분쟁해결)</h2>
              <ol className="list-decimal list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li>서비스 이용과 관련하여 회사와 회원 간에 분쟁이 발생한 경우, 양 당사자는 원만한 해결을 위해 성실히 협의합니다.</li>
                <li>협의가 이루어지지 않을 경우, 관련 법령에 따른 관할 법원에서 해결합니다.</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">제11조 (기타)</h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                본 약관에서 정하지 않은 사항은 관련 법령 및 회사가 정한 서비스의 세부이용지침 등에 따릅니다.
              </p>
            </section>

            <section className="pt-8 border-t border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                본 약관은 2025년 1월 1일부터 시행됩니다.
              </p>
            </section>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/privacy"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
          >
            개인정보처리방침
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
