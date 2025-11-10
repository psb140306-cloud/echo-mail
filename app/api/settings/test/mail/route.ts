import { NextRequest } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { testImapConnection } from '@/lib/imap/connection'

// 메일 서버 테스트 스키마
const mailTestSchema = z.object({
  host: z.string().min(1, '메일 서버 주소를 입력해주세요'),
  port: z.number().min(1).max(65535),
  username: z.string().min(1, '사용자명을 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
  useSSL: z.boolean(),
})

// 메일 서버 연결 테스트
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const { data, error } = await parseAndValidate(request, mailTestSchema)
      if (error) return error

      // IMAP 연결 테스트 실행
      const result = await testImapConnection(data)

      if (result.success) {
        return createSuccessResponse(
          {
            success: true,
            mailbox: result.mailbox,
          },
          '메일 서버 연결에 성공했습니다.'
        )
      } else {
        return createErrorResponse(
          `메일 서버 연결에 실패했습니다: ${result.error}`,
          400
        )
      }
    } catch (error: any) {
      logger.error('메일 서버 테스트 중 오류:', error)
      return createErrorResponse(
        error.message || '메일 서버 테스트 중 오류가 발생했습니다.'
      )
    }
  })
}
