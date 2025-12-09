import { NextRequest, NextResponse } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { logger } from '@/lib/utils/logger'

async function getStats(request: NextRequest) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 401 }
      )
    }

    // 전체 연락처 수
    const totalContacts = await prisma.contact.count({
      where: { tenantId },
    })

    // 이메일이 등록된 연락처 수
    const contactsWithEmail = await prisma.contact.count({
      where: {
        tenantId,
        email: { not: null },
      },
    })

    // 전화번호가 등록된 연락처 수 (010으로 시작하는 유효한 전화번호만)
    const contactsWithPhone = await prisma.contact.count({
      where: {
        tenantId,
        phone: { startsWith: '010' },
      },
    })

    logger.info('주소록 통계 조회', {
      tenantId,
      totalContacts,
      contactsWithEmail,
      contactsWithPhone,
    })

    return NextResponse.json({
      success: true,
      data: {
        totalContacts,
        contactsWithEmail,
        contactsWithPhone,
      },
    })
  } catch (error) {
    logger.error('주소록 통계 조회 실패:', error)

    return NextResponse.json(
      {
        success: false,
        error: '통계 조회에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return withTenantContext(request, getStats)
}
