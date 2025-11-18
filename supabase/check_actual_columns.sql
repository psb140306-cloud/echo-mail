-- 실제 데이터베이스의 컬럼명 확인
-- Supabase SQL Editor에서 실행하세요

-- 1. email_accounts 테이블의 실제 컬럼명
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'email_accounts'
ORDER BY ordinal_position;

-- 2. companies 테이블의 실제 컬럼명
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'companies'
ORDER BY ordinal_position;

-- 3. tenants 테이블의 실제 컬럼명
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenants'
ORDER BY ordinal_position;

-- 4. tenant_members 테이블의 실제 컬럼명
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenant_members'
ORDER BY ordinal_position;
