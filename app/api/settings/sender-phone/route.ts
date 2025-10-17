import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { TenantContext } from '@/lib/db'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { createNCPCallingNumberServiceFromEnv } from '@/lib/notifications/sms/ncp-calling-number'

/**
 * 발신번호 조회
 */
async function getSenderPhone(request: NextRequest) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: '테넌트 정보를 찾을 수 없습니다.',
        },
        { status: 401 }
      )
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        senderPhone: true,
        senderVerified: true,
        senderVerifiedAt: true,
      },
    })

    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: '테넌트를 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: tenant,
    })
  } catch (error) {
    logger.error('발신번호 조회 실패', error)

    return NextResponse.json(
      {
        success: false,
        error: '발신번호 조회에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

/**
 * 발신번호 등록
 */
async function registerSenderPhone(request: NextRequest) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: '테넌트 정보를 찾을 수 없습니다.',
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { phoneNumber } = body

    if (!phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error: '전화번호를 입력해주세요.',
        },
        { status: 400 }
      )
    }

    // 전화번호 형식 검증
    const normalizedPhone = phoneNumber.replace(/-/g, '')
    if (!/^01[0-9]{8,9}$/.test(normalizedPhone)) {
      return NextResponse.json(
        {
          success: false,
          error: '올바른 휴대폰 번호 형식이 아닙니다. (010-XXXX-XXXX)',
        },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    })

    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: '테넌트를 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    // NCP에 발신번호 등록
    const ncpService = createNCPCallingNumberServiceFromEnv()
    const result = await ncpService.registerCallingNumber({
      number: phoneNumber,
      comment: tenant.name,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || '발신번호 등록에 실패했습니다.',
        },
        { status: 400 }
      )
    }

    // 데이터베이스에 저장
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        senderPhone: phoneNumber,
        senderVerified: false, // NCP 승인 대기 중
        ncpCallingNumberId: result.callingNumberId,
      },
    })

    logger.info('발신번호 등록 완료', {
      tenantId,
      phoneNumber,
      callingNumberId: result.callingNumberId,
    })

    return NextResponse.json({
      success: true,
      message: result.message || '발신번호가 등록되었습니다. 승인 대기 중입니다.',
      data: {
        phoneNumber,
        verified: false,
      },
    })
  } catch (error) {
    logger.error('발신번호 등록 실패', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '발신번호 등록에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

/**
 * 발신번호 인증 상태 확인
 */
async function checkSenderPhoneStatus(request: NextRequest) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: '테넌트 정보를 찾을 수 없습니다.',
        },
        { status: 401 }
      )
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        senderPhone: true,
        senderVerified: true,
        ncpCallingNumberId: true,
      },
    })

    if (!tenant || !tenant.senderPhone) {
      return NextResponse.json(
        {
          success: false,
          error: '등록된 발신번호가 없습니다.',
        },
        { status: 404 }
      )
    }

    // NCP에서 발신번호 상태 확인
    const ncpService = createNCPCallingNumberServiceFromEnv()
    const status = await ncpService.checkCallingNumberStatus(tenant.senderPhone)

    if (status && status.status === 'APPROVED' && !tenant.senderVerified) {
      // 승인되었으면 데이터베이스 업데이트
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          senderVerified: true,
          senderVerifiedAt: new Date(),
        },
      })

      logger.info('발신번호 인증 완료', {
        tenantId,
        phoneNumber: tenant.senderPhone,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        phoneNumber: tenant.senderPhone,
        verified: status?.status === 'APPROVED',
        status: status?.status || 'UNKNOWN',
      },
    })
  } catch (error) {
    logger.error('발신번호 상태 확인 실패', error)

    return NextResponse.json(
      {
        success: false,
        error: '발신번호 상태 확인에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return withTenantContext(request, async (req) => {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    if (action === 'check') {
      return checkSenderPhoneStatus(req)
    }

    return getSenderPhone(req)
  })
}

export async function POST(request: NextRequest) {
  return withTenantContext(request, registerSenderPhone)
}
