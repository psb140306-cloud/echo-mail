-- AlterTable: DeliveryRule 스키마 단순화
-- 복잡한 오전/오후 마감 -> 단일 마감 시간으로 변경

-- 1. 새 컬럼 추가
ALTER TABLE "delivery_rules" ADD COLUMN "cutoffTime" TEXT;
ALTER TABLE "delivery_rules" ADD COLUMN "beforeCutoffDays" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "delivery_rules" ADD COLUMN "afterCutoffDays" INTEGER NOT NULL DEFAULT 2;

-- 2. 기존 데이터 마이그레이션
-- morningCutoff -> cutoffTime
-- morningDeliveryDays -> beforeCutoffDays
-- afternoonDeliveryDays -> afterCutoffDays
UPDATE "delivery_rules"
SET
  "cutoffTime" = "morningCutoff",
  "beforeCutoffDays" = "morningDeliveryDays",
  "afterCutoffDays" = "afternoonDeliveryDays";

-- 3. cutoffTime NOT NULL 제약조건 추가
ALTER TABLE "delivery_rules" ALTER COLUMN "cutoffTime" SET NOT NULL;

-- 4. 기존 컬럼 삭제
ALTER TABLE "delivery_rules" DROP COLUMN "morningCutoff";
ALTER TABLE "delivery_rules" DROP COLUMN "afternoonCutoff";
ALTER TABLE "delivery_rules" DROP COLUMN "morningDeliveryDays";
ALTER TABLE "delivery_rules" DROP COLUMN "afternoonDeliveryDays";
