-- =====================================================================
-- Supabase Auth 사용자와 Prisma users 테이블 동기화
-- =====================================================================
-- test@echomail.com 계정을 Supabase Auth에서 Prisma DB로 동기화
-- =====================================================================

-- 1. Supabase Auth에서 test@echomail.com 사용자 확인
SELECT
  'Supabase Auth User' as info,
  id as auth_user_id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'test@echomail.com';

-- 2. Prisma users 테이블에서 확인
SELECT
  'Prisma Users Table' as info,
  id,
  email,
  name,
  "tenantId",
  "emailVerified"
FROM users
WHERE email = 'test@echomail.com';

-- 3. test 테넌트 확인
SELECT
  'Test Tenant' as info,
  id as tenant_id,
  name,
  subdomain,
  "subscriptionPlan",
  "ownerId"
FROM tenants
WHERE subdomain = 'test';

-- =====================================================================
-- 동기화 스크립트
-- =====================================================================
-- 위 쿼리들을 실행해서 정보를 확인한 후,
-- 아래 주석을 해제하고 실제 ID 값들을 넣어서 실행하세요
-- =====================================================================

/*
-- STEP 1: Supabase Auth의 user ID 확인 (위 첫 번째 쿼리 결과에서 복사)
-- STEP 2: test 테넌트 ID 확인 (위 세 번째 쿼리 결과에서 복사)

-- STEP 3: Prisma users 테이블에 Supabase Auth 사용자 추가/업데이트
WITH auth_user AS (
  SELECT id, email FROM auth.users WHERE email = 'test@echomail.com' LIMIT 1
),
test_tenant AS (
  SELECT id FROM tenants WHERE subdomain = 'test' LIMIT 1
)
INSERT INTO users (
  id,
  email,
  name,
  password,
  role,
  "emailVerified",
  "tenantId",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  auth_user.id,  -- Supabase Auth의 ID 사용
  'test@echomail.com',
  '테스트 사용자',
  '$2a$12$92z2JcJukD5jCeJ5UGSHyecwThmuyJjTHiaBOO/KzHzY9DlCYNduS',  -- test123!
  'ADMIN',
  NOW(),
  test_tenant.id,
  true,
  NOW(),
  NOW()
FROM auth_user, test_tenant
ON CONFLICT (id)
DO UPDATE SET
  "emailVerified" = NOW(),
  "tenantId" = (SELECT id FROM tenants WHERE subdomain = 'test' LIMIT 1),
  "isActive" = true,
  email = 'test@echomail.com';

-- STEP 4: 테넌트-사용자 관계 설정 (tenant_users 테이블이 있는 경우)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_users'
  ) THEN
    WITH auth_user AS (
      SELECT id FROM auth.users WHERE email = 'test@echomail.com' LIMIT 1
    ),
    test_tenant AS (
      SELECT id FROM tenants WHERE subdomain = 'test' LIMIT 1
    )
    INSERT INTO tenant_users (
      id,
      "tenantId",
      "userId",
      role,
      "acceptedAt",
      "isActive",
      "createdAt",
      "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      test_tenant.id,
      auth_user.id,
      'OWNER',
      NOW(),
      true,
      NOW(),
      NOW()
    FROM auth_user, test_tenant
    ON CONFLICT ("tenantId", "userId")
    DO UPDATE SET
      role = 'OWNER',
      "acceptedAt" = NOW(),
      "isActive" = true;

    RAISE NOTICE 'tenant_users 관계 설정 완료';
  END IF;
END $$;

-- STEP 5: 테넌트 소유자 설정
WITH auth_user AS (
  SELECT id FROM auth.users WHERE email = 'test@echomail.com' LIMIT 1
)
UPDATE tenants
SET "ownerId" = auth_user.id
FROM auth_user
WHERE subdomain = 'test';

-- STEP 6: 결과 확인
SELECT
  'Sync Result' as info,
  u.id as user_id,
  u.email,
  u.name,
  u."emailVerified" IS NOT NULL as email_verified,
  t.subdomain as tenant,
  t."subscriptionPlan" as subscription_plan,
  u.role as user_role,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_users')
    THEN (SELECT tu.role FROM tenant_users tu WHERE tu."userId" = u.id AND tu."tenantId" = t.id)
    ELSE NULL
  END as tenant_role
FROM users u
LEFT JOIN tenants t ON u."tenantId" = t.id
WHERE u.email = 'test@echomail.com';
*/

-- =====================================================================
-- 간단 버전 (auth.users 테이블 접근이 안 될 경우)
-- =====================================================================
-- Supabase Dashboard → Authentication → Users에서
-- test@echomail.com의 UUID를 복사한 후 아래 주석을 해제하고
-- <AUTH_USER_UUID>를 실제 UUID로 교체하세요
-- =====================================================================

/*
WITH test_tenant AS (
  SELECT id FROM tenants WHERE subdomain = 'test' LIMIT 1
)
INSERT INTO users (
  id,
  email,
  name,
  password,
  role,
  "emailVerified",
  "tenantId",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  '<AUTH_USER_UUID>',  -- Supabase Dashboard에서 복사한 UUID
  'test@echomail.com',
  '테스트 사용자',
  '$2a$12$92z2JcJukD5jCeJ5UGSHyecwThmuyJjTHiaBOO/KzHzY9DlCYNduS',
  'ADMIN',
  NOW(),
  test_tenant.id,
  true,
  NOW(),
  NOW()
FROM test_tenant
ON CONFLICT (id)
DO UPDATE SET
  "emailVerified" = NOW(),
  "tenantId" = (SELECT id FROM tenants WHERE subdomain = 'test' LIMIT 1),
  "isActive" = true;
*/
