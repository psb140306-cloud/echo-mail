-- =====================================================================
-- 테스트 계정 디버깅 스크립트
-- =====================================================================
-- 이 스크립트로 현재 상태를 확인하세요
-- =====================================================================

-- 1. 현재 존재하는 테이블 확인
SELECT
  'Available Tables' as info,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. tenants 테이블이 있는지 확인
SELECT
  'Tenants Table Check' as info,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenants'
  ) as exists;

-- 3. users 테이블이 있는지 확인
SELECT
  'Users Table Check' as info,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) as exists;

-- 4. test 테넌트가 있는지 확인
SELECT
  'Test Tenant Check' as info,
  id,
  name,
  subdomain,
  "subscriptionPlan"
FROM tenants
WHERE subdomain = 'test'
LIMIT 1;

-- 5. test@echomail.com 사용자가 있는지 확인
SELECT
  'Test User Check' as info,
  id,
  email,
  name,
  role,
  "emailVerified",
  "tenantId",
  "isActive"
FROM users
WHERE email = 'test@echomail.com'
LIMIT 1;

-- 6. 사용자가 있다면 비밀번호 해시 확인
SELECT
  'Password Hash' as info,
  LEFT(password, 20) || '...' as password_preview
FROM users
WHERE email = 'test@echomail.com'
LIMIT 1;
