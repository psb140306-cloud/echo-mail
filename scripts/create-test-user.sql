-- =====================================================================
-- Echo Mail 테스트 계정 생성 SQL
-- =====================================================================
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요
-- =====================================================================

-- 주의사항:
-- 1. 이 스크립트는 여러 번 실행해도 안전합니다 (ON CONFLICT 처리)
-- 2. 테이블이 존재하지 않으면 해당 부분을 주석 처리하세요

-- =====================================================================
-- STEP 1: 테스트 테넌트 생성
-- =====================================================================
INSERT INTO tenants (
  id,
  name,
  subdomain,
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
  gen_random_uuid(),
  '테스트 회사',
  'test',
  'PROFESSIONAL',
  'ACTIVE',
  NOW() + INTERVAL '1 year',
  50,
  300,
  5000,
  10000,
  NOW(),
  NOW()
)
ON CONFLICT (subdomain) DO UPDATE SET
  "subscriptionPlan" = 'PROFESSIONAL',
  "subscriptionStatus" = 'ACTIVE',
  "trialEndsAt" = NOW() + INTERVAL '1 year'
RETURNING id, subdomain, "subscriptionPlan";

-- =====================================================================
-- STEP 2: 테스트 사용자 생성 (이메일 인증 완료)
-- =====================================================================
WITH tenant_info AS (
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
  gen_random_uuid(),
  'test@echomail.com',
  '테스트 사용자',
  -- bcrypt hash for 'test123!' (cost 12)
  '$2a$12$92z2JcJukD5jCeJ5UGSHyecwThmuyJjTHiaBOO/KzHzY9DlCYNduS',
  'ADMIN',
  NOW(), -- 이메일 인증 완료
  tenant_info.id,
  true,
  NOW(),
  NOW()
FROM tenant_info
ON CONFLICT (email)
DO UPDATE SET
  "emailVerified" = NOW(),
  password = '$2a$12$92z2JcJukD5jCeJ5UGSHyecwThmuyJjTHiaBOO/KzHzY9DlCYNduS',
  "tenantId" = (SELECT id FROM tenants WHERE subdomain = 'test' LIMIT 1),
  "isActive" = true
RETURNING id, email, "emailVerified";

-- =====================================================================
-- STEP 3: 테넌트-사용자 관계 설정 (tenant_users 테이블이 있는 경우)
-- =====================================================================
-- 주의: tenant_users 테이블이 없으면 이 부분을 주석 처리하거나 건너뛰세요

DO $$
BEGIN
  -- tenant_users 테이블이 존재하는지 확인
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'tenant_users'
  ) THEN
    -- 테이블이 있으면 관계 설정
    WITH tenant_info AS (
      SELECT id FROM tenants WHERE subdomain = 'test' LIMIT 1
    ),
    user_info AS (
      SELECT id FROM users WHERE email = 'test@echomail.com' LIMIT 1
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
      tenant_info.id,
      user_info.id,
      'OWNER',
      NOW(),
      true,
      NOW(),
      NOW()
    FROM tenant_info, user_info
    ON CONFLICT ("tenantId", "userId")
    DO UPDATE SET
      role = 'OWNER',
      "acceptedAt" = NOW(),
      "isActive" = true;

    RAISE NOTICE 'tenant_users 관계 설정 완료';
  ELSE
    RAISE NOTICE 'tenant_users 테이블이 없습니다. 건너뜁니다.';
  END IF;
END $$;

-- =====================================================================
-- STEP 4: 테넌트 소유자 설정
-- =====================================================================
WITH user_info AS (
  SELECT id FROM users WHERE email = 'test@echomail.com' LIMIT 1
)
UPDATE tenants
SET "ownerId" = user_info.id
FROM user_info
WHERE subdomain = 'test'
RETURNING subdomain, "ownerId";

-- =====================================================================
-- STEP 5: 결과 확인
-- =====================================================================
DO $$
DECLARE
  result_record RECORD;
  tenant_role_value TEXT;
BEGIN
  -- 먼저 기본 사용자 정보 조회
  SELECT
    u.email,
    u.name,
    u."emailVerified" IS NOT NULL as email_verified,
    u."emailVerified" as email_verified_at,
    t.subdomain as tenant,
    t."subscriptionPlan" as subscription_plan,
    t."subscriptionStatus" as subscription_status,
    u.role as user_role
  INTO result_record
  FROM users u
  LEFT JOIN tenants t ON u."tenantId" = t.id
  WHERE u.email = 'test@echomail.com';

  -- tenant_users 테이블이 있으면 역할 확인
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_users') THEN
    SELECT tu.role INTO tenant_role_value
    FROM tenant_users tu
    JOIN users u ON tu."userId" = u.id
    WHERE u.email = 'test@echomail.com'
    LIMIT 1;
  ELSE
    tenant_role_value := 'N/A (table not exists)';
  END IF;

  -- 결과 출력
  RAISE NOTICE '=================================================';
  RAISE NOTICE '테스트 계정 생성 완료!';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Email: %', result_record.email;
  RAISE NOTICE 'Name: %', result_record.name;
  RAISE NOTICE 'Email Verified: %', result_record.email_verified;
  RAISE NOTICE 'Tenant: %', result_record.tenant;
  RAISE NOTICE 'Subscription Plan: %', result_record.subscription_plan;
  RAISE NOTICE 'User Role: %', result_record.user_role;
  RAISE NOTICE 'Tenant Role: %', tenant_role_value;
  RAISE NOTICE '=================================================';
  RAISE NOTICE '로그인 정보:';
  RAISE NOTICE '  이메일: test@echomail.com';
  RAISE NOTICE '  비밀번호: test123!';
  RAISE NOTICE '=================================================';
END $$;

-- 또는 간단한 조회 (tenant_users 없이)
SELECT
  u.email,
  u.name,
  u."emailVerified" IS NOT NULL as email_verified,
  u."emailVerified" as email_verified_at,
  t.subdomain as tenant,
  t."subscriptionPlan" as subscription_plan,
  t."subscriptionStatus" as subscription_status,
  u.role as user_role
FROM users u
LEFT JOIN tenants t ON u."tenantId" = t.id
WHERE u.email = 'test@echomail.com';

-- =====================================================================
-- 추가: 현재 데이터베이스 테이블 목록 확인
-- =====================================================================
SELECT
  table_name,
  CASE
    WHEN table_name IN ('tenants', 'users', 'tenant_users') THEN '✓ 중요'
    ELSE ''
  END as importance
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('tenants', 'users', 'tenant_users', 'companies', 'contacts')
ORDER BY table_name;

-- =====================================================================
-- 결과 확인
-- =====================================================================
-- 성공하면 다음과 같은 결과가 표시됩니다:
-- ✓ email: test@echomail.com
-- ✓ name: 테스트 사용자
-- ✓ email_verified: true
-- ✓ tenant: test
-- ✓ subscription_plan: PROFESSIONAL
-- ✓ user_role: ADMIN
-- ✓ tenant_role: OWNER (tenant_users 테이블이 있는 경우)
--
-- 로그인 정보:
-- 이메일: test@echomail.com
-- 비밀번호: test123!
-- =====================================================================
