-- Create Enums
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- Create TenantMember table
CREATE TABLE "tenant_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT,
    "tenantId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- Create TenantInvitation table
CREATE TABLE "tenant_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX "tenant_members_tenantId_userId_key" ON "tenant_members"("tenantId", "userId");
CREATE UNIQUE INDEX "tenant_invitations_token_key" ON "tenant_invitations"("token");

-- Create indexes for performance
CREATE INDEX "tenant_members_userId_idx" ON "tenant_members"("userId");
CREATE INDEX "tenant_members_tenantId_idx" ON "tenant_members"("tenantId");
CREATE INDEX "tenant_members_tenantId_status_idx" ON "tenant_members"("tenantId", "status");
CREATE INDEX "tenant_members_userEmail_idx" ON "tenant_members"("userEmail");

CREATE INDEX "tenant_invitations_token_idx" ON "tenant_invitations"("token");
CREATE INDEX "tenant_invitations_email_idx" ON "tenant_invitations"("email");
CREATE INDEX "tenant_invitations_tenantId_idx" ON "tenant_invitations"("tenantId");
CREATE INDEX "tenant_invitations_tenantId_status_idx" ON "tenant_invitations"("tenantId", "status");
CREATE INDEX "tenant_invitations_expiresAt_idx" ON "tenant_invitations"("expiresAt");

-- Add foreign keys
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing tenants: Create OWNER member for each tenant
INSERT INTO "tenant_members" ("id", "userId", "userEmail", "userName", "tenantId", "role", "status", "acceptedAt", "createdAt", "updatedAt")
SELECT
    'migrated_' || "id" as "id",
    "ownerId" as "userId",
    "ownerEmail" as "userEmail",
    "ownerName" as "userName",
    "id" as "tenantId",
    'OWNER'::"TenantRole" as "role",
    'ACTIVE'::"MemberStatus" as "status",
    "createdAt" as "acceptedAt",
    CURRENT_TIMESTAMP as "createdAt",
    CURRENT_TIMESTAMP as "updatedAt"
FROM "tenants"
WHERE "ownerId" IS NOT NULL AND "ownerId" != '' AND "ownerId" != 'temp';
