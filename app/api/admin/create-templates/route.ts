import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { templateManager } from '@/lib/notifications/templates/template-manager'

export const dynamic = 'force-dynamic'

/**
 * 모든 테넌트에 기본 템플릿 생성 (관리자 전용)
 */
export async function POST(request: NextRequest) {
  try {
    // 간단한 인증 (실제로는 더 강력한 인증 필요)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('모든 테넌트에 기본 템플릿 생성 시작')

    // 모든 테넌트 조회
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        ownerEmail: true,
      },
    })

    logger.info(`총 ${tenants.length}개 테넌트 발견`)

    const results = []

    for (const tenant of tenants) {
      try {
        // 이미 템플릿이 있는지 확인
        const existingTemplates = await prisma.messageTemplate.count({
          where: { tenantId: tenant.id },
        })

        if (existingTemplates > 0) {
          logger.info(`테넌트 ${tenant.name} - 이미 ${existingTemplates}개 템플릿 존재`)
          results.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            status: 'skipped',
            message: `Already has ${existingTemplates} templates`,
          })
          continue
        }

        // 기본 템플릿 생성
        await templateManager.createDefaultTemplatesForTenant(tenant.id)
        logger.info(`테넌트 ${tenant.name} - 기본 템플릿 생성 완료`)

        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: 'created',
          message: 'Default templates created successfully',
        })
      } catch (error) {
        logger.error(`테넌트 ${tenant.name} - 템플릿 생성 실패:`, error)
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const summary = {
      total: tenants.length,
      created: results.filter((r) => r.status === 'created').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
    }

    logger.info('템플릿 생성 완료', summary)

    return NextResponse.json({
      success: true,
      summary,
      results,
    })
  } catch (error) {
    logger.error('템플릿 생성 API 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
