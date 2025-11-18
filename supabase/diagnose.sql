-- =============================================
-- 진단 쿼리: 왜 대시보드가 작동하지 않는가?
-- =============================================

-- 1. park8374@gmail.com 사용자의 테넌트 상태 확인
SELECT
  'User Tenant Status' as check_name,
  u.id as user_id,
  u.email,
  u.created_at as user_created,
  t.id as tenant_id,
  t.name as tenant_name,
  t."ownerId" as tenant_owner_id,
  tm.id as member_id,
  tm.role as member_role,
  tm.status as member_status
FROM auth.users u
LEFT JOIN tenants t ON t."ownerId" = u.id::text
LEFT JOIN tenant_members tm ON tm."userId" = u.id::text AND tm."tenantId" = t.id
WHERE u.email = 'park8374@gmail.com'
ORDER BY u.created_at DESC;

-- 2. 트리거 존재 확인
SELECT
  'Trigger Status' as check_name,
  tgname as trigger_name,
  tgenabled as is_enabled,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- 3. RLS 활성화 상태
SELECT
  'RLS Status' as check_name,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'tenant_members', 'companies')
ORDER BY tablename;

-- 4. RLS 정책 개수
SELECT
  'Policy Count' as check_name,
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- 5. 헬퍼 함수 존재 확인
SELECT
  'Helper Function' as check_name,
  proname as function_name,
  prorettype::regtype as return_type,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'get_user_tenant_id';

-- 6. 최근 생성된 사용자들의 테넌트 생성 여부
SELECT
  'Recent Users Tenant Status' as check_name,
  u.email,
  u.created_at as user_created,
  t.id as has_tenant,
  tm.id as has_membership
FROM auth.users u
LEFT JOIN tenants t ON t."ownerId" = u.id::text
LEFT JOIN tenant_members tm ON tm."userId" = u.id::text
WHERE u.created_at > NOW() - INTERVAL '7 days'
ORDER BY u.created_at DESC;

-- 7. PostgreSQL 로그에서 트리거 에러 확인 (최근 에러)
-- 이건 Supabase Dashboard > Logs에서 확인해야 함
SELECT
  'Check PostgreSQL Logs' as check_name,
  'Go to Supabase Dashboard > Logs > PostgreSQL Logs' as instruction,
  'Search for: "Failed to create tenant"' as search_term;
