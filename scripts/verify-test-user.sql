-- =====================================================================
-- 테스트 사용자 데이터 확인
-- =====================================================================

-- 1. Supabase Auth 사용자 확인
SELECT
  '1. Supabase Auth User' as step,
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'test@echomail.com';

-- 2. Prisma users 테이블 확인
SELECT
  '2. Prisma Users' as step,
  id,
  email,
  name,
  role,
  "tenantId",
  "emailVerified",
  "isActive"
FROM users
WHERE email = 'test@echomail.com';

-- 3. test 테넌트 확인
SELECT
  '3. Test Tenant' as step,
  id,
  name,
  subdomain,
  "subscriptionPlan",
  "subscriptionStatus",
  "ownerId"
FROM tenants
WHERE subdomain = 'test';

-- 4. 테넌트-사용자 관계 확인 (tenant_users 테이블이 있는 경우)
-- 현재 이 테이블이 없으므로 건너뜁니다
-- SELECT
--   '4. Tenant Users Relationship' as step,
--   tu.id,
--   tu."tenantId",
--   tu."userId",
--   tu.role,
--   tu."isActive",
--   u.email
-- FROM tenant_users tu
-- JOIN users u ON tu."userId" = u.id
-- WHERE u.email = 'test@echomail.com';

-- 5. 전체 조인 결과 확인
SELECT
  '5. Complete Join' as step,
  u.id as user_id,
  u.email,
  u."tenantId",
  t.id as tenant_id_from_join,
  t.subdomain,
  t."subscriptionPlan",
  CASE
    WHEN u."tenantId" IS NULL THEN 'NO TENANT ID'
    WHEN t.id IS NULL THEN 'TENANT NOT FOUND'
    ELSE 'OK'
  END as status
FROM users u
LEFT JOIN tenants t ON u."tenantId" = t.id
WHERE u.email = 'test@echomail.com';

-- 6. Auth user와 Prisma user의 ID가 같은지 확인
SELECT
  '6. ID Match Check' as step,
  au.id as auth_id,
  u.id as prisma_id,
  CASE
    WHEN au.id = u.id THEN 'MATCH'
    ELSE 'MISMATCH'
  END as id_status
FROM auth.users au
FULL OUTER JOIN users u ON au.email = u.email
WHERE au.email = 'test@echomail.com' OR u.email = 'test@echomail.com';
