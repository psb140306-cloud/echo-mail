# Supabase Auth Webhook 설정 가이드

## 문제
새로 가입하는 사용자의 Tenant가 자동으로 생성되지 않음

## 해결 방법
Supabase Database Trigger를 사용하여 회원가입 시 자동으로 Tenant 생성

---

## 설정 단계

### 1. Supabase 대시보드 접속
1. https://supabase.com 로그인
2. Echo Mail 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭

### 2. SQL 실행
1. **New Query** 클릭
2. `supabase-auth-trigger.sql` 파일의 내용 전체 복사
3. 붙여넣기
4. **Run** 버튼 클릭

### 3. 확인
```sql
-- Trigger가 생성되었는지 확인
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

**결과:**
```
trigger_name          | event_manipulation | event_object_table
---------------------+--------------------+-------------------
on_auth_user_created | INSERT             | users
```

---

## 작동 방식

```
사용자 회원가입 (Supabase Auth)
  ↓
auth.users 테이블에 INSERT
  ↓
Trigger 실행: on_auth_user_created
  ↓
Webhook 호출: /api/auth/webhook
  ↓
Tenant, User, TenantUser 자동 생성
  ↓
완료! 사용자가 독립적인 Tenant 보유
```

---

## 트러블슈팅

### 오류: `net.http_post` 함수를 찾을 수 없음
Supabase에서 HTTP Extension이 활성화되지 않은 경우:

1. SQL Editor에서 실행:
```sql
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
```

2. 또는 **Database → Extensions** 메뉴에서 `pg_net` 활성화

### 로컬 테스트
로컬 환경에서 테스트하려면:
1. `supabase-auth-trigger.sql` 파일의 `webhook_url` 수정:
```sql
webhook_url text := 'http://localhost:3000/api/auth/webhook';
```

2. ngrok 등으로 로컬 서버 외부 노출 필요

---

## 수동으로 테스트

API를 직접 호출해서 테스트:

```bash
curl -X POST https://echo-mail-blush.vercel.app/api/auth/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "record": {
      "id": "test-user-id",
      "email": "test@example.com",
      "raw_user_meta_data": {
        "company_name": "테스트 회사",
        "subdomain": "testcompany",
        "subscription_plan": "FREE_TRIAL",
        "full_name": "테스트 사용자",
        "role": "OWNER"
      }
    }
  }'
```

**성공 응답:**
```json
{
  "success": true,
  "data": {
    "tenantId": "...",
    "userId": "..."
  }
}
```

---

## 참고

- 이 Trigger는 **회원가입 시에만** 실행됩니다 (INSERT 이벤트)
- 기존 사용자는 영향받지 않습니다
- Tenant가 이미 있는 사용자는 중복 생성되지 않습니다
