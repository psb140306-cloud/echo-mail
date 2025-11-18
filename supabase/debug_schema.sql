-- 실제 데이터베이스 스키마 확인
-- 이 쿼리를 Supabase SQL Editor에서 실행하세요

-- 1. tenants 테이블의 컬럼 타입 확인
SELECT
  column_name,
  data_type,
  udt_name,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenants'
ORDER BY ordinal_position;

-- 2. tenant_members 테이블의 컬럼 타입 확인
SELECT
  column_name,
  data_type,
  udt_name,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenant_members'
ORDER BY ordinal_position;

-- 3. auth.users 테이블의 id 컬럼 타입 확인
SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'users'
  AND column_name = 'id';
