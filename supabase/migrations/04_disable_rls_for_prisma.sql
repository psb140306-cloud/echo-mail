-- =============================================
-- Prisma 직접 연결을 위한 RLS 우회 설정
-- =============================================
-- 문제: Prisma는 JWT 없이 postgres 유저로 직접 연결
-- 해결: postgres 유저는 RLS를 우회하도록 설정
-- =============================================

-- postgres 역할 체크 함수
CREATE OR REPLACE FUNCTION public.is_postgres_role()
RETURNS BOOLEAN AS $$
BEGIN
  -- 현재 세션의 역할이 postgres 또는 authenticator인 경우
  RETURN current_user IN ('postgres', 'authenticator', 'supabase_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- is_service_role 함수 수정 - postgres 역할도 service_role로 간주
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Postgres 유저는 무조건 service_role 취급
  IF public.is_postgres_role() THEN
    RETURN TRUE;
  END IF;

  -- 세션 변수에서 role 체크
  BEGIN
    v_role := current_setting('request.jwt.claim.role', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_role := NULL;
  END;

  IF v_role IS NULL THEN
    v_role := auth.jwt()->>'role';
  END IF;

  RETURN v_role = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 모든 테이블에 postgres 유저 전체 접근 허용 정책 추가
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE 'sql_%'
  ) LOOP
    -- postgres 역할에 대한 전체 접근 정책 추가
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "postgres_full_access_%s" ON public.%I FOR ALL USING (public.is_postgres_role())',
      r.tablename,
      r.tablename
    );
  END LOOP;
END $$;
