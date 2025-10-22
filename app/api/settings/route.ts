import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { getTenantIdFromAuthUser } from '@/lib/auth/get-tenant-from-user'

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
  try {
    const tenantId = await getTenantIdFromAuthUser()

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
}

// 설정 업데이트
export async function PUT(request: NextRequest) {
  try {
    const tenantId = await getTenantIdFromAuthUser()

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
    await prisma.$transaction(
      updates.map((update) =>
        prisma.systemConfig.upsert({
          where: {
            tenantId_key: {
              tenantId,
              key: update.key,
            },
          },
          create: {
            tenantId,
            key: update.key,
            value: update.value,
            category: update.category,
          },
          update: {
            value: update.value,
          },
        })
      )
    )

    logger.info('설정 업데이트 완료', { tenantId, updateCount: updates.length })

    return createSuccessResponse(data, '설정이 저장되었습니다.')
  } catch (error) {
    logger.error('설정 업데이트 실패:', error)
    return createErrorResponse('설정 저장에 실패했습니다.')
  }
}
