-- Drop old User-related tables
DROP TABLE IF EXISTS "accounts" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
DROP TABLE IF EXISTS "verification_tokens" CASCADE;
DROP TABLE IF EXISTS "tenant_users" CASCADE;
DROP TABLE IF EXISTS "tenant_invitations" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Update Tenant table
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "ownerId";
ALTER TABLE "tenants" ADD COLUMN "ownerId" TEXT NOT NULL DEFAULT 'temp';
ALTER TABLE "tenants" ADD COLUMN "ownerEmail" TEXT NOT NULL DEFAULT 'temp@example.com';
ALTER TABLE "tenants" ADD COLUMN "ownerName" TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS "tenants_ownerId_idx" ON "tenants"("ownerId");
CREATE INDEX IF NOT EXISTS "tenants_ownerEmail_idx" ON "tenants"("ownerEmail");
