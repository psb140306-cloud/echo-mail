-- =====================================================================
-- 테스트 사용자 ID 동기화
-- =====================================================================
-- Prisma users 테이블의 ID를 Supabase Auth ID로 변경
--
-- 문제: test@echomail.com 사용자가 Supabase Auth와 Prisma users 테이블에
--      서로 다른 ID로 존재하여 로그인 후 테넌트 정보를 찾을 수 없음
--
-- 해결: 기존 Prisma users 레코드를 삭제하고 Supabase Auth의 UUID를
--      사용하여 다시 생성
--
-- 실행 방법:
-- 1. Supabase Dashboard → SQL Editor로 이동
-- 2. 이 스크립트 전체를 복사하여 붙여넣기
-- 3. Run 버튼 클릭
-- 4. STEP 4 결과에서 id_status와 tenant_status가 모두 ✓ 인지 확인
-- =====================================================================

-- STEP 1: 현재 상태 확인
SELECT
  'Before Update' as status,
  au.id::text as auth_id,
  u.id as old_prisma_id,
  u."tenantId"
FROM auth.users au
LEFT JOIN users u ON u.email = au.email
WHERE au.email = 'test@echomail.com';

-- STEP 2: 기존 Prisma 사용자 삭제하고 올바른 ID로 다시 생성
WITH auth_user AS (
  SELECT id, email FROM auth.users WHERE email = 'test@echomail.com' LIMIT 1
),
test_tenant AS (
  SELECT id FROM tenants WHERE subdomain = 'test' LIMIT 1
),
old_user AS (
  DELETE FROM users WHERE email = 'test@echomail.com' RETURNING "tenantId"
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
  auth_user.id::text,  -- Supabase Auth의 UUID를 text로 변환
  'test@echomail.com',
  '테스트 사용자',
  '$2a$12$92z2JcJukD5jCeJ5UGSHyecwThmuyJjTHiaBOO/KzHzY9DlCYNduS',  -- test123!
  'ADMIN',
  NOW(),
  test_tenant.id,
  true,
  NOW(),
  NOW()
FROM auth_user, test_tenant;

-- STEP 3: 테넌트 소유자 업데이트
WITH auth_user AS (
  SELECT id FROM auth.users WHERE email = 'test@echomail.com' LIMIT 1
)
UPDATE tenants
SET "ownerId" = auth_user.id::text
FROM auth_user
WHERE subdomain = 'test';

-- STEP 4: 결과 확인
SELECT
  'After Update' as status,
  au.id::text as auth_id,
  u.id as new_prisma_id,
  u."tenantId",
  t.subdomain,
  CASE
    WHEN au.id::text = u.id THEN 'MATCH ✓'
    ELSE 'MISMATCH ✗'
  END as id_status,
  CASE
    WHEN u."tenantId" IS NULL THEN 'NO TENANT ID ✗'
    WHEN t.id IS NULL THEN 'TENANT NOT FOUND ✗'
    ELSE 'OK ✓'
  END as tenant_status
FROM auth.users au
JOIN users u ON u.email = au.email
LEFT JOIN tenants t ON u."tenantId" = t.id
WHERE au.email = 'test@echomail.com';
