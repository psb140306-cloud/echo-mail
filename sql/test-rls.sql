-- Test RLS policies
-- Execute this in Supabase SQL Editor to verify RLS is working

-- Check RLS status
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('companies', 'contacts', 'users', 'system_configs')
ORDER BY tablename;

-- Check created policies
SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test data access (should work with service role)
SELECT 'Companies count:' as test, count(*) as result FROM companies
UNION ALL
SELECT 'Users count:', count(*) FROM users
UNION ALL
SELECT 'System configs count:', count(*) FROM system_configs;