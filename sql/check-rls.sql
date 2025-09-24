-- Check RLS status for all tables
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    hasrls
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('companies', 'contacts', 'users', 'system_configs')
ORDER BY tablename;

-- Check existing RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;