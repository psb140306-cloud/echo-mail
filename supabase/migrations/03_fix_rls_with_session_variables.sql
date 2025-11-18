-- =============================================
-- Fix RLS to work with Prisma session variables
-- =============================================
-- Problem: auth.uid() returns NULL when using Prisma direct connection
-- Solution: Use current_setting() to read request.jwt.claim.sub set by Prisma
-- =============================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_user_tenant_id();

-- Recreate with session variable support
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS TEXT AS $$
DECLARE
  v_tenant_id TEXT;
  v_user_id TEXT;
BEGIN
  -- Try to get userId from session variable (set by Prisma)
  BEGIN
    v_user_id := current_setting('request.jwt.claim.sub', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_user_id := NULL;
  END;

  -- If session variable is not set, try auth.uid() (for PostgREST)
  IF v_user_id IS NULL THEN
    v_user_id := auth.uid()::text;
  END IF;

  -- If still no user ID, return NULL (no access)
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get tenant ID from tenant_members
  SELECT "tenantId" INTO v_tenant_id
  FROM public.tenant_members
  WHERE "userId" = v_user_id
    AND "status" = 'ACTIVE'
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- Helper function to get current user ID
-- =============================================
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS TEXT AS $$
DECLARE
  v_user_id TEXT;
BEGIN
  -- Try to get userId from session variable (set by Prisma)
  BEGIN
    v_user_id := current_setting('request.jwt.claim.sub', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_user_id := NULL;
  END;

  -- If session variable is not set, try auth.uid() (for PostgREST)
  IF v_user_id IS NULL THEN
    v_user_id := auth.uid()::text;
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- Helper function to check if service role
-- =============================================
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Try to get role from session variable (set by Prisma)
  BEGIN
    v_role := current_setting('request.jwt.claim.role', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_role := NULL;
  END;

  -- If session variable is not set, try JWT (for PostgREST)
  IF v_role IS NULL THEN
    v_role := auth.jwt()->>'role';
  END IF;

  RETURN v_role = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- Update all existing policies to use new functions
-- =============================================

-- Drop all existing policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.schemaname || '.' || r.tablename;
  END LOOP;
END $$;

-- =============================================
-- Tenant Table Policies
-- =============================================
CREATE POLICY "Users can view their own tenant"
  ON public.tenants
  FOR SELECT
  USING (
    "ownerId" = public.get_current_user_id() OR
    id = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Owners can update their tenant"
  ON public.tenants
  FOR UPDATE
  USING (
    "ownerId" = public.get_current_user_id() OR
    public.is_service_role()
  );

CREATE POLICY "Service role full access on tenants"
  ON public.tenants
  FOR ALL
  USING (public.is_service_role());

-- =============================================
-- TenantMember Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant members"
  ON public.tenant_members
  FOR SELECT
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Owners can manage tenant members"
  ON public.tenant_members
  FOR ALL
  USING (
    "tenantId" IN (
      SELECT id FROM public.tenants
      WHERE "ownerId" = public.get_current_user_id()
    ) OR
    public.is_service_role()
  );

-- =============================================
-- Company Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant companies"
  ON public.companies
  FOR SELECT
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Users can manage their tenant companies"
  ON public.companies
  FOR ALL
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

-- =============================================
-- Contact Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant contacts"
  ON public.contacts
  FOR SELECT
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Users can manage their tenant contacts"
  ON public.contacts
  FOR ALL
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

-- =============================================
-- Email Account Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant email accounts"
  ON public.email_accounts
  FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Users can manage their tenant email accounts"
  ON public.email_accounts
  FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id() OR
    public.is_service_role()
  );

-- =============================================
-- Email Log Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant email logs"
  ON public.email_logs
  FOR SELECT
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Users can insert their tenant email logs"
  ON public.email_logs
  FOR INSERT
  WITH CHECK (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

-- =============================================
-- Notification Log Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant notification logs"
  ON public.notification_logs
  FOR SELECT
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Users can insert their tenant notification logs"
  ON public.notification_logs
  FOR INSERT
  WITH CHECK (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

-- =============================================
-- Delivery Rule Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant delivery rules"
  ON public.delivery_rules
  FOR SELECT
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Users can manage their tenant delivery rules"
  ON public.delivery_rules
  FOR ALL
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

-- =============================================
-- Holiday Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant holidays"
  ON public.holidays
  FOR SELECT
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Users can manage their tenant holidays"
  ON public.holidays
  FOR ALL
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

-- =============================================
-- Message Template Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant templates"
  ON public.message_templates
  FOR SELECT
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Users can manage their tenant templates"
  ON public.message_templates
  FOR ALL
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

-- =============================================
-- Tenant Invitation Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant invitations"
  ON public.tenant_invitations
  FOR SELECT
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Users can manage their tenant invitations"
  ON public.tenant_invitations
  FOR ALL
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

-- =============================================
-- Subscription Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Users can manage their tenant subscriptions"
  ON public.subscriptions
  FOR ALL
  USING (
    "tenantId" = public.get_user_tenant_id() OR
    public.is_service_role()
  );

-- =============================================
-- Invoice Table Policies
-- =============================================
CREATE POLICY "Users can view their tenant invoices"
  ON public.invoices
  FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id() OR
    public.is_service_role()
  );

CREATE POLICY "Users can manage their tenant invoices"
  ON public.invoices
  FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id() OR
    public.is_service_role()
  );

-- =============================================
-- System Config Table Policies
-- =============================================
CREATE POLICY "Service role full access on system_configs"
  ON public.system_configs
  FOR ALL
  USING (public.is_service_role());
