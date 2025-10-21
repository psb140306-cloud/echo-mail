-- =====================================================================
-- Supabase Auth 사용자 자동 동기화 설정
-- =====================================================================
-- auth.users에 새 사용자가 생성될 때 public.users에도 자동으로 생성
-- 이렇게 하면 ID 매칭 문제가 발생하지 않음
--
-- 실행 방법:
-- 1. Supabase Dashboard → SQL Editor로 이동
-- 2. 이 스크립트 전체를 복사하여 붙여넣기
-- 3. Run 버튼 클릭
-- =====================================================================

-- STEP 1: 기존 트리거가 있으면 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- STEP 2: 새 사용자 생성 핸들러 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tenant_id text;
  company_name text;
  subdomain_value text;
  plan_value text;
BEGIN
  -- 메타데이터에서 정보 추출
  company_name := NEW.raw_user_meta_data->>'company_name';
  subdomain_value := NEW.raw_user_meta_data->>'subdomain';
  plan_value := COALESCE(NEW.raw_user_meta_data->>'subscription_plan', 'FREE_TRIAL');

  -- 테넌트 생성 (회사 정보가 있는 경우)
  IF company_name IS NOT NULL AND subdomain_value IS NOT NULL THEN
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
      'tenant_' || REPLACE(NEW.id::text, '-', ''),  -- 테넌트 ID 생성
      company_name,
      subdomain_value,
      plan_value::subscription_plan,
      'TRIAL',
      NOW() + INTERVAL '14 days',
      CASE plan_value
        WHEN 'FREE_TRIAL' THEN 10
        WHEN 'STARTER' THEN 10
        WHEN 'PROFESSIONAL' THEN 50
        WHEN 'BUSINESS' THEN -1
        ELSE 10
      END,
      CASE plan_value
        WHEN 'FREE_TRIAL' THEN 50
        WHEN 'STARTER' THEN 50
        WHEN 'PROFESSIONAL' THEN 300
        WHEN 'BUSINESS' THEN -1
        ELSE 50
      END,
      CASE plan_value
        WHEN 'FREE_TRIAL' THEN 500
        WHEN 'STARTER' THEN 500
        WHEN 'PROFESSIONAL' THEN 2000
        WHEN 'BUSINESS' THEN -1
        ELSE 500
      END,
      CASE plan_value
        WHEN 'FREE_TRIAL' THEN 1000
        WHEN 'STARTER' THEN 1000
        WHEN 'PROFESSIONAL' THEN 5000
        WHEN 'BUSINESS' THEN -1
        ELSE 1000
      END,
      NOW(),
      NOW()
    )
    RETURNING id INTO tenant_id;

    RAISE NOTICE 'Created tenant: % (id: %)', company_name, tenant_id;
  ELSE
    -- 테넌트 정보가 없으면 기본 테넌트 사용 (선택사항)
    tenant_id := NULL;
    RAISE NOTICE 'No tenant info provided for user: %', NEW.email;
  END IF;

  -- public.users 테이블에 사용자 생성 (⭐ Auth ID와 동일한 ID 사용)
  INSERT INTO public.users (
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
  ) VALUES (
    NEW.id::text,  -- ⭐⭐⭐ Supabase Auth의 UUID를 그대로 사용!
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '사용자'),
    '',  -- Supabase Auth가 비밀번호 관리하므로 빈 문자열
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'OWNER' THEN 'ADMIN'
      ELSE 'ADMIN'
    END,
    NEW.email_confirmed_at,
    tenant_id,
    true,
    NOW(),
    NOW()
  );

  -- 테넌트 소유자 설정
  IF tenant_id IS NOT NULL THEN
    UPDATE tenants
    SET "ownerId" = NEW.id::text
    WHERE id = tenant_id;
  END IF;

  RAISE NOTICE 'Created user: % (id: %)', NEW.email, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;  -- 에러가 있어도 Auth 사용자 생성은 계속 진행
END;
$$;

-- STEP 3: 트리거 등록
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- STEP 4: 결과 확인
SELECT
  'Trigger Setup Complete' as status,
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
