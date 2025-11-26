-- notification_logs 테이블에 새 컬럼 추가 (2025-11-26)
-- Upsert 기반 중복 방지 및 에러 분류 시스템
-- 참고: Prisma에서 NotificationLog 모델은 notification_logs 테이블로 매핑됨

-- ============================================================
-- 긴급 수정 (2025-11-26 15:10)
-- 문제: emailLogId는 foreign key라서 임의 값 불가
-- 해결: emailLogId가 있는 레코드만 대상으로 CONSTRAINT 생성
--       emailLogId NULL인 수동 발송은 중복 체크 대상 아님
-- ============================================================

-- 0. 기존 인덱스 및 제약조건 삭제
DROP INDEX IF EXISTS "notification_unique_per_contact";
ALTER TABLE "notification_logs" DROP CONSTRAINT IF EXISTS "notification_unique_per_contact";

-- 1. 새 컬럼 추가 (이미 추가되어 있으면 무시됨)
ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "errorCode" TEXT;
ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT;
ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "contactId" TEXT;

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS "NotificationLog_contactId_idx" ON "notification_logs"("contactId");
CREATE INDEX IF NOT EXISTS "NotificationLog_providerMessageId_idx" ON "notification_logs"("providerMessageId");

-- 3. emailLogId가 있는 레코드 중 contactId가 NULL인 것에 기본값 설정
UPDATE "notification_logs"
SET "contactId" = 'legacy_' || id
WHERE "contactId" IS NULL AND "emailLogId" IS NOT NULL;

-- 4. 중복 데이터 삭제 (emailLogId가 있는 것만 대상, 가장 최근 것만 유지)
DELETE FROM "notification_logs" a
USING "notification_logs" b
WHERE a."emailLogId" IS NOT NULL
  AND b."emailLogId" IS NOT NULL
  AND a."tenantId" = b."tenantId"
  AND a."emailLogId" = b."emailLogId"
  AND a."contactId" = b."contactId"
  AND a."type"::text = b."type"::text
  AND a."createdAt" < b."createdAt";

-- 5. UNIQUE CONSTRAINT 추가 (INDEX가 아닌 CONSTRAINT)
-- PostgreSQL에서 NULL을 포함한 컬럼의 UNIQUE CONSTRAINT는
-- NULL 값을 서로 다른 것으로 취급함 (NULL != NULL)
-- 따라서 emailLogId가 NULL인 수동 발송은 중복 체크에서 제외됨
ALTER TABLE "notification_logs"
ADD CONSTRAINT "notification_unique_per_contact"
UNIQUE ("tenantId", "emailLogId", "contactId", "type");
