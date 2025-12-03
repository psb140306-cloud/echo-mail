import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth/super-admin'

export const dynamic = 'force-dynamic'

/**
 * 프로덕션 DB에 저장된 SMS 설정 확인용 API
 * GET /api/admin/debug/db-settings
 */
export async function GET(request: NextRequest) {
  try {
    // 슈퍼어드민 권한 확인
    const authError = await requireSuperAdmin()
    if (authError) return authError

    // 모든 테넌트 조회
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        ownerEmail: true,
      }
    })

    const results = []

    for (const tenant of tenants) {
      // 각 테넌트의 SMS 설정 조회
      const smsConfigs = await prisma.systemConfig.findMany({
        where: {
          tenantId: tenant.id,
          key: {
            startsWith: 'sms.'
          }
        },
        orderBy: {
          key: 'asc'
        }
      })

      const settings: Record<string, any> = {}

      smsConfigs.forEach(config => {
        const key = config.key.split('.')[1]
        try {
          settings[key] = JSON.parse(config.value)
        } catch {
          settings[key] = config.value
        }
      })

      results.push({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          ownerEmail: tenant.ownerEmail,
        },
        smsSettings: settings,
        hasSettings: smsConfigs.length > 0,
        settingsCount: smsConfigs.length,
      })
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: process.env.DATABASE_URL ? 'connected' : 'missing',
      tenants: results,
      envVariables: {
        SMS_PROVIDER: process.env.SMS_PROVIDER,
        SOLAPI_API_KEY: process.env.SOLAPI_API_KEY ? process.env.SOLAPI_API_KEY.substring(0, 8) + '...' : 'not set',
        SOLAPI_API_SECRET: process.env.SOLAPI_API_SECRET ? 'exists' : 'not set',
        SOLAPI_SENDER_PHONE: process.env.SOLAPI_SENDER_PHONE || 'not set',
        ENABLE_REAL_NOTIFICATIONS: process.env.ENABLE_REAL_NOTIFICATIONS || 'not set',
      }
    })
  } catch (error) {
    console.error('[Admin Debug DB Settings] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
