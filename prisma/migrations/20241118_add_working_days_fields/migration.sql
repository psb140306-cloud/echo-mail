-- Add missing working days fields to delivery_rules table

-- Add workingDays column (array of day numbers)
ALTER TABLE "delivery_rules"
ADD COLUMN IF NOT EXISTS "workingDays" TEXT[] DEFAULT ARRAY['1', '2', '3', '4', '5']::TEXT[];

-- Add customClosedDates column (array of dates in YYYY-MM-DD format)
ALTER TABLE "delivery_rules"
ADD COLUMN IF NOT EXISTS "customClosedDates" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add excludeHolidays column (boolean)
ALTER TABLE "delivery_rules"
ADD COLUMN IF NOT EXISTS "excludeHolidays" BOOLEAN NOT NULL DEFAULT true;

-- Add beforeCutoffDeliveryTime and afterCutoffDeliveryTime if not exists
ALTER TABLE "delivery_rules"
ADD COLUMN IF NOT EXISTS "beforeCutoffDeliveryTime" TEXT NOT NULL DEFAULT '오전';

ALTER TABLE "delivery_rules"
ADD COLUMN IF NOT EXISTS "afterCutoffDeliveryTime" TEXT NOT NULL DEFAULT '오후';
