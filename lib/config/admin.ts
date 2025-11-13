// 슈퍼어드민 설정
// 환경변수 또는 하드코딩된 값 사용

export function getSuperAdminEmails(): string[] {
  // 클라이언트와 서버 모두에서 작동
  const envEmails = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS

  if (envEmails) {
    console.log('[Admin Config] Using emails from env:', envEmails)
    return envEmails.split(',').map(email => email.trim().toLowerCase())
  }

  // 기본값
  const defaultEmails = ['park8374@naver.com']
  console.log('[Admin Config] Using default emails:', defaultEmails)
  return defaultEmails
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) {
    console.log('[Admin Config] No email provided')
    return false
  }

  const adminEmails = getSuperAdminEmails()
  const normalizedEmail = email.toLowerCase()
  const isAdmin = adminEmails.includes(normalizedEmail)

  console.log('[Admin Config] Checking admin status:', {
    email: normalizedEmail,
    adminEmails,
    isAdmin
  })

  return isAdmin
}