-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE_TRIAL', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'UNPAID', 'INCOMPLETE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "customDomain" TEXT,
    "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE_TRIAL',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3) NOT NULL,
    "maxCompanies" INTEGER NOT NULL DEFAULT 10,
    "maxContacts" INTEGER NOT NULL DEFAULT 50,
    "maxEmails" INTEGER NOT NULL DEFAULT 500,
    "maxNotifications" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
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

-- AlterTable
ALTER TABLE "companies" DROP CONSTRAINT "companies_name_key";
ALTER TABLE "companies" DROP CONSTRAINT "companies_email_key";
ALTER TABLE "companies" ADD COLUMN "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "delivery_rules" DROP CONSTRAINT "delivery_rules_region_key";
ALTER TABLE "delivery_rules" ADD COLUMN "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "email_logs" DROP CONSTRAINT "email_logs_messageId_key";
ALTER TABLE "email_logs" ADD COLUMN "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "holidays" DROP CONSTRAINT "holidays_date_key";
ALTER TABLE "holidays" ADD COLUMN "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_name_key";
ALTER TABLE "message_templates" ADD COLUMN "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "notification_logs" ADD COLUMN "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "system_configs" DROP CONSTRAINT "system_configs_key_key";
ALTER TABLE "system_configs" ADD COLUMN "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "tenantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenantId_name_key" ON "companies"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenantId_email_key" ON "companies"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_rules_tenantId_region_key" ON "delivery_rules"("tenantId", "region");

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_tenantId_messageId_key" ON "email_logs"("tenantId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_tenantId_date_key" ON "holidays"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_tenantId_name_key" ON "message_templates"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_tenantId_key_key" ON "system_configs"("tenantId", "key");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_rules" ADD CONSTRAINT "delivery_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security on all tenant-specific tables
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holidays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
-- Companies
CREATE POLICY "companies_tenant_isolation" ON "companies"
    FOR ALL USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Contacts
CREATE POLICY "contacts_tenant_isolation" ON "contacts"
    FOR ALL USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Delivery Rules
CREATE POLICY "delivery_rules_tenant_isolation" ON "delivery_rules"
    FOR ALL USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Holidays
CREATE POLICY "holidays_tenant_isolation" ON "holidays"
    FOR ALL USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Email Logs
CREATE POLICY "email_logs_tenant_isolation" ON "email_logs"
    FOR ALL USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Notification Logs
CREATE POLICY "notification_logs_tenant_isolation" ON "notification_logs"
    FOR ALL USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- System Configs
CREATE POLICY "system_configs_tenant_isolation" ON "system_configs"
    FOR ALL USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Message Templates
CREATE POLICY "message_templates_tenant_isolation" ON "message_templates"
    FOR ALL USING ("tenantId" = current_setting('app.current_tenant_id', true));

-- Subscriptions
CREATE POLICY "subscriptions_tenant_isolation" ON "subscriptions"
    FOR ALL USING ("tenantId" = current_setting('app.current_tenant_id', true));