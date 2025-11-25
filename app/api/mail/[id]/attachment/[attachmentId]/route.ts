import { NextRequest, NextResponse } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'

interface RouteParams {
  params: {
    id: string
    attachmentId: string
  }
}

interface AttachmentData {
  id: string
  filename: string
  contentType: string
  size: number
  content?: string | null // Base64 encoded
}

// 첨부파일 다운로드 API
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const { id, attachmentId } = params

      if (!id || !attachmentId) {
        return createErrorResponse('메일 ID와 첨부파일 ID가 필요합니다.', 400)
      }

      // 메일 조회
      const email = await prisma.emailLog.findFirst({
        where: {
          id,
          tenantId, // 테넌트 격리
        },
        select: {
          id: true,
          attachments: true,
        },
      })

      if (!email) {
        return createErrorResponse('메일을 찾을 수 없습니다.', 404)
      }

      // 첨부파일 배열에서 해당 ID 찾기
      const attachments = email.attachments as AttachmentData[] | null
      if (!attachments || !Array.isArray(attachments)) {
        return createErrorResponse('첨부파일이 없습니다.', 404)
      }

      const attachment = attachments.find((att) => att.id === attachmentId)
      if (!attachment) {
        return createErrorResponse('첨부파일을 찾을 수 없습니다.', 404)
      }

      // Base64 콘텐츠가 없는 경우
      if (!attachment.content) {
        return createErrorResponse('첨부파일 내용을 사용할 수 없습니다. (파일이 너무 크거나 이전에 저장되지 않음)', 404)
      }

      // Base64 디코딩
      const fileBuffer = Buffer.from(attachment.content, 'base64')

      logger.info('첨부파일 다운로드', {
        emailId: id,
        attachmentId,
        filename: attachment.filename,
        size: attachment.size,
        tenantId,
      })

      // 파일 다운로드 응답
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': attachment.contentType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
          'Content-Length': fileBuffer.length.toString(),
        },
      })
    } catch (error) {
      logger.error('첨부파일 다운로드 실패:', error)
      return createErrorResponse('첨부파일 다운로드에 실패했습니다.')
    }
  })
}
