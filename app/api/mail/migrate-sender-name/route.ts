import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/validation'

export const dynamic = 'force-dynamic'

/**
 * 기존 메일의 senderName을 sender 필드에서 파싱하여 업데이트하는 마이그레이션 API
 * sender 형식: "이름" <email@example.com> 또는 이름 <email@example.com>
 */
function parseSenderName(sender: string): string | null {
  if (!sender) return null

  // "이름" <email@example.com> 형식
  const quotedMatch = sender.match(/^"([^"]+)"\s*<[^>]+>$/)
  if (quotedMatch) {
    return quotedMatch[1].trim()
  }

  // 이름 <email@example.com> 형식 (따옴표 없음)
  const unquotedMatch = sender.match(/^([^<]+)\s*<[^>]+>$/)
  if (unquotedMatch) {
    const name = unquotedMatch[1].trim()
    // 이메일 주소가 아닌 경우만 이름으로 처리
    if (!name.includes('@')) {
      return name
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    // senderName이 null인 메일 조회
    const emailsToUpdate = await prisma.emailLog.findMany({
      where: {
        senderName: null,
      },
      select: {
        id: true,
        sender: true,
      },
    })

    logger.info(`[MigrateSenderName] ${emailsToUpdate.length}개 메일 업데이트 시작`)

    let updatedCount = 0
    let skippedCount = 0

    for (const email of emailsToUpdate) {
      const senderName = parseSenderName(email.sender)

      if (senderName) {
        await prisma.emailLog.update({
          where: { id: email.id },
          data: { senderName },
        })
        updatedCount++
        logger.info(`[MigrateSenderName] 업데이트: ${email.sender} -> ${senderName}`)
      } else {
        skippedCount++
      }
    }

    logger.info(`[MigrateSenderName] 완료: 업데이트 ${updatedCount}, 스킵 ${skippedCount}`)

    return createSuccessResponse({
      message: '마이그레이션 완료',
      total: emailsToUpdate.length,
      updated: updatedCount,
      skipped: skippedCount,
    })
  } catch (error) {
    logger.error('[MigrateSenderName] 오류:', error)
    return createErrorResponse('마이그레이션 실패')
  }
}

export async function GET(request: NextRequest) {
  try {
    // 현재 상태 조회
    const [totalCount, nullCount, withNameCount] = await Promise.all([
      prisma.emailLog.count(),
      prisma.emailLog.count({ where: { senderName: null } }),
      prisma.emailLog.count({ where: { senderName: { not: null } } }),
    ])

    // 샘플 데이터 조회
    const samples = await prisma.emailLog.findMany({
      select: {
        sender: true,
        senderName: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: 5,
    })

    return createSuccessResponse({
      total: totalCount,
      withSenderName: withNameCount,
      withoutSenderName: nullCount,
      samples,
    })
  } catch (error) {
    logger.error('[MigrateSenderName] 상태 조회 오류:', error)
    return createErrorResponse('상태 조회 실패')
  }
}
