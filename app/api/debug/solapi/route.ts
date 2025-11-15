import { NextRequest, NextResponse } from 'next/server'
import { createSolapiProviderFromEnv, createSolapiProviderFromDB } from '@/lib/notifications/sms/solapi-provider'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        logger.error('[Debug SOLAPI] Tenant context not available')
        return NextResponse.json({
          success: false,
          error: '테넌트 정보를 찾을 수 없습니다.',
        }, { status: 401 })
      }

      // 1. DB 우선 Provider 생성
      let provider
      let source = 'DB'
      try {
        provider = await createSolapiProviderFromDB(tenantId)
      } catch (dbError) {
        logger.warn('[Debug SOLAPI] DB에서 Provider 생성 실패, 환경변수 사용:', dbError)
        provider = createSolapiProviderFromEnv()
        source = 'ENV'
      }

      // 2. 설정 검증
      const isValid = await provider.validateConfig()

      // 3. 잔액 조회 (SDK는 잔액 조회 API 미제공, 테스트 모드에서는 가짜 값)
      let balance = 0
      try {
        balance = await provider.getBalance()
      } catch (balanceError) {
        logger.warn('[Debug SOLAPI] 잔액 조회 실패:', balanceError)
      }

      // 4. 발신번호 목록 조회
      let senderNumbers: string[] = []
      try {
        senderNumbers = await provider.getSenderNumbers()
      } catch (senderError) {
        logger.warn('[Debug SOLAPI] 발신번호 조회 실패:', senderError)
      }

      return NextResponse.json({
        success: true,
        source, // DB 또는 ENV
        tenantId,
        config: {
          isValid,
          balance,
          senderNumbers,
        },
        env: {
          NODE_ENV: process.env.NODE_ENV,
          ENABLE_REAL_NOTIFICATIONS: process.env.ENABLE_REAL_NOTIFICATIONS,
          SOLAPI_API_KEY: process.env.SOLAPI_API_KEY ? `${process.env.SOLAPI_API_KEY.substring(0, 8)}...` : '없음',
          SOLAPI_API_SECRET: process.env.SOLAPI_API_SECRET ? '설정됨' : '없음',
          SOLAPI_SENDER_PHONE: process.env.SOLAPI_SENDER_PHONE || '없음',
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('[Debug SOLAPI] 오류:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        stack: error instanceof Error ? error.stack : undefined,
      }, { status: 500 })
    }
  })
}
