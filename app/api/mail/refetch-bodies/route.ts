import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { createImapClient } from '@/lib/imap/connection'
import { simpleParser } from 'mailparser'

export const dynamic = 'force-dynamic'

/**
 * POST /api/mail/refetch-bodies
 * 오염된 메일 본문을 IMAP에서 다시 가져와서 업데이트
 */
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      let tenantId = tenantContext.getTenantId()

      // 쿼리 파라미터에서 tenantId 받기
      const { searchParams } = new URL(request.url)
      const queryTenantId = searchParams.get('tenantId')
      if (queryTenantId && !tenantId) {
        tenantId = queryTenantId
      }

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

      // 모든 메일 조회
      const emails = await prisma.emailLog.findMany({
        where: { tenantId },
        select: {
          id: true,
          messageId: true,
          subject: true,
          sender: true,
        },
        orderBy: { receivedAt: 'desc' },
      })

      if (emails.length === 0) {
        return createSuccessResponse({
          message: '업데이트할 메일이 없습니다.',
          updated: 0,
        })
      }

      logger.info(`[RefetchBodies] ${emails.length}개 메일 재수집 시작`, { tenantId })

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
        let mismatchCount = 0
        const mismatches: { dbSubject: string; imapSubject: string }[] = []

        for (const email of emails) {
          try {
            // Message-ID로 검색
            const cleanMessageId = email.messageId.replace(/^<|>$/g, '')
            const searchResult = await client.search(
              {
                header: { 'message-id': cleanMessageId },
              },
              { uid: true }
            )

            if (searchResult.length === 0) {
              notFoundCount++
              continue
            }

            const uidRange = searchResult.join(',')
            const messages = client.fetch(
              uidRange,
              {
                envelope: true,
                source: true,
              },
              { uid: true }
            )

            for await (const msg of messages) {
              if (!msg.source) continue

              const parsed = await simpleParser(msg.source)
              // 안전장치: message-id가 다르면 다른 메일이므로 업데이트 금지
              const parsedMessageId = (parsed.messageId || '').replace(/^<|>$/g, '')
              if (parsedMessageId && parsedMessageId !== cleanMessageId) {
                mismatchCount++
                logger.warn('[RefetchBodies] message-id 불일치 - 스킵', {
                  expected: cleanMessageId,
                  actual: parsedMessageId,
                })
                continue
              }

              // 제목 비교 (불일치 확인)
              const imapSubject = parsed.subject || ''
              const dbSubject = email.subject || ''

              if (imapSubject !== dbSubject) {
                mismatchCount++
                mismatches.push({
                  dbSubject: dbSubject.substring(0, 50),
                  imapSubject: imapSubject.substring(0, 50),
                })
                logger.warn(`[RefetchBodies] 제목 불일치 발견`, {
                  dbSubject,
                  imapSubject,
                  messageId: email.messageId,
                })
              }

              // 본문 및 발신자 이름 업데이트
              const senderName = parsed.from?.value?.[0]?.name || null
              const body = parsed.text || null
              const bodyHtml = parsed.html || null

              await prisma.emailLog.update({
                where: { id: email.id },
                data: {
                  subject: imapSubject || dbSubject,
                  senderName,
                  body,
                  bodyHtml,
                },
              })

              updatedCount++
              break
            }
          } catch (error) {
            logger.warn(`[RefetchBodies] 메일 처리 실패:`, {
              messageId: email.messageId,
              error: error instanceof Error ? error.message : 'Unknown',
            })
          }
        }

        logger.info(`[RefetchBodies] 완료`, {
          tenantId,
          updated: updatedCount,
          notFound: notFoundCount,
          mismatch: mismatchCount,
        })

        return createSuccessResponse({
          message: '메일 본문 재수집 완료',
          total: emails.length,
          updated: updatedCount,
          notFound: notFoundCount,
          mismatchCount,
          mismatches: mismatches.slice(0, 10), // 최대 10개만
        })
      } finally {
        await client.logout()
      }
    } catch (error) {
      logger.error('[RefetchBodies] 오류:', error)
      return createErrorResponse('메일 본문 재수집 실패')
    }
  })
}
