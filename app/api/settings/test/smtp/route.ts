import { NextRequest } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { testSmtpConnection } from '@/lib/mail/mail-sender'

export const dynamic = 'force-dynamic'

// SMTP 서버 테스트 스키마
const smtpTestSchema = z.object({
  host: z.string().min(1, 'SMTP 서버 주소를 입력해주세요'),
  port: z.number().min(1).max(65535),
  username: z.string().min(1, '사용자명을 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
  useSSL: z.boolean(),
})

// SMTP 서버 연결 테스트
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const { data, error } = await parseAndValidate(request, smtpTestSchema)
      if (error) return error

      // SMTP 연결 테스트 실행
      const result = await testSmtpConnection({
        host: data.host,
        port: data.port,
        secure: data.useSSL,
        user: data.username,
        password: data.password,
      })

      if (result.success) {
        return createSuccessResponse(
          {
            success: true,
          },
          'SMTP 서버 연결에 성공했습니다.'
        )
      } else {
        return createErrorResponse(
          `SMTP 서버 연결에 실패했습니다: ${result.error}`,
          400
        )
      }
    } catch (error: any) {
      logger.error('SMTP 서버 테스트 중 오류:', error)
      return createErrorResponse(
        error.message || 'SMTP 서버 테스트 중 오류가 발생했습니다.'
      )
    }
  })
}
