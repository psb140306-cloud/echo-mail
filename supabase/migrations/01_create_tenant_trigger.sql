-- =============================================
-- Supabase Database Trigger: Auto-create Tenant on User Signup
-- =============================================
-- This trigger automatically creates a Tenant and TenantMember
-- when a new user is created in auth.users table.
--
-- Purpose: Ensure every user has a tenant immediately after signup
-- Solves: Tenant creation failures and data exposure issues
-- =============================================

-- Create function to auto-create tenant
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_subdomain TEXT;
  v_company_name TEXT;
  v_owner_name TEXT;
  v_tenant_id TEXT;
BEGIN
  -- Extract metadata or use defaults
  v_company_name := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    split_part(NEW.email, '@', 1)
  );

  v_owner_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Generate subdomain (remove special characters)
  v_subdomain := COALESCE(
    NEW.raw_user_meta_data->>'subdomain',
    regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9-]', '', 'g')
  );

  -- Generate unique tenant ID (cuid format)
  v_tenant_id := 'cm' || encode(gen_random_bytes(12), 'hex');

  -- Insert Tenant
  INSERT INTO public.tenants (
    id,
    name,
    subdomain,
    "ownerId",
    "ownerEmail",
    "ownerName",
    "subscriptionPlan",
    "subscriptionStatus",
    "trialEndsAt",
    "maxCompanies",
    "maxContacts",
    "maxEmails",
    "maxNotifications",
    "createdAt",
    "updatedAt"
  ) VALUES (
    v_tenant_id,
    v_company_name,
    v_subdomain,
    NEW.id::text,  -- Cast UUID to TEXT
    NEW.email,
    v_owner_name,
    'FREE_TRIAL',
    'TRIAL',
    NOW() + INTERVAL '14 days',
    10,
    50,
    100,
    100,
    NOW(),
    NOW()
  );

  -- Insert TenantMember
  INSERT INTO public.tenant_members (
    id,
    "userId",
    "tenantId",
    "userEmail",
    role,
    status,
    "invitedAt",
    "acceptedAt",
    "createdAt",
    "updatedAt"
  ) VALUES (
    'cm' || encode(gen_random_bytes(12), 'hex'),
    NEW.id::text,  -- Cast UUID to TEXT
    v_tenant_id,
    NEW.email,
    'OWNER',
    'ACTIVE',
    NOW(),  -- invitedAt
    NOW(),  -- acceptedAt
    NOW(),
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create tenant for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
