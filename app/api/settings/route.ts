import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { mailScheduler } from '@/lib/scheduler/mail-scheduler'

// 설정 스키마
const settingsSchema = z.object({
  mailServer: z
    .object({
      host: z.string(),
      port: z.number(),
      username: z.string(),
      password: z.string(),
      useSSL: z.boolean(),
      checkInterval: z.number(),
      enabled: z.boolean(),
    })
    .optional(),
  sms: z
    .object({
      provider: z.string(),
      apiKey: z.string(),
      apiSecret: z.string(),
      senderId: z.string(),
      enabled: z.boolean(),
      testMode: z.boolean(),
    })
    .optional(),
  kakao: z
    .object({
      apiKey: z.string(),
      plusFriendId: z.string(),
      enabled: z.boolean(),
      testMode: z.boolean(),
      fallbackToSMS: z.boolean(),
    })
    .optional(),
  system: z
    .object({
      timezone: z.string(),
      queueSize: z.number(),
      retryAttempts: z.number(),
      logLevel: z.string(),
      enableNotifications: z.boolean(),
    })
    .optional(),
  templates: z
    .object({
      smsTemplate: z.string(),
      kakaoTemplate: z.string(),
    })
    .optional(),
})

// 기본 설정값
const defaultSettings = {
  mailServer: {
    host: '',
    port: 993,
    username: '',
    password: '',
    useSSL: true,
    checkInterval: 5,
    enabled: false,
  },
  sms: {
    provider: 'aligo',
    apiKey: '',
    apiSecret: '',
    senderId: '',
    enabled: false,
    testMode: true,
  },
  kakao: {
    apiKey: '',
    plusFriendId: '',
    enabled: false,
    testMode: true,
    fallbackToSMS: true,
  },
  system: {
    timezone: 'Asia/Seoul',
    queueSize: 1000,
    retryAttempts: 3,
    logLevel: 'info',
    enableNotifications: true,
  },
  templates: {
    smsTemplate: '[{companyName}] 발주 확인: {orderDate}까지 납품 예정입니다.',
    kakaoTemplate:
      '안녕하세요, {companyName}입니다.\n\n발주가 확인되었습니다.\n납품 예정일: {orderDate}\n\n문의사항이 있으시면 연락 주세요.',
  },
}

// 설정 조회
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        logger.error('Tenant context not available in settings GET')
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // SystemConfig에서 설정 가져오기
      const configs = await prisma.systemConfig.findMany({
        where: { tenantId },
      })

      // 설정을 구조화된 형태로 변환
      const settings = { ...defaultSettings }

      configs.forEach((config) => {
        const [category, key] = config.key.split('.')
        if (category && key && settings[category as keyof typeof settings]) {
          const categorySettings = settings[category as keyof typeof settings] as any
          try {
            // JSON 파싱 시도 (boolean, number 등)
            categorySettings[key] = JSON.parse(config.value)
          } catch {
            // 파싱 실패시 문자열 그대로 사용
            categorySettings[key] = config.value
          }
        }
      })

      logger.info('설정 조회 완료', { tenantId, configCount: configs.length })

      return createSuccessResponse(settings)
    } catch (error) {
      logger.error('설정 조회 실패:', error)
      return createErrorResponse('설정을 불러오는데 실패했습니다.')
    }
  })
}

// 설정 업데이트
export async function PUT(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        logger.error('Tenant context not available in settings PUT')
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const { data, error } = await parseAndValidate(request, settingsSchema)
      if (error) return error

      // 각 설정 카테고리를 SystemConfig에 저장
      const updates: Array<{ key: string; value: string; category: string }> = []

      Object.entries(data).forEach(([category, categoryData]) => {
        if (categoryData && typeof categoryData === 'object') {
          Object.entries(categoryData).forEach(([key, value]) => {
            updates.push({
              key: `${category}.${key}`,
              value: JSON.stringify(value),
              category,
            })
          })
        }
      })

      // 트랜잭션으로 모든 설정 업데이트
      for (const update of updates) {
        // 기존 설정 찾기
        const existing = await prisma.systemConfig.findFirst({
          where: {
            tenantId,
            key: update.key,
          },
        })

        if (existing) {
          // 업데이트
          await prisma.systemConfig.update({
            where: { id: existing.id },
            data: { value: update.value },
          })
        } else {
          // 생성
          await prisma.systemConfig.create({
            data: {
              tenantId,
              key: update.key,
              value: update.value,
              category: update.category,
            },
          })
        }
      }

      logger.info('설정 업데이트 완료', { tenantId, updateCount: updates.length })

      // 메일 서버 설정이 변경된 경우 Railway Worker에 스케줄러 재로드 요청
      if (data.mailServer) {
        try {
          logger.info('메일 서버 설정 변경 감지, Railway Worker에 재로드 요청')

          const railwayWorkerUrl = process.env.RAILWAY_WORKER_URL || 'https://echo-mail-production.up.railway.app'
          const railwaySecret = process.env.RAILWAY_WORKER_SECRET

          if (!railwaySecret) {
            logger.warn('RAILWAY_WORKER_SECRET이 설정되지 않았습니다. 스케줄러 재로드를 건너뜁니다.')
          } else {
            const response = await fetch(`${railwayWorkerUrl}/reload-scheduler`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${railwaySecret}`,
                'Content-Type': 'application/json'
              }
            })

            if (response.ok) {
              const result = await response.json()
              logger.info('Railway Worker 스케줄러 재로드 완료:', result)
            } else {
              const errorText = await response.text()
              logger.error('Railway Worker 스케줄러 재로드 실패:', {
                status: response.status,
                error: errorText
              })
            }
          }
        } catch (schedulerError) {
          logger.error('Railway Worker 스케줄러 재로드 요청 실패:', schedulerError)
          // 스케줄러 재로드 실패해도 설정 저장은 성공으로 처리
        }
      }

      return createSuccessResponse(data, '설정이 저장되었습니다.')
    } catch (error) {
      logger.error('설정 업데이트 실패:', error)
      return createErrorResponse('설정 저장에 실패했습니다.')
    }
  })
}
