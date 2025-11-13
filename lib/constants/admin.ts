// 슈퍼어드민 이메일 관리
// 클라이언트 사이드에서 환경변수 읽기
const getAdminEmails = (): string[] => {
  // 클라이언트 사이드에서는 window 객체를 통해 환경변수 접근
  if (typeof window !== 'undefined') {
    // Next.js의 NEXT_PUBLIC_ 환경변수는 빌드 시점에 주입됨
    const envEmails = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS
    if (envEmails) {
      console.log('Admin emails from env:', envEmails)
      return envEmails.split(',').map(email => email.trim())
    }
  }

  // 기본값
  console.log('Using default admin email')
  return ['park8374@naver.com']
}

export const SUPER_ADMIN_EMAILS = getAdminEmails()

// 슈퍼어드민 체크 함수
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email)
}