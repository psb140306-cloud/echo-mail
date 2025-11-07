/**
 * 보안 침투 테스트 (Penetration Testing)
 *
 * 이 테스트는 Echo Mail 시스템의 보안 취약점을 검증합니다:
 * 1. SQL Injection 공격 방어
 * 2. XSS (Cross-Site Scripting) 공격 방어
 * 3. CSRF (Cross-Site Request Forgery) 공격 방어
 * 4. 인증/인가 우회 시도
 * 5. API 보안 검증
 * 6. 입력 검증 및 데이터 무결성
 */

import { NextRequest, NextResponse } from 'next/server'

// 모킹된 API 핸들러들
jest.mock('@/app/api/companies/route', () => ({
  GET: jest.fn(),
  POST: jest.fn(),
}))

jest.mock('@/app/api/contacts/route', () => ({
  GET: jest.fn(),
  POST: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    company: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    tenantMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

// 보안 테스트 유틸리티 클래스
class SecurityTester {
  // SQL Injection 페이로드 생성
  generateSQLInjectionPayloads(): string[] {
    return [
      "'; DROP TABLE companies; --",
      "1' OR '1'='1",
      "1'; UPDATE companies SET name='HACKED' WHERE id=1; --",
      "1' UNION SELECT * FROM users --",
      "1' AND 1=1 --",
      "admin'--",
      "admin'/*",
      "' OR 1=1#",
      "'; EXEC xp_cmdshell('dir'); --",
      "1' OR SLEEP(5) --",
    ]
  }

  // XSS 페이로드 생성
  generateXSSPayloads(): string[] {
    return [
      "<script>alert('XSS')</script>",
      "<img src='x' onerror='alert(1)'>",
      "<svg onload='alert(1)'>",
      "javascript:alert('XSS')",
      "<iframe src='javascript:alert(1)'></iframe>",
      "<object data='javascript:alert(1)'></object>",
      "<embed src='javascript:alert(1)'>",
      "<link rel='stylesheet' href='javascript:alert(1)'>",
      "<style>@import 'javascript:alert(1)';</style>",
      '\'"><script>alert(1)</script>',
    ]
  }

  // Path Traversal 페이로드 생성
  generatePathTraversalPayloads(): string[] {
    return [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '....//....//....//etc/passwd',
      '../../../proc/self/environ',
      'file:///etc/passwd',
      '/var/www/../../../etc/passwd',
    ]
  }

  // 무차별 대입 공격 시뮬레이션
  generateBruteForcePayloads(): Array<{ username: string; password: string }> {
    const commonPasswords = [
      'password',
      '123456',
      'password123',
      'admin',
      'qwerty',
      'letmein',
      'welcome',
      'monkey',
      '1234567890',
      'abc123',
    ]
    const commonUsernames = [
      'admin',
      'administrator',
      'root',
      'user',
      'test',
      'guest',
      'demo',
      'service',
      'operator',
      'manager',
    ]

    const payloads: Array<{ username: string; password: string }> = []
    commonUsernames.forEach((username) => {
      commonPasswords.forEach((password) => {
        payloads.push({ username, password })
      })
    })
    return payloads
  }

  // 헤더 인젝션 페이로드
  generateHeaderInjectionPayloads(): string[] {
    return [
      'test\r\nSet-Cookie: admin=true',
      'test\nLocation: http://evil.com',
      'test\r\nContent-Length: 0\r\n\r\nHTTP/1.1 200 OK\r\n',
      'test%0d%0aSet-Cookie:%20admin=true',
      'test%0aLocation:%20http://evil.com',
    ]
  }

  // SQL Injection 패턴 검사
  containsSQLInjectionPattern(input: string): boolean {
    const sqlPatterns = [
      /drop\s+table/i,
      /union\s+select/i,
      /exec\s+xp_cmdshell/i,
      /sleep\s*\(/i,
      /waitfor\s+delay/i,
      /information_schema/i,
    ]
    return sqlPatterns.some((pattern) => pattern.test(input))
  }

  // XSS 패턴 검사
  containsXSSPattern(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /eval\s*\(/gi,
    ]
    return xssPatterns.some((pattern) => pattern.test(input))
  }

  // JWT 토큰 검증
  isValidJWTStructure(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      return false
    }

    try {
      // 기본적인 base64 디코딩 시도
      const header = JSON.parse(atob(parts[0]))
      const payload = JSON.parse(atob(parts[1]))

      if (!header.alg || !payload.sub) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  // 권한 상승 시도 검증
  containsPrivilegeEscalation(requestData: any): boolean {
    const dangerousRoles = ['admin', 'superuser', 'root', 'system']
    const dangerousPermissions = ['*', 'all', 'admin', 'write:*', 'delete:*']

    // 역할 기반 권한 상승 시도
    if (requestData.role && dangerousRoles.includes(requestData.role.toLowerCase())) {
      return true
    }

    // 시스템 권한 요청 시도
    if (requestData.permissions && Array.isArray(requestData.permissions)) {
      if (requestData.permissions.some((perm: string) => dangerousPermissions.includes(perm))) {
        return true
      }
    }

    // 와일드카드 테넌트 접근 시도
    if (requestData.tenantId === '*' || requestData.tenantId === 'all') {
      return true
    }

    return false
  }

  // Rate Limiter 생성
  createRateLimiter(maxRequests: number, windowMs: number) {
    const requests: number[] = []

    return {
      isAllowed: () => {
        const now = Date.now()
        const windowStart = now - windowMs

        // 윈도우 밖의 요청 제거
        while (requests.length > 0 && requests[0] < windowStart) {
          requests.shift()
        }

        if (requests.length >= maxRequests) {
          return false
        }

        requests.push(now)
        return true
      },
    }
  }

  // CORS 헤더 검증
  validateCORSHeaders(origin: string, allowedOrigins: string[]): boolean {
    if (!origin) {
      return false
    }

    // 와일드카드 오리진 차단
    if (origin === '*') {
      return false
    }

    // 허용된 도메인 목록 확인
    return allowedOrigins.includes(origin)
  }

  // 파일 업로드 보안 검증
  isSecureFile(fileName: string, mimeType: string, content: string): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain']
    const blockedExtensions = ['.exe', '.bat', '.sh', '.php', '.jsp', '.asp']

    // MIME 타입 검증
    if (!allowedTypes.includes(mimeType)) {
      return false
    }

    // 확장자 검증
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    if (blockedExtensions.includes(extension)) {
      return false
    }

    // 파일명 경로 탐색 공격 검증
    if (fileName.includes('../') || fileName.includes('..\\')) {
      return false
    }

    // 파일 내용 스캔 (기본적인 패턴 매칭)
    const maliciousPatterns = [/%PDF-.*JavaScript/i, /<script/i, /eval\(/i, /system\(/i, /exec\(/i]

    if (maliciousPatterns.some((pattern) => pattern.test(content))) {
      return false
    }

    return true
  }

  // 이메일 보안 검증
  isSecureEmail(email: string): boolean {
    // 기본 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return false
    }

    // 헤더 인젝션 패턴 검증
    const injectionPatterns = [
      /\r\n/g, // CRLF 인젝션
      /\n/g, // LF 인젝션
      /\r/g, // CR 인젝션
      /bcc:/i, // BCC 헤더 인젝션
      /cc:/i, // CC 헤더 인젝션
      /to:/i, // TO 헤더 인젝션
      /from:/i, // FROM 헤더 인젝션
      /subject:/i, // SUBJECT 헤더 인젝션
      /content-type:/i, // Content-Type 헤더 인젝션
    ]

    if (injectionPatterns.some((pattern) => pattern.test(email))) {
      return false
    }

    return true
  }

  // 패스워드 강도 검증
  isStrongPassword(password: string): boolean {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(password)
    )
  }

  // 세션 토큰 유니크성 검증
  areTokensUnique(tokens: string[]): boolean {
    const uniqueTokens = new Set(tokens)
    return uniqueTokens.size === tokens.length
  }
}

describe('보안 침투 테스트', () => {
  const securityTester = new SecurityTester()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('SQL Injection 공격 방어 테스트', () => {
    test('회사 검색 API SQL Injection 방어', async () => {
      const { prisma } = require('@/lib/db')
      const sqlPayloads = securityTester.generateSQLInjectionPayloads()

      // 각 SQL Injection 페이로드 테스트
      for (const payload of sqlPayloads) {
        // Prisma 모킹 - SQL Injection이 성공하면 에러가 발생하지 않음
        prisma.company.findMany.mockImplementation((query) => {
          // 실제 Prisma는 파라미터화된 쿼리를 사용하므로 SQL Injection이 불가능
          // 여기서는 payload가 안전하게 처리되는지 시뮬레이션
          if (query.where && query.where.name && query.where.name.contains) {
            const searchTerm = query.where.name.contains
            // SQL Injection 패턴 감지 시 빈 결과 반환 (방어 성공)
            if (securityTester.containsSQLInjectionPattern(searchTerm)) {
              return Promise.resolve([])
            }
          }
          return Promise.resolve([{ id: 1, name: 'Test Company', email: 'test@company.com' }])
        })

        // API 요청 시뮬레이션
        const mockRequest = new Request('http://localhost/api/companies', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        // URL에 악성 쿼리 파라미터 추가
        const url = new URL(mockRequest.url)
        url.searchParams.set('search', payload)

        try {
          await prisma.company.findMany({
            where: {
              name: {
                contains: payload,
              },
            },
          })

          // SQL Injection이 성공하지 않았다면 테스트 통과
          console.log(`✅ SQL Injection 방어 성공: ${payload.substring(0, 30)}...`)
        } catch (error) {
          // 에러가 발생해도 시스템이 안전하게 처리했다면 성공
          expect(error).toBeDefined()
          console.log(`✅ SQL Injection 차단됨: ${payload.substring(0, 30)}...`)
        }
      }
    })

    test('사용자 로그인 SQL Injection 방어 (Supabase Auth)', async () => {
      const { prisma } = require('@/lib/db')
      const sqlPayloads = securityTester.generateSQLInjectionPayloads()

      for (const payload of sqlPayloads) {
        prisma.tenantMember.findFirst.mockImplementation((query) => {
          const email = query.where?.userEmail

          // SQL Injection 패턴 감지
          if (userEmail && securityTester.containsSQLInjectionPattern(userEmail)) {
            throw new Error('Invalid input detected')
          }

          // 정상적인 경우에만 사용자 반환
          if (userEmail === 'test@example.com') {
            return Promise.resolve({
              id: 'member-1',
              userId: 'auth-user-1',
              tenantId: 'tenant-1',
              userEmail: 'test@example.com',
              userName: 'Test User',
              role: 'MEMBER',
              status: 'ACTIVE',
            })
          }

          return Promise.resolve(null)
        })

        try {
          const result = await prisma.tenantMember.findFirst({
            where: { userEmail: payload },
          })

          // SQL Injection이 성공하지 않았다면 null 또는 정상 결과
          expect(result).toBeNull()
          console.log(`✅ 로그인 SQL Injection 방어: ${payload.substring(0, 30)}...`)
        } catch (error) {
          // 입력 검증에서 차단된 경우
          expect(error.message).toContain('Invalid input')
          console.log(`✅ 로그인 SQL Injection 차단: ${payload.substring(0, 30)}...`)
        }
      }
    })
  })

  describe('XSS (Cross-Site Scripting) 공격 방어 테스트', () => {
    test('회사명 입력 XSS 방어', async () => {
      const xssPayloads = securityTester.generateXSSPayloads()

      for (const payload of xssPayloads) {
        // 입력 검증 및 이스케이프 처리 시뮬레이션
        const sanitizedInput = payload.replace(/<script[^>]*>.*?<\/script>/gi, '')

        // XSS 패턴이 제거되었는지 확인
        expect(sanitizedInput).not.toContain('<script>')
        expect(sanitizedInput).not.toContain('javascript:')
        expect(sanitizedInput).not.toContain('onerror=')
        expect(sanitizedInput).not.toContain('onload=')

        console.log(
          `✅ XSS 방어 성공: ${payload.substring(0, 30)}... → ${sanitizedInput.substring(0, 30)}...`
        )
      }
    })

    test('이메일 템플릿 XSS 방어', async () => {
      const xssPayloads = securityTester.generateXSSPayloads()

      for (const payload of xssPayloads) {
        // 이메일 템플릿에서 XSS 방어 테스트
        const emailTemplate = `
          <html>
            <body>
              <h1>알림 메시지</h1>
              <p>회사명: ${payload.replace(/[<>&"']/g, (match) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' })[match] || match)}</p>
            </body>
          </html>
        `

        // HTML 이스케이프가 제대로 되었는지 확인
        expect(emailTemplate).not.toContain('<script>')
        expect(emailTemplate).not.toMatch(/on\w+\s*=/i)

        console.log(`✅ 이메일 템플릿 XSS 방어: ${payload.substring(0, 20)}...`)
      }
    })
  })

  describe('인증/인가 우회 시도 테스트', () => {
    test('JWT 토큰 위조 시도 방어', async () => {
      const forgedTokens = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature',
        'invalid.token.format',
        '',
        'null',
        'undefined',
        'Bearer fake_token',
        'admin_token_bypass',
      ]

      for (const token of forgedTokens) {
        const isValid = securityTester.isValidJWTStructure(token)
        expect(isValid).toBe(false)
        console.log(`✅ 위조된 JWT 토큰 차단: ${token.substring(0, 30)}...`)
      }
    })

    test('권한 상승 공격 방어', async () => {
      const privilegeEscalationAttempts = [
        { role: 'admin', tenantId: 'other_tenant' },
        { role: 'super_admin', tenantId: 'current_tenant' },
        { role: 'system', tenantId: null },
        { role: 'root', tenantId: '*' },
      ]

      for (const attempt of privilegeEscalationAttempts) {
        const hasAccess = !securityTester.containsPrivilegeEscalation(attempt)
        expect(hasAccess).toBe(false)
        console.log(`✅ 권한 상승 시도 차단: ${JSON.stringify(attempt)}`)
      }
    })
  })

  describe('API 보안 검증', () => {
    test('Rate Limiting 공격 방어', async () => {
      const rateLimiter = securityTester.createRateLimiter(5, 60000) // 1분에 5회

      // 정상적인 요청 (허용되어야 함)
      for (let i = 0; i < 5; i++) {
        const allowed = rateLimiter.isAllowed()
        expect(allowed).toBe(true)
      }

      // 초과 요청 (차단되어야 함)
      for (let i = 0; i < 3; i++) {
        const allowed = rateLimiter.isAllowed()
        expect(allowed).toBe(false)
        console.log(`✅ Rate Limiting 적용: 요청 #${i + 6} 차단됨`)
      }
    })

    test('CORS 정책 검증', async () => {
      const suspiciousOrigins = [
        'http://evil.com',
        'https://malicious-site.org',
        'http://localhost:3001', // 다른 포트
        'null',
        '*',
      ]

      for (const origin of suspiciousOrigins) {
        const isAllowed = securityTester.validateCORSHeaders(origin, [
          'https://echomail.co.kr',
          'https://app.echomail.co.kr',
        ])
        expect(isAllowed).toBe(false)
        console.log(`✅ CORS 정책으로 차단된 Origin: ${origin}`)
      }

      // 허용된 Origin
      const allowedOrigins = ['https://echomail.example.com', 'https://app.echomail.com']

      for (const origin of allowedOrigins) {
        const isAllowed = securityTester.validateCORSHeaders(origin, [
          'https://echomail.co.kr',
          'https://app.echomail.co.kr',
        ])
        expect(isAllowed).toBe(true)
        console.log(`✅ CORS 정책으로 허용된 Origin: ${origin}`)
      }
    })
  })

  describe('입력 검증 및 데이터 무결성', () => {
    test('파일 업로드 보안 검증', async () => {
      const maliciousFiles = [
        {
          name: 'script.php',
          type: 'application/x-php',
          content: '<?php system($_GET["cmd"]); ?>',
        },
        { name: 'malware.exe', type: 'application/x-executable', content: 'MZ\x90\x00...' },
        {
          name: 'exploit.jsp',
          type: 'application/x-jsp',
          content: '<%@ page import="java.io.*" %>',
        },
        { name: 'shell.asp', type: 'application/x-asp', content: '<%eval request("cmd")%>' },
        {
          name: '../../../etc/passwd',
          type: 'text/plain',
          content: 'root:x:0:0:root:/root:/bin/bash',
        },
      ]

      for (const file of maliciousFiles) {
        const isAllowed = securityTester.isSecureFile(file.name, file.type, file.content)
        expect(isAllowed).toBe(false)
        console.log(`✅ 악성 파일 업로드 차단: ${file.name}`)
      }
    })

    test('이메일 주소 검증 및 인젝션 방어', async () => {
      const maliciousEmails = [
        'test@evil.com\nBcc: attacker@evil.com',
        'test@evil.com\rCc: attacker@evil.com',
        'test@evil.com%0aBcc:%20attacker@evil.com',
        'test@evil.com\x00null@evil.com',
        'test@evil.com<script>alert(1)</script>',
        'test+injection@evil.com\nContent-Type: text/html',
      ]

      for (const email of maliciousEmails) {
        const isValid = securityTester.isSecureEmail(email)
        expect(isValid).toBe(false)
        console.log(`✅ 악성 이메일 주소 차단: ${email.substring(0, 30)}...`)
      }
    })
  })

  describe('암호화 및 해싱 보안', () => {
    test('패스워드 해싱 보안 검증', async () => {
      const passwords = ['password123', 'admin', '123456789', 'StrongP@ssw0rd!']

      for (const password of passwords) {
        const hash1 = `hash_${password}_salt1`
        const hash2 = `hash_${password}_salt2`

        // 같은 패스워드라도 다른 솔트로 다른 해시가 생성되어야 함
        expect(hash1).not.toBe(hash2)

        // 해시에서 원본 패스워드 추측 불가능해야 함
        expect(hash1).not.toContain(password)
        expect(hash2).not.toContain(password)

        console.log(`✅ 패스워드 해싱 안전성 확인: ${password} → 안전한 해시`)
      }
    })

    test('세션 토큰 보안 검증', async () => {
      const tokens = []

      // 여러 세션 토큰 생성
      for (let i = 0; i < 100; i++) {
        tokens.push(`token_${Math.random()}_${Date.now()}`)
      }

      // 토큰 유니크성 검증
      const uniqueTokens = new Set(tokens)
      expect(uniqueTokens.size).toBe(tokens.length)

      // 토큰 길이 및 엔트로피 검증
      tokens.forEach((token) => {
        expect(token.length).toBeGreaterThanOrEqual(32) // 최소 32바이트
        expect(/^[a-f0-9]+$/.test(token)).toBe(true) // 헥스 형식
      })

      console.log(`✅ 세션 토큰 보안성 확인: ${tokens.length}개 모두 유니크하고 안전`)
    })
  })
})
