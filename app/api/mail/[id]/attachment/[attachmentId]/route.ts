import { NextRequest, NextResponse } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { createImapClient, ImapConfig } from '@/lib/imap/connection'
import { simpleParser } from 'mailparser'

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
  partId?: string
  content?: string | null // Base64 encoded (기존 데이터 호환용)
}

/**
 * 테넌트의 IMAP 설정 조회
 */
async function getImapConfig(tenantId: string): Promise<ImapConfig | null> {
  const mailConfigs = await prisma.systemConfig.findMany({
    where: {
      tenantId,
      key: {
        startsWith: 'mailServer.',
      },
    },
  })

  if (mailConfigs.length === 0) return null

  const config: Record<string, any> = {}
  for (const mc of mailConfigs) {
    const [, field] = mc.key.split('.')
    try {
      config[field] = JSON.parse(mc.value)
    } catch {
      config[field] = mc.value
    }
  }

  if (!config.host || !config.port || !config.username || !config.password) {
    return null
  }

  return {
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    useSSL: config.useSSL ?? true,
  }
}

/**
 * IMAP에서 첨부파일 실시간 fetch
 */
async function fetchAttachmentFromImap(
  imapConfig: ImapConfig,
  imapUid: number,
  attachmentFilename: string
): Promise<Buffer | null> {
  const client = createImapClient(imapConfig)

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      // UID로 메일 전체 소스 가져오기
      let mailSource: Buffer | null = null

      for await (const message of client.fetch(
        { uid: imapUid },
        { source: true }
      )) {
        if (message.source) {
          mailSource = message.source
          break
        }
      }

      if (!mailSource) {
        logger.warn('IMAP에서 메일을 찾을 수 없음', { imapUid })
        return null
      }

      // mailparser로 파싱하여 첨부파일 추출
      const parsed = await simpleParser(mailSource)

      if (!parsed.attachments || parsed.attachments.length === 0) {
        logger.warn('메일에 첨부파일이 없음', { imapUid })
        return null
      }

      // 파일명으로 첨부파일 찾기
      const attachment = parsed.attachments.find(
        (att) => att.filename === attachmentFilename
      )

      if (!attachment) {
        logger.warn('해당 첨부파일을 찾을 수 없음', {
          imapUid,
          attachmentFilename,
          availableFiles: parsed.attachments.map((a) => a.filename),
        })
        return null
      }

      return attachment.content
    } finally {
      lock.release()
    }
  } catch (error) {
    logger.error('IMAP 첨부파일 fetch 실패:', error)
    return null
  } finally {
    try {
      await client.logout()
    } catch {
      // 로그아웃 실패 무시
    }
  }
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

      // 메일 조회 (imapUid 포함)
      const email = await prisma.emailLog.findFirst({
        where: {
          id,
          tenantId, // 테넌트 격리
        },
        select: {
          id: true,
          imapUid: true,
          messageId: true,
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

      let fileBuffer: Buffer

      // 1. 기존 Base64 콘텐츠가 있으면 그것을 사용 (기존 데이터 호환)
      if (attachment.content) {
        fileBuffer = Buffer.from(attachment.content, 'base64')
        logger.info('첨부파일 다운로드 (DB 캐시)', {
          emailId: id,
          attachmentId,
          filename: attachment.filename,
        })
      } else {
        // 2. IMAP에서 실시간 fetch
        if (!email.imapUid) {
          return createErrorResponse(
            '첨부파일을 다운로드할 수 없습니다. (IMAP UID 없음)',
            404
          )
        }

        const imapConfig = await getImapConfig(tenantId)
        if (!imapConfig) {
          return createErrorResponse(
            '메일 서버 설정을 찾을 수 없습니다.',
            500
          )
        }

        logger.info('첨부파일 IMAP fetch 시작', {
          emailId: id,
          attachmentId,
          filename: attachment.filename,
          imapUid: email.imapUid,
        })

        const fetchedContent = await fetchAttachmentFromImap(
          imapConfig,
          email.imapUid,
          attachment.filename
        )

        if (!fetchedContent) {
          return createErrorResponse(
            '첨부파일을 원본 메일에서 가져올 수 없습니다. 메일이 삭제되었거나 이동되었을 수 있습니다.',
            404
          )
        }

        fileBuffer = fetchedContent

        logger.info('첨부파일 다운로드 (IMAP fetch)', {
          emailId: id,
          attachmentId,
          filename: attachment.filename,
          size: fileBuffer.length,
        })
      }

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
