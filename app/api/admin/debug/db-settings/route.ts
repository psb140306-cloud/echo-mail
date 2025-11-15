import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

/**
 * 프로덕션 DB에 저장된 SMS 설정 확인용 API
 * GET /api/admin/debug/db-settings
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 사용자 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 슈퍼어드민 권한 확인
    const isDefaultAdmin = user.email === 'seah0623@naver.com'
    if (!isDefaultAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

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
