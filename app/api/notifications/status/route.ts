import { NextRequest } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { notificationService } from '@/lib/notifications/notification-service'
import { notificationQueue } from '@/lib/notifications/queue/notification-queue'
import { templateManager } from '@/lib/notifications/templates/template-manager'
import { withTenantContext } from '@/lib/middleware/tenant-context'

export const dynamic = 'force-dynamic'

// 알림 시스템 상태 조회 (내부 핸들러)
async function getNotificationStatus(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'queue':
        return handleQueueStatus()
      case 'templates':
        return handleTemplateList()
      case 'providers':
        return handleProviderStatus()
      default:
        return handleSystemStatus()
    }
  } catch (error) {
    logger.error('알림 상태 조회 API 오류:', error)
    return createErrorResponse('상태 조회에 실패했습니다.')
  }
}

// 전체 시스템 상태 조회
async function handleSystemStatus() {
  try {
    const status = await notificationService.getStatus()
    const queueStats = await notificationQueue.getStats()

    const systemStatus = {
      ...status,
      queue: {
        ...status.queue,
        stats: queueStats,
      },
      timestamp: new Date().toISOString(),
    }

    logger.info('시스템 상태 조회 완료')

    return createSuccessResponse(systemStatus)
  } catch (error) {
    logger.error('시스템 상태 조회 실패:', error)
    return createErrorResponse('시스템 상태 조회에 실패했습니다.')
  }
}

// 큐 상태 조회
async function handleQueueStatus() {
  try {
    const stats = await notificationQueue.getStats()

    const queueStatus = {
      processing: notificationQueue.processing,
      stats,
      timestamp: new Date().toISOString(),
    }

    return createSuccessResponse(queueStatus)
  } catch (error) {
    logger.error('큐 상태 조회 실패:', error)
    return createErrorResponse('큐 상태 조회에 실패했습니다.')
  }
}

// 템플릿 목록 조회
async function handleTemplateList() {
  try {
    const templates = await templateManager.getAllTemplates()

    const templateList = {
      templates,
      count: templates.length,
      byType: templates.reduce(
        (acc, template) => {
          acc[template.type] = (acc[template.type] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      ),
      timestamp: new Date().toISOString(),
    }

    return createSuccessResponse(templateList)
  } catch (error) {
    logger.error('템플릿 목록 조회 실패:', error)
    return createErrorResponse('템플릿 목록 조회에 실패했습니다.')
  }
}

// 제공자 상태 조회
async function handleProviderStatus() {
  try {
    const status = await notificationService.getStatus()

    const providerStatus = {
      sms: status.sms,
      kakao: status.kakao,
      timestamp: new Date().toISOString(),
    }

    return createSuccessResponse(providerStatus)
  } catch (error) {
    logger.error('제공자 상태 조회 실패:', error)
    return createErrorResponse('제공자 상태 조회에 실패했습니다.')
  }
}

// 큐 제어 (내부 핸들러)
async function controlNotificationQueue(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'start-queue':
        return handleStartQueue()
      case 'stop-queue':
        return handleStopQueue()
      case 'clear-cache':
        return handleClearCache()
      default:
        return createErrorResponse('지원하지 않는 액션입니다.', 400)
    }
  } catch (error) {
    logger.error('알림 제어 API 오류:', error)
    return createErrorResponse('제어 작업에 실패했습니다.')
  }
}

// 큐 시작
async function handleStartQueue() {
  try {
    await notificationService.startQueueProcessing()

    logger.info('큐 처리 시작 API 호출')

    return createSuccessResponse(
      { processing: true, message: '큐 처리가 시작되었습니다.' },
      '큐 처리가 성공적으로 시작되었습니다.'
    )
  } catch (error) {
    logger.error('큐 시작 실패:', error)
    return createErrorResponse('큐 시작에 실패했습니다.')
  }
}

// 큐 중지
async function handleStopQueue() {
  try {
    notificationService.stopQueueProcessing()

    logger.info('큐 처리 중지 API 호출')

    return createSuccessResponse(
      { processing: false, message: '큐 처리가 중지되었습니다.' },
      '큐 처리가 성공적으로 중지되었습니다.'
    )
  } catch (error) {
    logger.error('큐 중지 실패:', error)
    return createErrorResponse('큐 중지에 실패했습니다.')
  }
}

// 캐시 초기화
async function handleClearCache() {
  try {
    templateManager.clearCache()

    logger.info('캐시 초기화 API 호출')

    return createSuccessResponse(
      { message: '캐시가 초기화되었습니다.' },
      '캐시가 성공적으로 초기화되었습니다.'
    )
  } catch (error) {
    logger.error('캐시 초기화 실패:', error)
    return createErrorResponse('캐시 초기화에 실패했습니다.')
  }
}

// withTenantContext 미들웨어 적용된 export 함수들
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => getNotificationStatus(request))
}

export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => controlNotificationQueue(request))
}
