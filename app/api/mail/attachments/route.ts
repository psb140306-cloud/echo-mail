/**
 * 메일 첨부파일 업로드 API
 * POST /api/mail/attachments - 파일 업로드
 * DELETE /api/mail/attachments?key=... - 파일 삭제
 */

import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionPlan } from '@/lib/subscription/plans'
import { ATTACHMENT_LIMITS } from '@/lib/subscription/attachment-limits'

// 허용 확장자
const ALLOWED_EXTENSIONS = [
  // 문서
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv',
  // 이미지
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg',
  // 압축
  'zip', 'rar', '7z', 'tar', 'gz',
  // 기타
  'hwp', 'hwpx',
]

// 허용 MIME 타입
const ALLOWED_MIME_TYPES = [
  // 문서
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
  // 이미지
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/svg+xml',
  // 압축
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  // 한글
  'application/x-hwp',
  'application/haansofthwp',
  'application/vnd.hancom.hwp',
]

export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // 사용자 인증 확인
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return createErrorResponse('인증이 필요합니다.', 401)
      }

      // 테넌트 플랜 확인
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { subscriptionPlan: true },
      })

      if (!tenant) {
        return createErrorResponse('테넌트를 찾을 수 없습니다.', 404)
      }

      const plan = tenant.subscriptionPlan as SubscriptionPlan
      const limits = ATTACHMENT_LIMITS[plan]

      // FormData 파싱
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const currentCountStr = formData.get('currentCount') as string | null
      const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0

      if (!file) {
        return createErrorResponse('파일이 필요합니다.', 400)
      }

      // 첨부파일 개수 체크
      if (currentCount >= limits.maxCount) {
        return createErrorResponse(
          `첨부파일 개수 제한을 초과했습니다. 최대 ${limits.maxCount}개까지 첨부 가능합니다.`,
          400
        )
      }

      // 파일 크기 체크
      if (file.size > limits.maxSize) {
        const maxSizeMB = limits.maxSize / (1024 * 1024)
        return createErrorResponse(
          `파일 크기가 너무 큽니다. 최대 ${maxSizeMB}MB까지 업로드 가능합니다.`,
          400
        )
      }

      // 파일 확장자 체크
      const fileName = file.name
      const extension = fileName.split('.').pop()?.toLowerCase()
      if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
        return createErrorResponse(
          `허용되지 않는 파일 형식입니다. 허용 형식: ${ALLOWED_EXTENSIONS.join(', ')}`,
          400
        )
      }

      // MIME 타입 체크
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return createErrorResponse('허용되지 않는 파일 형식입니다.', 400)
      }

      // 파일을 Buffer로 변환
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // 고유 파일명 생성
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 8)
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
      const uniqueFileName = `${timestamp}-${randomString}-${safeFileName}`
      const storagePath = `mail-attachments/${tenantId}/${uniqueFileName}`

      // Supabase Storage에 업로드
      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(storagePath, buffer, {
          contentType: file.type,
          cacheControl: '3600',
        })

      if (error) {
        logger.error('파일 업로드 실패:', error)
        return createErrorResponse('파일 업로드에 실패했습니다.', 500)
      }

      // 다운로드 URL 생성 (1시간 유효)
      const { data: urlData } = await supabase.storage
        .from('attachments')
        .createSignedUrl(storagePath, 3600)

      logger.info('파일 업로드 완료', {
        tenantId,
        userId: user.id,
        fileName: file.name,
        fileSize: file.size,
        storagePath,
      })

      return createSuccessResponse(
        {
          key: storagePath,
          name: fileName,
          size: file.size,
          type: file.type,
          url: urlData?.signedUrl,
          // 플랜 제한 정보 포함 (프론트엔드 동기화용)
          limits: {
            maxSize: limits.maxSize,
            maxCount: limits.maxCount,
          },
        },
        '파일이 업로드되었습니다.'
      )
    } catch (error) {
      logger.error('첨부파일 업로드 API 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      return createErrorResponse(`파일 업로드 실패: ${errorMessage}`)
    }
  })
}

export async function DELETE(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // 사용자 인증 확인
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return createErrorResponse('인증이 필요합니다.', 401)
      }

      const { searchParams } = new URL(request.url)
      const key = searchParams.get('key')

      if (!key) {
        return createErrorResponse('파일 키가 필요합니다.', 400)
      }

      // 자신의 테넌트 파일인지 확인
      if (!key.includes(`/${tenantId}/`)) {
        return createErrorResponse('접근 권한이 없습니다.', 403)
      }

      // Supabase Storage에서 삭제
      const { error } = await supabase.storage.from('attachments').remove([key])

      if (error) {
        logger.error('파일 삭제 실패:', error)
        return createErrorResponse('파일 삭제에 실패했습니다.', 500)
      }

      logger.info('파일 삭제 완료', {
        tenantId,
        userId: user.id,
        key,
      })

      return createSuccessResponse(null, '파일이 삭제되었습니다.')
    } catch (error) {
      logger.error('첨부파일 삭제 API 오류:', error)
      return createErrorResponse('파일 삭제에 실패했습니다.')
    }
  })
}

/**
 * GET /api/mail/attachments/limits - 플랜별 첨부파일 제한 정보 조회
 */
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // 사용자 인증 확인
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return createErrorResponse('인증이 필요합니다.', 401)
      }

      // 테넌트 플랜 확인
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { subscriptionPlan: true },
      })

      if (!tenant) {
        return createErrorResponse('테넌트를 찾을 수 없습니다.', 404)
      }

      const plan = tenant.subscriptionPlan as SubscriptionPlan
      const limits = ATTACHMENT_LIMITS[plan]

      return createSuccessResponse({
        maxSize: limits.maxSize,
        maxCount: limits.maxCount,
        plan,
      })
    } catch (error) {
      logger.error('첨부파일 제한 조회 API 오류:', error)
      return createErrorResponse('제한 정보 조회에 실패했습니다.')
    }
  })
}
