import { NextRequest, NextResponse } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { withTenantContext } from '@/lib/middleware/tenant-context'

export const dynamic = 'force-dynamic'

// 기본 지역 목록
const DEFAULT_REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
]

/**
 * 테넌트의 지역 목록 조회 (기본 + 커스텀)
 */
async function getRegions(request: NextRequest) {
  try {
    // CRITICAL: Get tenantId for multi-tenancy isolation
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant context not found' },
        { status: 401 }
      )
    }

    // 해당 테넌트의 모든 업체에서 사용된 지역 조회
    const companies = await prisma.company.findMany({
      where: { tenantId },
      select: { region: true },
      distinct: ['region']
    })

    // 커스텀 지역 추출 (기본 지역에 없는 것들)
    const customRegions = companies
      .map(c => c.region)
      .filter(region => region && !DEFAULT_REGIONS.includes(region))
      .filter((region, index, self) => self.indexOf(region) === index) // 중복 제거
      .sort()

    // 기본 지역 + 커스텀 지역 합치기
    const allRegions = [...DEFAULT_REGIONS, ...customRegions]

    return NextResponse.json({
      success: true,
      data: {
        defaultRegions: DEFAULT_REGIONS,
        customRegions,
        allRegions
      }
    })
  } catch (error) {
    console.error('Failed to fetch regions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch regions' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => getRegions(request))
}
