/**
 * 플랜별 첨부파일 제한 정의
 */

import { SubscriptionPlan } from './plans'

export interface AttachmentLimits {
  maxSize: number    // 단일 파일 최대 크기 (bytes)
  maxCount: number   // 최대 첨부 개수
}

// 플랜별 첨부파일 제한
export const ATTACHMENT_LIMITS: Record<SubscriptionPlan, AttachmentLimits> = {
  FREE_TRIAL: { maxSize: 5 * 1024 * 1024, maxCount: 3 },      // 5MB, 3개
  STARTER: { maxSize: 10 * 1024 * 1024, maxCount: 5 },        // 10MB, 5개
  PROFESSIONAL: { maxSize: 25 * 1024 * 1024, maxCount: 10 },  // 25MB, 10개
  BUSINESS: { maxSize: 50 * 1024 * 1024, maxCount: 20 },      // 50MB, 20개
  ENTERPRISE: { maxSize: 100 * 1024 * 1024, maxCount: 50 },   // 100MB, 50개
}

/**
 * 플랜별 첨부파일 제한 조회
 */
export function getAttachmentLimits(plan: SubscriptionPlan): AttachmentLimits {
  return ATTACHMENT_LIMITS[plan]
}

/**
 * 첨부파일 목록이 플랜 제한을 초과하는지 검사
 */
export function validateAttachments(
  attachments: Array<{ size: number }>,
  plan: SubscriptionPlan
): { valid: boolean; error?: string } {
  const limits = ATTACHMENT_LIMITS[plan]

  // 개수 체크
  if (attachments.length > limits.maxCount) {
    return {
      valid: false,
      error: `첨부파일 개수 제한을 초과했습니다. 최대 ${limits.maxCount}개까지 첨부 가능합니다.`
    }
  }

  // 개별 파일 크기 체크
  const maxSizeMB = limits.maxSize / (1024 * 1024)
  for (const attachment of attachments) {
    if (attachment.size > limits.maxSize) {
      return {
        valid: false,
        error: `파일 크기가 너무 큽니다. 최대 ${maxSizeMB}MB까지 업로드 가능합니다.`
      }
    }
  }

  return { valid: true }
}
