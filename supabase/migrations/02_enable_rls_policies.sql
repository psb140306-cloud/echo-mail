-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================
-- Enable RLS on all tables and create policies for tenant isolation
-- Purpose: Ensure users can only access data from their own tenant
-- Security: Critical for multi-tenant data isolation
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Helper Function: Get Current User's Tenant ID
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS TEXT AS $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  SELECT "tenantId" INTO v_tenant_id
  FROM public.tenant_members
  WHERE "userId" = auth.uid()::text
    AND "status" = 'ACTIVE'
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Tenant Table Policies
-- =============================================
-- Users can view their own tenant
CREATE POLICY "Users can view their own tenant"
  ON public.tenants
  FOR SELECT
  USING (
    "ownerId" = auth.uid()::text OR
    id IN (
      SELECT "tenantId" FROM public.tenant_members
      WHERE "userId" = auth.uid()::text AND "status" = 'ACTIVE'
    )
  );

-- Only owners can update their tenant
CREATE POLICY "Owners can update their tenant"
  ON public.tenants
  FOR UPDATE
  USING ("ownerId" = auth.uid()::text);

-- Service role can do anything (for system operations)
CREATE POLICY "Service role full access on tenants"
  ON public.tenants
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- TenantMember Table Policies
-- =============================================
-- Users can view members of their tenant
CREATE POLICY "Users can view their tenant members"
  ON public.tenant_members
  FOR SELECT
  USING (
    "tenantId" = public.get_user_tenant_id()
  );

-- Owners can manage members
CREATE POLICY "Owners can manage tenant members"
  ON public.tenant_members
  FOR ALL
  USING (
    "tenantId" IN (
      SELECT id FROM public.tenants
      WHERE "ownerId" = auth.uid()::text
    )
  );

-- Service role full access
CREATE POLICY "Service role full access on tenant_members"
  ON public.tenant_members
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- Company Table Policies
-- =============================================
CREATE POLICY "Users can view companies in their tenant"
  ON public.companies
  FOR SELECT
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Users can manage companies in their tenant"
  ON public.companies
  FOR ALL
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Service role full access on companies"
  ON public.companies
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- Contact Table Policies
-- =============================================
CREATE POLICY "Users can view contacts in their tenant"
  ON public.contacts
  FOR SELECT
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Users can manage contacts in their tenant"
  ON public.contacts
  FOR ALL
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Service role full access on contacts"
  ON public.contacts
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- EmailAccount Table Policies
-- =============================================
-- Note: email_accounts uses snake_case column name
CREATE POLICY "Users can view email accounts in their tenant"
  ON public.email_accounts
  FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can manage email accounts in their tenant"
  ON public.email_accounts
  FOR ALL
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Service role full access on email_accounts"
  ON public.email_accounts
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- EmailLog Table Policies
-- =============================================
CREATE POLICY "Users can view email logs in their tenant"
  ON public.email_logs
  FOR SELECT
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Users can insert email logs in their tenant"
  ON public.email_logs
  FOR INSERT
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Service role full access on email_logs"
  ON public.email_logs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- NotificationLog Table Policies
-- =============================================
CREATE POLICY "Users can view notification logs in their tenant"
  ON public.notification_logs
  FOR SELECT
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Users can insert notification logs in their tenant"
  ON public.notification_logs
  FOR INSERT
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Service role full access on notification_logs"
  ON public.notification_logs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- DeliveryRule Table Policies
-- =============================================
CREATE POLICY "Users can view delivery rules in their tenant"
  ON public.delivery_rules
  FOR SELECT
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Users can manage delivery rules in their tenant"
  ON public.delivery_rules
  FOR ALL
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Service role full access on delivery_rules"
  ON public.delivery_rules
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- Holiday Table Policies
-- =============================================
CREATE POLICY "Users can view holidays in their tenant"
  ON public.holidays
  FOR SELECT
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Users can manage holidays in their tenant"
  ON public.holidays
  FOR ALL
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Service role full access on holidays"
  ON public.holidays
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- MessageTemplate Table Policies
-- =============================================
CREATE POLICY "Users can view message templates in their tenant"
  ON public.message_templates
  FOR SELECT
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Users can manage message templates in their tenant"
  ON public.message_templates
  FOR ALL
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Service role full access on message_templates"
  ON public.message_templates
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- TenantInvitation Table Policies
-- =============================================
CREATE POLICY "Users can view invitations for their tenant"
  ON public.tenant_invitations
  FOR SELECT
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Owners can manage invitations"
  ON public.tenant_invitations
  FOR ALL
  USING (
    "tenantId" IN (
      SELECT id FROM public.tenants
      WHERE "ownerId" = auth.uid()::text
    )
  );

CREATE POLICY "Service role full access on tenant_invitations"
  ON public.tenant_invitations
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- Subscription Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant's subscription"
  ON public.subscriptions
  FOR SELECT
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Owners can manage subscriptions"
  ON public.subscriptions
  FOR ALL
  USING (
    "tenantId" IN (
      SELECT id FROM public.tenants
      WHERE "ownerId" = auth.uid()::text
    )
  );

CREATE POLICY "Service role full access on subscriptions"
  ON public.subscriptions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- Invoice Table Policies
-- =============================================
-- Note: invoices uses snake_case column name
CREATE POLICY "Users can view their tenant's invoices"
  ON public.invoices
  FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage invoices"
  ON public.invoices
  FOR ALL
  USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE "ownerId" = auth.uid()::text
    )
  );

CREATE POLICY "Service role full access on invoices"
  ON public.invoices
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- SystemConfig Table Policies
-- =============================================
-- System configs are tenant-specific
CREATE POLICY "Users can view their tenant's system config"
  ON public.system_configs
  FOR SELECT
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Admins can manage system config"
  ON public.system_configs
  FOR ALL
  USING (
    "tenantId" = public.get_user_tenant_id() AND
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE "userId" = auth.uid()::text
        AND "tenantId" = public.get_user_tenant_id()
        AND "role" IN ('OWNER', 'ADMIN')
        AND "status" = 'ACTIVE'
    )
  );

CREATE POLICY "Service role full access on system_configs"
  ON public.system_configs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- Grant Execute Permission on Helper Function
-- =============================================
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated;
