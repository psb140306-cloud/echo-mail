import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'

// 샘플 배송 규칙 데이터
const sampleDeliveryRules = [
  {
    region: '서울',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 1,
    afternoonDeliveryDays: 2,
    isActive: true,
  },
  {
    region: '경기',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 1,
    afternoonDeliveryDays: 2,
    isActive: true,
  },
  {
    region: '인천',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 1,
    afternoonDeliveryDays: 2,
    isActive: true,
  },
  {
    region: '부산',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 2,
    afternoonDeliveryDays: 3,
    isActive: true,
  },
  {
    region: '대구',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 2,
    afternoonDeliveryDays: 3,
    isActive: true,
  },
  {
    region: '대전',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 2,
    afternoonDeliveryDays: 3,
    isActive: true,
  },
  {
    region: '광주',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 2,
    afternoonDeliveryDays: 3,
    isActive: true,
  },
  {
    region: '울산',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 2,
    afternoonDeliveryDays: 3,
    isActive: true,
  },
  {
    region: '세종',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 2,
    afternoonDeliveryDays: 3,
    isActive: true,
  },
  {
    region: '강원',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 3,
    afternoonDeliveryDays: 4,
    isActive: true,
  },
  {
    region: '충북',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 2,
    afternoonDeliveryDays: 3,
    isActive: true,
  },
  {
    region: '충남',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 2,
    afternoonDeliveryDays: 3,
    isActive: true,
  },
  {
    region: '전북',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 2,
    afternoonDeliveryDays: 3,
    isActive: true,
  },
  {
    region: '전남',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 3,
    afternoonDeliveryDays: 4,
    isActive: true,
  },
  {
    region: '경북',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 2,
    afternoonDeliveryDays: 3,
    isActive: true,
  },
  {
    region: '경남',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 2,
    afternoonDeliveryDays: 3,
    isActive: true,
  },
  {
    region: '제주',
    morningCutoff: '12:00',
    afternoonCutoff: '18:00',
    morningDeliveryDays: 3,
    afternoonDeliveryDays: 4,
    isActive: true,
  },
]

// 샘플 데이터 생성
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        logger.error('Tenant context not available in delivery-rules seed POST')
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // 이미 배송 규칙이 있는지 확인
      const existingRulesCount = await prisma.deliveryRule.count({
        where: { tenantId },
      })

      if (existingRulesCount > 0) {
        return createErrorResponse(
          '이미 배송 규칙이 존재합니다. 샘플 데이터는 빈 상태에서만 생성할 수 있습니다.'
        )
      }

      // 샘플 데이터 생성
      const createdRules = await prisma.deliveryRule.createMany({
        data: sampleDeliveryRules.map((rule) => ({
          ...rule,
          tenantId,
        })),
      })

      logger.info('샘플 배송 규칙 생성 완료', {
        tenantId,
        count: createdRules.count,
      })

      return createSuccessResponse(
        { count: createdRules.count },
        `${createdRules.count}개의 샘플 배송 규칙이 생성되었습니다.`
      )
    } catch (error) {
      logger.error('샘플 배송 규칙 생성 실패:', error)
      return createErrorResponse('샘플 데이터 생성에 실패했습니다.')
    }
  })
}
