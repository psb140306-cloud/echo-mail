import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { createImapClient } from '@/lib/imap/connection'
// @ts-ignore - libmime에 타입 정의 파일이 없음
import { decode as decodeMailHeader } from 'libmime'

/**
 * MIME 인코딩된 헤더 디코딩
 */
function decodeMimeHeader(header: string | undefined): string {
  if (!header) return ''
  try {
    return decodeMailHeader(header) || header
  } catch {
    return header
  }
}

/**
 * IMAP에서 기존 메일의 발신자 이름을 다시 가져와서 업데이트하는 API
 * senderName이 null인 메일들에 대해 IMAP에서 발신자 이름을 조회하여 업데이트
 */
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // 메일 설정 조회
      const mailConfig = await prisma.mailConfig.findUnique({
        where: { tenantId },
      })

      if (!mailConfig || !mailConfig.imapHost) {
        return createErrorResponse('메일 설정이 없습니다.', 400)
      }

      // senderName이 null인 메일 조회
      const emailsToUpdate = await prisma.emailLog.findMany({
        where: {
          tenantId,
          senderName: null,
        },
        select: {
          id: true,
          messageId: true,
          sender: true,
        },
        orderBy: { receivedAt: 'desc' },
        take: 100, // 한번에 최대 100개
      })

      if (emailsToUpdate.length === 0) {
        return createSuccessResponse({
          message: '업데이트할 메일이 없습니다.',
          updated: 0,
        })
      }

      logger.info(`[RefreshSenderNames] ${emailsToUpdate.length}개 메일 업데이트 시작`, { tenantId })

      // IMAP 연결
      const client = createImapClient({
        host: mailConfig.imapHost,
        port: mailConfig.imapPort,
        secure: mailConfig.imapSecure,
        user: mailConfig.username,
        password: mailConfig.password,
      })

      await client.connect()

      try {
        await client.mailboxOpen('INBOX')

        let updatedCount = 0
        let notFoundCount = 0

        // messageId로 메일 찾아서 발신자 이름 업데이트
        for (const email of emailsToUpdate) {
          try {
            // Message-ID로 검색 (헤더에서 <>를 제거)
            const cleanMessageId = email.messageId.replace(/^<|>$/g, '')

            // IMAP에서 해당 메일 검색
            const searchResult = await client.search({
              header: { 'message-id': cleanMessageId }
            })

            if (searchResult.length > 0) {
              // 첫 번째 결과의 envelope 조회
              const messages = client.fetch(searchResult[0], { envelope: true })

              for await (const msg of messages) {
                const from = msg.envelope?.from?.[0]
                if (from?.name) {
                  const senderName = decodeMimeHeader(from.name)

                  if (senderName) {
                    await prisma.emailLog.update({
                      where: { id: email.id },
                      data: { senderName },
                    })
                    updatedCount++
                    logger.info(`[RefreshSenderNames] 업데이트: ${email.sender} -> ${senderName}`)
                  }
                }
                break // 첫 번째 메시지만 처리
              }
            } else {
              notFoundCount++
            }
          } catch (error) {
            logger.warn(`[RefreshSenderNames] 메일 처리 실패:`, {
              messageId: email.messageId,
              error: error instanceof Error ? error.message : 'Unknown',
            })
          }
        }

        logger.info(`[RefreshSenderNames] 완료`, {
          tenantId,
          updated: updatedCount,
          notFound: notFoundCount,
        })

        return createSuccessResponse({
          message: '발신자 이름 업데이트 완료',
          total: emailsToUpdate.length,
          updated: updatedCount,
          notFound: notFoundCount,
        })
      } finally {
        await client.logout()
      }
    } catch (error) {
      logger.error('[RefreshSenderNames] 오류:', error)
      return createErrorResponse('발신자 이름 업데이트 실패')
    }
  })
}
