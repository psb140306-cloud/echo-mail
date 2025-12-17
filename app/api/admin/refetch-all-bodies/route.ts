import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createImapClient } from '@/lib/imap/connection'
import { simpleParser } from 'mailparser'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5분 타임아웃

/**
 * GET /api/admin/refetch-all-bodies
 *
 * Query params:
 * - reset=true: DB 리셋만 수행 (senderName, body, bodyHtml = NULL)
 * - skip=0: 건너뛸 메일 수 (페이지네이션)
 * - limit=50: 처리할 메일 수 (기본 50개)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const resetOnly = searchParams.get('reset') === 'true'
  const skip = parseInt(searchParams.get('skip') || '0', 10)
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  try {
    // reset=true인 경우 DB 리셋만 수행
    if (resetOnly) {
      const resetResult = await prisma.emailLog.updateMany({
        data: {
          senderName: null,
          body: null,
          bodyHtml: null,
        },
      })
      logger.info(`[RefetchAllBodies] ${resetResult.count}개 메일 데이터 리셋 완료`)
      return NextResponse.json({
        success: true,
        message: `${resetResult.count}개 메일 데이터 리셋 완료`,
        resetCount: resetResult.count,
      })
    }

    // SystemConfig에서 메일 설정 조회
    const mailConfigs = await prisma.systemConfig.findMany({
      where: {
        key: { startsWith: 'mailServer.' },
      },
    })

    // 테넌트별로 그룹화
    const tenantConfigMap = new Map<string, Record<string, any>>()
    for (const config of mailConfigs) {
      if (!tenantConfigMap.has(config.tenantId)) {
        tenantConfigMap.set(config.tenantId, { tenantId: config.tenantId })
      }
      const [, field] = config.key.split('.')
      const tenantConfig = tenantConfigMap.get(config.tenantId)!
      try {
        tenantConfig[field] = JSON.parse(config.value)
      } catch {
        tenantConfig[field] = config.value
      }
    }

    // 활성화된 설정만 필터링
    const activeConfigs = Array.from(tenantConfigMap.values()).filter(
      (c) => c.enabled === true && c.host && c.port && c.username && c.password
    )

    if (activeConfigs.length === 0) {
      return NextResponse.json({
        success: false,
        error: '활성화된 메일 설정이 없습니다.',
      })
    }

    const account = activeConfigs[0] // 첫 번째 테넌트만 처리
    const results: any = { tenantId: account.tenantId }

    // body가 NULL인 메일만 조회 (아직 처리 안 된 것)
    const emails = await prisma.emailLog.findMany({
      where: {
        tenantId: account.tenantId,
        body: null,
      },
      select: {
        id: true,
        messageId: true,
        subject: true,
        sender: true,
      },
      orderBy: { receivedAt: 'desc' },
      skip,
      take: limit,
    })

    // 전체 남은 개수 확인
    const remainingCount = await prisma.emailLog.count({
      where: {
        tenantId: account.tenantId,
        body: null,
      },
    })

    if (emails.length === 0) {
      return NextResponse.json({
        success: true,
        message: '처리할 메일이 없습니다.',
        remaining: 0,
      })
    }

    logger.info(`[RefetchAllBodies] ${emails.length}개 메일 처리 시작 (남은 개수: ${remainingCount})`)

    // IMAP 연결
    const client = createImapClient({
      host: account.host,
      port: account.port,
      username: account.username,
      password: account.password,
      useSSL: account.useSSL !== false,
    })

    await client.connect()

    try {
      await client.mailboxOpen('INBOX')

      let updatedCount = 0
      let notFoundCount = 0

      for (const email of emails) {
        try {
          const cleanMessageId = email.messageId.replace(/^<|>$/g, '')
          const searchResult = await client.search({
            header: { 'message-id': cleanMessageId },
          })

          if (searchResult.length === 0) {
            notFoundCount++
            // IMAP에서 못 찾은 메일은 빈 문자열로 표시 (다음 배치에서 제외)
            await prisma.emailLog.update({
              where: { id: email.id },
              data: { body: '' },
            })
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
            const senderName = parsed.from?.value?.[0]?.name || null
            const body = parsed.text || ''
            const bodyHtml = parsed.html || null

            await prisma.emailLog.update({
              where: { id: email.id },
              data: {
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

      results.processed = emails.length
      results.updated = updatedCount
      results.notFound = notFoundCount
      results.remaining = remainingCount - emails.length

      logger.info(`[RefetchAllBodies] 완료`, results)

      return NextResponse.json({
        success: true,
        message: `${updatedCount}개 메일 업데이트 완료`,
        ...results,
        nextUrl: results.remaining > 0
          ? `/api/admin/refetch-all-bodies?skip=0&limit=${limit}`
          : null,
      })
    } catch (imapError) {
      await client.logout().catch(() => {})
      throw imapError
    }
  } catch (error) {
    logger.error('[RefetchAllBodies] 오류:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
