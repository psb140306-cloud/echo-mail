-- Add multi-cutoff columns to delivery_rules table
ALTER TABLE "delivery_rules"
ADD COLUMN IF NOT EXISTS "cutoffCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "delivery_rules"
ADD COLUMN IF NOT EXISTS "secondCutoffTime" TEXT;

ALTER TABLE "delivery_rules"
ADD COLUMN IF NOT EXISTS "afterSecondCutoffDays" INTEGER;

ALTER TABLE "delivery_rules"
ADD COLUMN IF NOT EXISTS "afterSecondCutoffDeliveryTime" TEXT;
