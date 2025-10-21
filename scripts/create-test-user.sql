-- =====================================================================
-- Echo Mail 테스트 계정 생성 SQL
-- =====================================================================
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요
-- =====================================================================

-- 1. 테스트 테넌트 생성
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
ON CONFLICT (subdomain) DO NOTHING
RETURNING id;

-- 테넌트 ID 저장 (다음 쿼리에서 사용)
-- 위 쿼리 실행 후 나온 ID를 복사하거나, 아래 쿼리로 확인:
-- SELECT id FROM tenants WHERE subdomain = 'test';

-- 2. 테스트 사용자 생성 (이메일 인증 완료)
-- 주의: <TENANT_ID>를 위에서 얻은 실제 테넌트 ID로 교체하세요
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
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWYgMm7G',
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
  password = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWYgMm7G',
  "tenantId" = (SELECT id FROM tenants WHERE subdomain = 'test' LIMIT 1)
RETURNING id, email;

-- 3. 테넌트-사용자 관계 설정 (OWNER 역할)
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
  "isActive" = true
RETURNING id;

-- 4. 테넌트 소유자 설정
WITH user_info AS (
  SELECT id FROM users WHERE email = 'test@echomail.com' LIMIT 1
)
UPDATE tenants
SET "ownerId" = user_info.id
FROM user_info
WHERE subdomain = 'test';

-- 5. 확인 쿼리
SELECT
  u.email,
  u.name,
  u."emailVerified" IS NOT NULL as email_verified,
  t.subdomain as tenant,
  t."subscriptionPlan",
  tu.role as tenant_role
FROM users u
LEFT JOIN tenants t ON u."tenantId" = t.id
LEFT JOIN tenant_users tu ON tu."userId" = u.id AND tu."tenantId" = t.id
WHERE u.email = 'test@echomail.com';

-- =====================================================================
-- 결과 확인
-- =====================================================================
-- 위 쿼리 실행 결과:
-- ✓ email: test@echomail.com
-- ✓ name: 테스트 사용자
-- ✓ email_verified: true
-- ✓ tenant: test
-- ✓ subscription_plan: PROFESSIONAL
-- ✓ tenant_role: OWNER
--
-- 로그인 정보:
-- 이메일: test@echomail.com
-- 비밀번호: test123!
-- =====================================================================
