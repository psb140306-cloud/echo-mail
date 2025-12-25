/**
 * 공휴일 자동 생성 Cron Job
 * - 매년 12월 1일 실행 (Vercel Cron: 0 0 1 12 *)
 * - 모든 활성 테넌트에 대해 다음 연도 공휴일 자동 생성
 * - 기존 테넌트 중 공휴일이 없는 경우도 현재 연도 + 다음 연도 생성
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { generateHolidays } from '@/lib/utils/holiday-calculator'

export const dynamic = 'force-dynamic'

export const maxDuration = 300 // 5분 타임아웃

export async function GET(request: NextRequest) {
  try {
    // Cron job 인증 확인
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Cron job 인증 실패: generate-holidays', {
        ip: request.headers.get('x-forwarded-for'),
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Cron job 시작: generate-holidays')

    const startTime = Date.now()
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    // 모든 활성 테넌트 조회
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true },
    })

    const results = {
      total: tenants.length,
      processed: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{
        tenantId: string
        tenantName: string
        status: 'created' | 'skipped' | 'failed'
        years?: number[]
        count?: number
        error?: string
      }>,
    }

    for (const tenant of tenants) {
      try {
        // 다음 연도 공휴일이 이미 있는지 확인
        const existingNextYear = await prisma.holiday.count({
          where: {
            tenantId: tenant.id,
            date: {
              gte: new Date(`${nextYear}-01-01`),
              lt: new Date(`${nextYear + 1}-01-01`),
            },
          },
        })

        // 현재 연도 공휴일이 있는지도 확인 (기존 테넌트 중 누락된 경우 대비)
        const existingCurrentYear = await prisma.holiday.count({
          where: {
            tenantId: tenant.id,
            date: {
              gte: new Date(`${currentYear}-01-01`),
              lt: new Date(`${currentYear + 1}-01-01`),
            },
          },
        })

        const yearsToGenerate: number[] = []

        // 현재 연도 공휴일이 없으면 생성 대상에 추가
        if (existingCurrentYear === 0) {
          yearsToGenerate.push(currentYear)
        }

        // 다음 연도 공휴일이 없으면 생성 대상에 추가
        if (existingNextYear === 0) {
          yearsToGenerate.push(nextYear)
        }

        if (yearsToGenerate.length === 0) {
          results.skipped++
          results.details.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            status: 'skipped',
          })
          continue
        }

        // 공휴일 생성
        let totalCreated = 0
        for (const year of yearsToGenerate) {
          const holidays = generateHolidays(year)

          if (holidays.length > 0) {
            const created = await prisma.holiday.createMany({
              data: holidays.map((h) => ({
                name: h.name,
                date: new Date(h.date),
                isRecurring: false,
                tenantId: tenant.id,
              })),
              skipDuplicates: true,
            })
            totalCreated += created.count
          }
        }

        results.created++
        results.details.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: 'created',
          years: yearsToGenerate,
          count: totalCreated,
        })

        logger.info('테넌트 공휴일 생성 완료', {
          tenantId: tenant.id,
          years: yearsToGenerate,
          count: totalCreated,
        })
      } catch (error) {
        results.failed++
        results.details.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        })

        logger.error('테넌트 공휴일 생성 실패', {
          tenantId: tenant.id,
          error,
        })
      }

      results.processed++
    }

    const duration = Date.now() - startTime

    logger.info('Cron job 완료: generate-holidays', {
      duration: `${duration}ms`,
      ...results,
    })

    return NextResponse.json({
      success: true,
      message: 'Holiday generation completed',
      data: {
        currentYear,
        nextYear,
        summary: {
          total: results.total,
          created: results.created,
          skipped: results.skipped,
          failed: results.failed,
        },
        details: results.details,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Cron job 실패: generate-holidays', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Holiday generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// POST 메서드로 수동 실행 지원
export async function POST(request: NextRequest) {
  return GET(request)
}
