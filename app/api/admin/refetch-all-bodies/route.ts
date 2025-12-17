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
 * IMAP에서 메일을 가져와서 DB의 EmailLog와 매칭하여 본문 업데이트
 * Message-ID 검색이 안 되는 서버를 위해 전체 fetch 후 매칭 방식 사용
 *
 * Query params:
 * - reset=true: DB 리셋만 수행 (senderName, body, bodyHtml = NULL)
 * - limit=100: IMAP에서 가져올 최근 메일 수
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const resetOnly = searchParams.get('reset') === 'true'
  const limit = parseInt(searchParams.get('limit') || '100', 10)

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

    const account = activeConfigs[0]

    // body가 NULL인 메일의 imapUid 조회
    const emailsToUpdate = await prisma.emailLog.findMany({
      where: {
        tenantId: account.tenantId,
        body: null,
        imapUid: { not: null },
      },
      select: {
        id: true,
        imapUid: true,
      },
    })

    if (emailsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: '처리할 메일이 없습니다.',
        remaining: 0,
      })
    }

    // imapUid를 키로 하는 Map 생성
    const emailMap = new Map<number, string>()
    for (const email of emailsToUpdate) {
      if (email.imapUid) {
        emailMap.set(email.imapUid, email.id)
      }
    }

    logger.info(`[RefetchAllBodies] ${emailsToUpdate.length}개 메일 업데이트 필요`)

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
      let processedCount = 0

      // UID 범위로 fetch - DB에 있는 UID 기준
      const uidsToFetch = Array.from(emailMap.keys())
      const minUid = Math.min(...uidsToFetch)
      const maxUid = Math.max(...uidsToFetch)
      const uidRange = `${minUid}:${maxUid}`

      logger.info(`[RefetchAllBodies] IMAP UID 범위 ${uidRange} 가져오기 (${uidsToFetch.length}개 대상)`)

      for await (const msg of client.fetch(uidRange, {
        envelope: true,
        source: true,
        uid: true,
      }, { uid: true })) {
        processedCount++

        const emailId = emailMap.get(msg.uid)

        if (!emailId) continue // DB에 없는 메일

        if (!msg.source) continue

        try {
          const parsed = await simpleParser(msg.source)
          const senderName = parsed.from?.value?.[0]?.name || null
          const body = parsed.text || ''
          const bodyHtml = parsed.html || null

          await prisma.emailLog.update({
            where: { id: emailId },
            data: {
              senderName,
              body,
              bodyHtml,
            },
          })

          updatedCount++
          emailMap.delete(msgId) // 처리 완료된 것은 제거
        } catch (parseError) {
          logger.warn(`[RefetchAllBodies] 파싱 실패: ${msgId}`)
        }
      }

      await client.logout()

      // 남은 개수 확인
      const remainingCount = await prisma.emailLog.count({
        where: {
          tenantId: account.tenantId,
          body: null,
        },
      })

      logger.info(`[RefetchAllBodies] 완료: ${updatedCount}개 업데이트, ${remainingCount}개 남음`)

      return NextResponse.json({
        success: true,
        message: `${updatedCount}개 메일 업데이트 완료`,
        imapProcessed: processedCount,
        updated: updatedCount,
        remaining: remainingCount,
        uidRange,
        nextUrl: remainingCount > 0
          ? `/api/admin/refetch-all-bodies?limit=${limit}`
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
