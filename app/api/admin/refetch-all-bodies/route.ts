import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createImapClient } from '@/lib/imap/connection'
import { simpleParser } from 'mailparser'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5분 타임아웃

/**
 * GET /api/admin/refetch-all-bodies
 * 모든 테넌트의 오염된 메일 본문을 IMAP에서 다시 가져와서 업데이트
 * 인증 없이 실행 가능 (일회성 복구용)
 */
export async function GET(request: NextRequest) {
  const results: any[] = []

  try {
    // 모든 메일 설정 조회
    const mailConfigs = await prisma.mailConfig.findMany({
      where: {
        imapHost: { not: null },
      },
      select: {
        tenantId: true,
        imapHost: true,
        imapPort: true,
        imapSecure: true,
        username: true,
        password: true,
      },
    })

    logger.info(`[RefetchAllBodies] ${mailConfigs.length}개 테넌트 처리 시작`)

    for (const config of mailConfigs) {
      if (!config.imapHost) continue

      try {
        // 해당 테넌트의 모든 메일 조회
        const emails = await prisma.emailLog.findMany({
          where: { tenantId: config.tenantId },
          select: {
            id: true,
            messageId: true,
            subject: true,
            sender: true,
          },
          orderBy: { receivedAt: 'desc' },
        })

        if (emails.length === 0) {
          results.push({
            tenantId: config.tenantId,
            status: 'skipped',
            reason: 'no emails',
          })
          continue
        }

        logger.info(`[RefetchAllBodies] 테넌트 ${config.tenantId}: ${emails.length}개 메일 처리`)

        // IMAP 연결
        const client = createImapClient({
          host: config.imapHost,
          port: config.imapPort,
          secure: config.imapSecure,
          user: config.username,
          password: config.password,
        })

        await client.connect()

        try {
          await client.mailboxOpen('INBOX')

          let updatedCount = 0
          let notFoundCount = 0
          let mismatchCount = 0

          for (const email of emails) {
            try {
              const cleanMessageId = email.messageId.replace(/^<|>$/g, '')
              const searchResult = await client.search({
                header: { 'message-id': cleanMessageId },
              })

              if (searchResult.length === 0) {
                notFoundCount++
                continue
              }

              // UID 모드로 fetch
              const messages = client.fetch(searchResult[0], {
                envelope: true,
                source: true,
              }, { uid: true })

              for await (const msg of messages) {
                if (!msg.source) continue

                const parsed = await simpleParser(msg.source)
                const imapSubject = parsed.subject || ''
                const dbSubject = email.subject || ''

                if (imapSubject !== dbSubject) {
                  mismatchCount++
                  logger.warn(`[RefetchAllBodies] 불일치: DB="${dbSubject}" vs IMAP="${imapSubject}"`)
                }

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
              logger.warn(`[RefetchAllBodies] 메일 처리 실패: ${email.messageId}`)
            }
          }

          await client.logout()

          results.push({
            tenantId: config.tenantId,
            status: 'success',
            total: emails.length,
            updated: updatedCount,
            notFound: notFoundCount,
            mismatch: mismatchCount,
          })

          logger.info(`[RefetchAllBodies] 테넌트 ${config.tenantId} 완료: ${updatedCount}개 업데이트, ${mismatchCount}개 불일치`)
        } catch (imapError) {
          await client.logout().catch(() => {})
          throw imapError
        }
      } catch (error) {
        results.push({
          tenantId: config.tenantId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        logger.error(`[RefetchAllBodies] 테넌트 ${config.tenantId} 오류:`, error)
      }
    }

    logger.info(`[RefetchAllBodies] 전체 완료`, { results })

    return NextResponse.json({
      success: true,
      message: '메일 본문 재수집 완료',
      results,
    })
  } catch (error) {
    logger.error('[RefetchAllBodies] 전체 오류:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
