// 슈퍼어드민 이메일 관리
// 환경변수에서 읽어오거나 기본값 사용
export const SUPER_ADMIN_EMAILS =
  process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS?.split(',').map(email => email.trim()) ||
  ['park8374@naver.com']

// 슈퍼어드민 체크 함수
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email)
}