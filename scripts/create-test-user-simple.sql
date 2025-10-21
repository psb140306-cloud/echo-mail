-- =====================================================================
-- 간단한 테스트 계정 업데이트 스크립트
-- =====================================================================
-- 이미 test@echomail.com 계정이 있다면 비밀번호만 업데이트합니다
-- =====================================================================

-- 기존 사용자의 비밀번호와 이메일 인증 상태 업데이트
UPDATE users
SET
  password = '$2a$12$92z2JcJukD5jCeJ5UGSHyecwThmuyJjTHiaBOO/KzHzY9DlCYNduS',
  "emailVerified" = NOW(),
  "isActive" = true
WHERE email = 'test@echomail.com';

-- 결과 확인
SELECT
  email,
  name,
  role,
  "emailVerified" IS NOT NULL as email_verified,
  "isActive" as is_active,
  "tenantId" as tenant_id
FROM users
WHERE email = 'test@echomail.com';

-- =====================================================================
-- 결과
-- =====================================================================
-- 위 쿼리가 1 row를 반환하면 성공입니다.
--
-- 로그인 정보:
-- 이메일: test@echomail.com
-- 비밀번호: test123!
-- =====================================================================
