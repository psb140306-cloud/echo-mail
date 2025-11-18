# Supabase Security Setup

## Overview

This directory contains SQL migrations for implementing database-level security in Supabase:

1. **Automatic Tenant Creation** - Database trigger that creates tenant + membership when users sign up
2. **Row Level Security (RLS)** - Policies that ensure users can only access their own tenant's data

## Problem Solved

### Before (Application-Level)
- Tenant creation scattered across 3 locations in application code
- Race conditions and deployment delays caused failures
- Users without tenants could see other users' data (critical security issue)
- Manual intervention required to fix broken accounts

### After (Database-Level)
- Tenant creation happens instantly at the database level
- Impossible for a user to exist without a tenant
- RLS policies prevent data leakage even if application code fails
- Zero-trust security model

## Files

### 01_create_tenant_trigger.sql
Creates a PostgreSQL trigger that automatically:
- Creates a Tenant when a new user signs up
- Creates a TenantMember with OWNER role
- Sets up free trial subscription (14 days)
- Generates unique subdomain from email

**Trigger Function**: `handle_new_user()`
**Trigger**: `on_auth_user_created` on `auth.users` table

### 02_enable_rls_policies.sql
Enables Row Level Security on all tables and creates policies:

**Tables Protected**:
- ✅ Tenant
- ✅ TenantMember
- ✅ Company
- ✅ Contact
- ✅ EmailAccount
- ✅ EmailLog
- ✅ NotificationLog
- ✅ DeliveryRule
- ✅ Holiday
- ✅ MessageTemplate
- ✅ TenantInvitation
- ✅ Subscription
- ✅ Invoice
- ✅ SystemConfig

**Helper Function**: `get_user_tenant_id()` - Returns the current authenticated user's tenant ID

**Policy Types**:
- SELECT: Users can view data from their tenant only
- INSERT/UPDATE/DELETE: Users can manage data in their tenant only
- Service role: Full access for system operations

## Deployment

### Option 1: Supabase Dashboard (Recommended for First Time)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy contents of `01_create_tenant_trigger.sql`
5. Run the query
6. Repeat for `02_enable_rls_policies.sql`

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy migrations
supabase db push --include-all
```

### Option 3: Use Deployment Script

```bash
cd supabase
chmod +x deploy-security.sh
./deploy-security.sh
```

## Testing

### 1. Test Tenant Auto-Creation

```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Create a test user via Supabase Auth UI
-- Then check if tenant was created
SELECT t.*, tm.*
FROM "Tenant" t
JOIN "TenantMember" tm ON t.id = tm."tenantId"
WHERE t."ownerEmail" = 'test@example.com';
```

### 2. Test RLS Policies

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Should show 'true' for all tables
```

### 3. Test Application

1. Sign up a new user
2. Verify they're redirected to dashboard (not error page)
3. Verify they only see their own data
4. Try accessing another tenant's data via API - should fail

## Security Improvements

### Before Deployment
- ❌ No RLS on any tables
- ❌ Users without tenants see other users' data
- ❌ Tenant creation can fail silently
- ❌ Application code has full database access
- ❌ Security depends on application code working perfectly

### After Deployment
- ✅ RLS enabled on all 14 tables
- ✅ Database-level tenant isolation
- ✅ Every user guaranteed to have a tenant
- ✅ Even if application code fails, users can't access other tenants' data
- ✅ Defense in depth security model

## Maintenance

### Adding New Tables

When adding new tenant-scoped tables:

1. Add `tenantId` column
2. Enable RLS: `ALTER TABLE "NewTable" ENABLE ROW LEVEL SECURITY;`
3. Create policies:

```sql
CREATE POLICY "Users can view their tenant's data"
  ON public."NewTable"
  FOR SELECT
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Users can manage their tenant's data"
  ON public."NewTable"
  FOR ALL
  USING ("tenantId" = public.get_user_tenant_id());

CREATE POLICY "Service role full access"
  ON public."NewTable"
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
```

### Monitoring

```sql
-- Check recent user signups and tenant creation
SELECT
  u.id,
  u.email,
  u.created_at as user_created,
  t.id as tenant_id,
  t.created_at as tenant_created,
  tm.role
FROM auth.users u
LEFT JOIN "Tenant" t ON t."ownerId" = u.id
LEFT JOIN "TenantMember" tm ON tm."userId" = u.id AND tm."tenantId" = t.id
ORDER BY u.created_at DESC
LIMIT 20;

-- Check for users without tenants (should be 0)
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN "Tenant" t ON t."ownerId" = u.id
WHERE t.id IS NULL;
```

## Rollback

If you need to rollback:

```sql
-- Disable RLS
ALTER TABLE public."Tenant" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."TenantMember" DISABLE ROW LEVEL SECURITY;
-- ... (repeat for all tables)

-- Drop trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop helper function
DROP FUNCTION IF EXISTS public.get_user_tenant_id();
```

## Next Steps After Deployment

1. **Test thoroughly** with new user signups
2. **Monitor** for any users without tenants
3. **Remove redundant code** (optional):
   - Tenant creation in `app/auth/callback/route.ts`
   - Tenant creation in `app/api/auth/setup-account/route.ts`
   - Defensive tenant checks (can keep for extra safety)

4. **Keep application-level checks** for better error messages
5. **Consider soft deletes** for tenant data retention compliance

## Support

If you encounter issues:

1. Check Supabase logs in Dashboard > Logs
2. Check PostgreSQL logs for trigger errors
3. Verify RLS policies with test queries
4. Contact Supabase support if needed

## Important Notes

- **Service Role Key**: The trigger uses `SECURITY DEFINER` to bypass RLS during tenant creation
- **Error Handling**: Trigger uses `EXCEPTION` block to prevent user creation failure
- **CUID Generation**: Uses PostgreSQL's `gen_random_bytes()` for unique IDs
- **Idempotent**: Safe to run multiple times (will skip existing policies)
