import { NextRequest, NextResponse } from 'next/server'
import { createSolapiProviderFromEnv } from '@/lib/notifications/sms/solapi-provider'
import { createNCPProviderFromEnv } from '@/lib/notifications/sms/ncp-provider'
import { requireSuperAdmin } from '@/lib/auth/super-admin'

export const dynamic = 'force-dynamic'

// 슈퍼어드민용 SMS 설정 API (환경변수 조회 전용)
export async function GET(request: NextRequest) {
  try {
    // 슈퍼어드민 권한 확인
    const authError = await requireSuperAdmin()
    if (authError) return authError

    // 환경변수에서 SMS 설정 읽기
    const provider = (process.env.SMS_PROVIDER || 'solapi') as 'aligo' | 'ncp' | 'solapi'
    const enabled = process.env.SMS_ENABLED !== 'false' // 기본값 true
    const testMode = process.env.ENABLE_REAL_NOTIFICATIONS !== 'true'

    let apiKey = ''
    let apiSecret = ''
    let senderId = ''

    if (provider === 'solapi') {
      apiKey = process.env.SOLAPI_API_KEY || ''
      apiSecret = process.env.SOLAPI_API_SECRET || ''
      senderId = process.env.SOLAPI_SENDER_PHONE || ''
    } else if (provider === 'ncp') {
      apiKey = process.env.NCP_ACCESS_KEY || ''
      apiSecret = process.env.NCP_SECRET_KEY || ''
      senderId = process.env.NCP_SENDER_PHONE || process.env.NCP_SENDER || ''
    } else if (provider === 'aligo') {
      apiKey = process.env.ALIGO_API_KEY || ''
      apiSecret = process.env.ALIGO_USER_ID || ''
      senderId = process.env.ALIGO_SENDER || ''
    }

    // 연결 상태 및 잔액 확인
    let connectionStatus = {
      connected: false,
      balance: 0,
      senderNumbers: [] as string[],
      error: null as string | null,
    }

    try {
      if (provider === 'solapi') {
        const solapiProvider = createSolapiProviderFromEnv()

        console.log('[Admin SMS] Solapi Provider 생성:', {
          hasApiKey: !!apiKey,
          hasApiSecret: !!apiSecret,
          hasSender: !!senderId,
          testMode,
        })

        // 설정 검증
        const isValid = await solapiProvider.validateConfig()
        connectionStatus.connected = isValid

        console.log('[Admin SMS] 설정 검증 결과:', isValid)

        if (isValid) {
          // 잔액 조회
          try {
            const balance = await solapiProvider.getBalance()
            connectionStatus.balance = balance
            console.log('[Admin SMS] 잔액 조회 성공:', balance)
          } catch (balanceError) {
            console.error('[Admin SMS] 잔액 조회 실패:', balanceError)
          }

          // 발신번호 목록 조회
          try {
            const numbers = await solapiProvider.getSenderNumbers()
            connectionStatus.senderNumbers = numbers
            console.log('[Admin SMS] 발신번호 조회 성공:', numbers)
          } catch (senderError) {
            console.error('[Admin SMS] 발신번호 조회 실패:', senderError)
          }
        }
      } else if (provider === 'ncp') {
        const ncpProvider = createNCPProviderFromEnv()

        console.log('[Admin SMS] NCP Provider 생성:', {
          hasServiceId: !!process.env.NCP_SERVICE_ID,
          hasAccessKey: !!apiKey,
          hasSecretKey: !!apiSecret,
          hasSender: !!senderId,
          testMode,
        })

        // 설정 검증
        const isValid = await ncpProvider.validateConfig()
        connectionStatus.connected = isValid

        console.log('[Admin SMS] 설정 검증 결과:', isValid)

        if (isValid) {
          // NCP는 잔액 조회 API 없음
          connectionStatus.balance = -1

          // 발신번호 목록 조회 (설정된 번호만)
          try {
            const numbers = await ncpProvider.getSenderNumbers()
            connectionStatus.senderNumbers = numbers
            console.log('[Admin SMS] 발신번호 조회 성공:', numbers)
          } catch (senderError) {
            console.error('[Admin SMS] 발신번호 조회 실패:', senderError)
          }
        }
      }
      // TODO: Aligo provider도 필요시 추가
    } catch (error) {
      console.error('[Admin SMS] 연결 상태 확인 오류:', error)
      connectionStatus.error = error instanceof Error ? error.message : '알 수 없는 오류'
    }

    const result = {
      // 설정 정보
      enabled,
      provider,
      apiKey: apiKey ? apiKey.substring(0, 8) + '...' : '', // 보안상 일부만 표시
      apiSecret: apiSecret ? apiSecret.substring(0, 8) + '...' : '',
      senderId,
      testMode,

      // 연결 상태
      connection: connectionStatus,

      // 메타 정보
      source: 'environment', // 환경변수에서 읽음
      readonly: true, // 수정 불가 (환경변수만 사용)
    }

    console.log('[Admin SMS Settings] 환경변수 조회:', {
      provider,
      hasApiKey: !!apiKey,
      hasSenderId: !!senderId,
      connected: connectionStatus.connected,
      balance: connectionStatus.balance,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Admin SMS Settings API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST는 제거 (환경변수는 Railway/Vercel 대시보드에서 수정)
