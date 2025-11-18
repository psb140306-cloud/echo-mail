-- 기존 컬럼 삭제 (만약 있다면)
ALTER TABLE "delivery_rules" DROP COLUMN IF EXISTS "morningDeliveryTime";
ALTER TABLE "delivery_rules" DROP COLUMN IF EXISTS "afternoonDeliveryTime";

-- 새 컬럼 추가
ALTER TABLE "delivery_rules"
ADD COLUMN "beforeCutoffDeliveryTime" TEXT NOT NULL DEFAULT '오전',
ADD COLUMN "afterCutoffDeliveryTime" TEXT NOT NULL DEFAULT '오후';
