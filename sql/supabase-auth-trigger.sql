-- Supabase Auth Webhook Trigger
-- 회원가입 시 자동으로 Next.js API를 호출하여 Tenant와 User 생성

-- 1. Webhook 함수 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  webhook_url text := 'https://echo-mail-blush.vercel.app/api/auth/webhook';
  -- 로컬 테스트: 'http://localhost:3000/api/auth/webhook'
BEGIN
  -- HTTP POST 요청으로 Webhook 호출
  PERFORM
    net.http_post(
      url := webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := json_build_object(
        'type', 'INSERT',
        'table', 'users',
        'record', json_build_object(
          'id', NEW.id,
          'email', NEW.email,
          'raw_user_meta_data', NEW.raw_user_meta_data,
          'created_at', NEW.created_at
        ),
        'old_record', NULL
      )::text
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger 생성 (auth.users 테이블에 INSERT 시 실행)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. 권한 설정
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;

-- 완료 메시지
SELECT 'Auth webhook trigger created successfully!' as message;
