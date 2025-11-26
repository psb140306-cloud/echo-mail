-- notification_logs 테이블에 새 컬럼 추가 (2025-11-26)
-- Upsert 기반 중복 방지 및 에러 분류 시스템
-- 참고: Prisma에서 NotificationLog 모델은 notification_logs 테이블로 매핑됨

-- ============================================================
-- 긴급 수정 (2025-11-26 13:20)
-- 문제: 부분 인덱스(WHERE contactId IS NOT NULL)를 사용했으나
--       Prisma upsert는 완전한 unique constraint를 필요로 함
-- 해결: 부분 인덱스 삭제 후 완전한 unique constraint 추가
-- ============================================================

-- 0. 기존 부분 인덱스 삭제 (있으면)
DROP INDEX IF EXISTS "notification_unique_per_contact";

-- 1. 새 컬럼 추가 (이미 추가되어 있으면 무시됨)
ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "errorCode" TEXT;
ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT;
ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "contactId" TEXT;

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS "NotificationLog_contactId_idx" ON "notification_logs"("contactId");
CREATE INDEX IF NOT EXISTS "NotificationLog_providerMessageId_idx" ON "notification_logs"("providerMessageId");

-- 3. contactId가 NULL인 레코드에 기본값 설정 (중복 방지를 위해)
-- 기존 레코드 중 contactId가 NULL인 것들을 고유하게 만듦
UPDATE "notification_logs"
SET "contactId" = 'legacy_' || id
WHERE "contactId" IS NULL;

-- 4. 완전한 unique constraint 추가 (부분 인덱스가 아닌)
-- 먼저 중복 데이터 확인:
-- SELECT "tenantId", "emailLogId", "contactId", "type", COUNT(*)
-- FROM "notification_logs"
-- GROUP BY "tenantId", "emailLogId", "contactId", "type"
-- HAVING COUNT(*) > 1;

-- 중복 데이터가 있으면 오래된 것 삭제 (가장 최근 것만 유지)
DELETE FROM "notification_logs" a
USING "notification_logs" b
WHERE a."tenantId" = b."tenantId"
  AND a."emailLogId" = b."emailLogId"
  AND a."contactId" = b."contactId"
  AND a."type" = b."type"
  AND a."createdAt" < b."createdAt";

-- 완전한 유니크 인덱스 생성 (WHERE 절 없음)
CREATE UNIQUE INDEX IF NOT EXISTS "notification_unique_per_contact"
ON "notification_logs"("tenantId", "emailLogId", "contactId", "type");
