-- NotificationLog 테이블에 새 컬럼 추가 (2025-11-26)
-- Upsert 기반 중복 방지 및 에러 분류 시스템

-- 1. 새 컬럼 추가
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "errorCode" TEXT;
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT;
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "contactId" TEXT;

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS "NotificationLog_contactId_idx" ON "NotificationLog"("contactId");
CREATE INDEX IF NOT EXISTS "NotificationLog_providerMessageId_idx" ON "NotificationLog"("providerMessageId");

-- 3. 유니크 제약 추가 (tenantId + emailLogId + contactId + type)
-- 기존 데이터가 있으면 먼저 정리 필요
-- 중복 데이터 확인:
-- SELECT "tenantId", "emailLogId", "contactId", "type", COUNT(*)
-- FROM "NotificationLog"
-- WHERE "contactId" IS NOT NULL
-- GROUP BY "tenantId", "emailLogId", "contactId", "type"
-- HAVING COUNT(*) > 1;

-- contactId가 NULL인 기존 레코드에 대해서는 유니크 제약 적용 제외됨 (NULL은 유니크 비교에서 제외)
-- 유니크 인덱스 생성 (부분 인덱스 - contactId가 NOT NULL인 경우에만)
CREATE UNIQUE INDEX IF NOT EXISTS "notification_unique_per_contact"
ON "NotificationLog"("tenantId", "emailLogId", "contactId", "type")
WHERE "contactId" IS NOT NULL;
