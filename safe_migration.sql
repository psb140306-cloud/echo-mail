-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "EmailStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'MATCHED', 'FAILED', 'IGNORED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM ('SMS', 'KAKAO_ALIMTALK', 'KAKAO_FRIENDTALK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE_TRIAL', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'UNPAID', 'INCOMPLETE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "position" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "kakaoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "delivery_rules" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "cutoffTime" TEXT NOT NULL,
    "beforeCutoffDays" INTEGER NOT NULL DEFAULT 1,
    "afterCutoffDays" INTEGER NOT NULL DEFAULT 2,
    "beforeCutoffDeliveryTime" TEXT NOT NULL DEFAULT '오전',
    "afterCutoffDeliveryTime" TEXT NOT NULL DEFAULT '오후',
    "cutoffCount" INTEGER NOT NULL DEFAULT 1,
    "secondCutoffTime" TEXT,
    "afterSecondCutoffDays" INTEGER,
    "afterSecondCutoffDeliveryTime" TEXT,
    "workingDays" TEXT[] DEFAULT ARRAY['1', '2', '3', '4', '5']::TEXT[],
    "customClosedDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeHolidays" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT,
    "smtpPort" INTEGER DEFAULT 587,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "pollInterval" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMsg" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_logs" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "hasAttachment" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "status" "EmailStatus" NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_logs" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "emailLogId" TEXT,
    "errorMessage" TEXT,
    "cost" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "message_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_members" (
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_invitations" (
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "customerKey" TEXT,
    "billingKey" TEXT,
    "priceAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "currentEmailCount" INTEGER NOT NULL DEFAULT 0,
    "currentNotificationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" INTEGER NOT NULL,
    "tax" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentKey" TEXT,
    "orderId" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "companies_tenantId_idx" ON "companies"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "companies_tenantId_isActive_idx" ON "companies"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "companies_tenantId_region_idx" ON "companies"("tenantId", "region");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "companies_createdAt_idx" ON "companies"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "companies_tenantId_name_key" ON "companies"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "companies_tenantId_email_key" ON "companies"("tenantId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_tenantId_idx" ON "contacts"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_tenantId_isActive_idx" ON "contacts"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_tenantId_companyId_idx" ON "contacts"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_phone_idx" ON "contacts"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_companyId_idx" ON "contacts"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_rules_tenantId_idx" ON "delivery_rules"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_rules_tenantId_isActive_idx" ON "delivery_rules"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_rules_region_idx" ON "delivery_rules"("region");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_rules_tenantId_region_key" ON "delivery_rules"("tenantId", "region");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "holidays_tenantId_idx" ON "holidays"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "holidays_date_idx" ON "holidays"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "holidays_tenantId_isRecurring_idx" ON "holidays"("tenantId", "isRecurring");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "holidays_tenantId_date_key" ON "holidays"("tenantId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_accounts_tenantId_idx" ON "email_accounts"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_accounts_tenantId_isActive_idx" ON "email_accounts"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_accounts_lastSyncAt_idx" ON "email_accounts"("lastSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "email_accounts_tenantId_email_key" ON "email_accounts"("tenantId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_logs_tenantId_idx" ON "email_logs"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_logs_tenantId_status_idx" ON "email_logs"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_logs_tenantId_companyId_idx" ON "email_logs"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_logs_receivedAt_idx" ON "email_logs"("receivedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_logs_sender_idx" ON "email_logs"("sender");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_logs_recipient_idx" ON "email_logs"("recipient");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_logs_createdAt_idx" ON "email_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "email_logs_tenantId_messageId_key" ON "email_logs"("tenantId", "messageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_logs_tenantId_idx" ON "notification_logs"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_logs_tenantId_status_idx" ON "notification_logs"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_logs_tenantId_type_idx" ON "notification_logs"("tenantId", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_logs_status_nextRetryAt_idx" ON "notification_logs"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_logs_recipient_idx" ON "notification_logs"("recipient");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_logs_emailLogId_idx" ON "notification_logs"("emailLogId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_logs_companyId_idx" ON "notification_logs"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_logs_createdAt_idx" ON "notification_logs"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_logs_sentAt_idx" ON "notification_logs"("sentAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_configs_tenantId_idx" ON "system_configs"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_configs_tenantId_category_idx" ON "system_configs"("tenantId", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_configs_key_idx" ON "system_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "system_configs_tenantId_key_key" ON "system_configs"("tenantId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_templates_tenantId_idx" ON "message_templates"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_templates_tenantId_type_idx" ON "message_templates"("tenantId", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_templates_tenantId_isActive_idx" ON "message_templates"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_templates_tenantId_isDefault_idx" ON "message_templates"("tenantId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_tenantId_name_key" ON "message_templates"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenants_ownerId_idx" ON "tenants"("ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenants_ownerEmail_idx" ON "tenants"("ownerEmail");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenants_subdomain_idx" ON "tenants"("subdomain");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenants_customDomain_idx" ON "tenants"("customDomain");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenants_subscriptionPlan_idx" ON "tenants"("subscriptionPlan");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenants_subscriptionStatus_idx" ON "tenants"("subscriptionStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenants_trialEndsAt_idx" ON "tenants"("trialEndsAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenants_createdAt_idx" ON "tenants"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_members_userId_idx" ON "tenant_members"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_members_tenantId_idx" ON "tenant_members"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_members_tenantId_status_idx" ON "tenant_members"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_members_userEmail_idx" ON "tenant_members"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_members_tenantId_userId_key" ON "tenant_members"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invitations_token_key" ON "tenant_invitations"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_invitations_token_idx" ON "tenant_invitations"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_invitations_email_idx" ON "tenant_invitations"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_invitations_tenantId_idx" ON "tenant_invitations"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_invitations_tenantId_status_idx" ON "tenant_invitations"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_invitations_expiresAt_idx" ON "tenant_invitations"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscriptions_tenantId_idx" ON "subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscriptions_plan_idx" ON "subscriptions"("plan");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscriptions_currentPeriodEnd_idx" ON "subscriptions"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscriptions_customerKey_idx" ON "subscriptions"("customerKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscriptions_billingKey_idx" ON "subscriptions"("billingKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_tenantId_idx" ON "invoices"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_invoiceNumber_idx" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_periodStart_idx" ON "invoices"("periodStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_periodEnd_idx" ON "invoices"("periodEnd");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_paidAt_idx" ON "invoices"("paidAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_paymentKey_idx" ON "invoices"("paymentKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_orderId_idx" ON "invoices"("orderId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_tenantId_fkey') THEN
        ALTER TABLE "companies" ADD CONSTRAINT "companies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_tenantId_fkey') THEN
        ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_companyId_fkey') THEN
        ALTER TABLE "contacts" ADD CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_rules_tenantId_fkey') THEN
        ALTER TABLE "delivery_rules" ADD CONSTRAINT "delivery_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'holidays_tenantId_fkey') THEN
        ALTER TABLE "holidays" ADD CONSTRAINT "holidays_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_accounts_tenantId_fkey') THEN
        ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_tenantId_fkey') THEN
        ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_companyId_fkey') THEN
        ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_logs_tenantId_fkey') THEN
        ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_logs_companyId_fkey') THEN
        ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_logs_emailLogId_fkey') THEN
        ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_emailLogId_fkey" FOREIGN KEY ("emailLogId") REFERENCES "email_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_configs_tenantId_fkey') THEN
        ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_templates_tenantId_fkey') THEN
        ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_members_tenantId_fkey') THEN
        ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_invitations_tenantId_fkey') THEN
        ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tenantId_fkey') THEN
        ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_tenantId_fkey') THEN
        ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_subscriptionId_fkey') THEN
        ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END
$$;

