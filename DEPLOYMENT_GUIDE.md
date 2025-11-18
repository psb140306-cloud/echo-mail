# Supabase 보안 배포 가이드

## 개요

이 가이드는 Echo Mail의 근본적인 보안 문제를 해결하기 위한 Supabase 데이터베이스 트리거 및 RLS 정책 배포 방법을 설명합니다.

## 해결하는 문제

### 현재 문제점
1. ❌ 신규 회원 가입 시 테넌트 미생성 (지속적인 문제 발생)
2. ❌ 테넌트 미생성 시 타 회원의 대시보드 정보 노출 (심각한 보안 문제)
3. ❌ 14개 테이블에 권한 설정 없음 (Supabase에서 "Unrestricted"로 표시)
4. ❌ 애플리케이션 코드에만 의존하는 보안 (코드 버그 시 데이터 노출)

### 해결 방법
1. ✅ **데이터베이스 트리거**: 회원 가입 시 자동으로 테넌트 생성
2. ✅ **RLS 정책**: 14개 모든 테이블에 Row Level Security 적용
3. ✅ **다층 방어**: 애플리케이션 + 데이터베이스 이중 보안

---

## 배포 방법

### 방법 1: Supabase 대시보드 (권장)

이 방법이 가장 안전하고 확인하기 쉽습니다.

#### 1단계: Supabase 대시보드 접속

1. https://supabase.com 로그인
2. Echo Mail 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭

#### 2단계: 테넌트 자동 생성 트리거 배포

1. SQL Editor에서 **New query** 클릭
2. `supabase/migrations/01_create_tenant_trigger.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭 (또는 Ctrl+Enter)
5. 성공 메시지 확인: "Success. No rows returned"

**확인**:
```sql
-- 트리거가 생성되었는지 확인
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```
결과: 1개 행이 반환되어야 함

#### 3단계: RLS 정책 배포

1. SQL Editor에서 **New query** 클릭
2. `supabase/migrations/02_enable_rls_policies.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭
5. 성공 메시지 확인

**확인**:
```sql
-- 모든 테이블에 RLS가 활성화되었는지 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
모든 테이블의 `rowsecurity`가 `true`여야 함

---

### 방법 2: Supabase CLI

터미널에서 명령어로 배포하는 방법입니다.

```bash
# 1. Supabase CLI 설치 (이미 설치되어 있으면 생략)
npm install -g supabase

# 2. Supabase 로그인
supabase login

# 3. 프로젝트 링크 (프로젝트 ID는 Supabase 대시보드에서 확인)
supabase link --project-ref YOUR_PROJECT_REF

# 4. 마이그레이션 배포
cd supabase
supabase db push --include-all
```

---

## 배포 후 테스트

### 1. 트리거 테스트

#### 테스트 사용자 생성
1. 시크릿 창에서 앱 접속
2. 새 이메일로 회원가입 (예: `test-$(date +%s)@example.com`)
3. 이메일 인증 완료
4. 대시보드 접속

#### 테넌트 자동 생성 확인
```sql
-- Supabase SQL Editor에서 실행
SELECT
  u.id as user_id,
  u.email,
  t.id as tenant_id,
  t.name as tenant_name,
  tm.role,
  tm.status
FROM auth.users u
LEFT JOIN "Tenant" t ON t."ownerId" = u.id
LEFT JOIN "TenantMember" tm ON tm."userId" = u.id AND tm."tenantId" = t.id
WHERE u.email = 'YOUR_TEST_EMAIL'
ORDER BY u.created_at DESC;
```

**기대 결과**:
- `tenant_id`가 NULL이 아니어야 함
- `role`이 'OWNER'여야 함
- `status`가 'ACTIVE'여야 함

### 2. RLS 테스트

#### 테넌트 간 데이터 격리 확인

1. **테스트 사용자 A로 로그인**
2. 업체 1개 등록 (예: "테스트 업체 A")
3. 로그아웃

4. **테스트 사용자 B로 로그인**
5. 업체 1개 등록 (예: "테스트 업체 B")
6. 대시보드 확인 → "테스트 업체 B"만 보여야 함 ✅
7. API 직접 호출해도 "테스트 업체 A"는 안 보여야 함 ✅

#### SQL로 확인
```sql
-- 각 테넌트의 업체 수 확인
SELECT
  t.name as tenant_name,
  t."ownerEmail",
  COUNT(c.id) as company_count
FROM "Tenant" t
LEFT JOIN "Company" c ON c."tenantId" = t.id
GROUP BY t.id, t.name, t."ownerEmail"
ORDER BY t."createdAt" DESC;
```

### 3. 보안 테스트

#### 테넌트 없는 사용자 확인 (0명이어야 함)
```sql
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN "Tenant" t ON t."ownerId" = u.id
WHERE t.id IS NULL
  AND u.created_at > NOW() - INTERVAL '1 day';
```

**기대 결과**: 0 rows (빈 결과)

#### RLS 비활성화된 테이블 확인 (0개여야 함)
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%';
```

**기대 결과**: 0 rows (빈 결과)

---

## 문제 해결

### 트리거가 작동하지 않는 경우

```sql
-- 1. 트리거 존재 여부 확인
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- 2. 함수 존재 여부 확인
SELECT * FROM pg_proc WHERE proname = 'handle_new_user';

-- 3. 트리거 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- 그 다음 01_create_tenant_trigger.sql 다시 실행
```

### RLS 정책 충돌 시

```sql
-- 기존 정책 모두 삭제 후 재생성
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "Users can view their tenant''s data" ON ' ||
                quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 그 다음 02_enable_rls_policies.sql 다시 실행
```

### 기존 사용자에게 문제 발생 시

```sql
-- 모든 사용자의 테넌트 상태 확인
SELECT
  u.id,
  u.email,
  u.created_at,
  t.id as tenant_id,
  tm.role,
  tm.status
FROM auth.users u
LEFT JOIN "Tenant" t ON t."ownerId" = u.id
LEFT JOIN "TenantMember" tm ON tm."userId" = u.id
ORDER BY u.created_at DESC
LIMIT 50;

-- 테넌트 없는 사용자에게 수동으로 생성
-- scripts/fix-user-exssuda.ts 참고
```

---

## 롤백 방법

만약 문제가 발생하면 다음과 같이 롤백할 수 있습니다.

```sql
-- 1. RLS 비활성화
ALTER TABLE public."Tenant" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."TenantMember" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Company" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Contact" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."EmailAccount" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."EmailLog" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationLog" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."DeliveryRule" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Holiday" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."MessageTemplate" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."TenantInvitation" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Subscription" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invoice" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."SystemConfig" DISABLE ROW LEVEL SECURITY;

-- 2. 트리거 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. 함수 삭제
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.get_user_tenant_id();
```

---

## 배포 체크리스트

### 배포 전
- [ ] 프로덕션 데이터베이스 백업 완료
- [ ] SQL 파일 검토 완료
- [ ] 스테이징 환경에서 테스트 완료 (선택사항)
- [ ] 롤백 계획 준비 완료

### 배포 중
- [ ] `01_create_tenant_trigger.sql` 실행
- [ ] 트리거 생성 확인
- [ ] `02_enable_rls_policies.sql` 실행
- [ ] RLS 활성화 확인

### 배포 후
- [ ] 새 사용자로 회원가입 테스트
- [ ] 테넌트 자동 생성 확인
- [ ] 기존 사용자 로그인 테스트
- [ ] 테넌트 간 데이터 격리 확인
- [ ] 테넌트 없는 사용자 0명 확인
- [ ] 로그 모니터링 (1시간)

---

## 배포 후 권장사항

### 즉시 수행
1. ✅ 새 사용자 회원가입 테스트 (3명 이상)
2. ✅ 기존 사용자 로그인 테스트
3. ✅ 모니터링 대시보드 확인

### 1주일 내 수행
4. 애플리케이션 코드의 중복 로직 제거 고려
   - `app/auth/callback/route.ts`의 테넌트 생성 로직 (백업으로 유지 가능)
   - `app/api/auth/setup-account/route.ts`의 테넌트 생성 로직 (백업으로 유지 가능)

5. Soft Delete 구현 (GDPR 준수)
   ```sql
   ALTER TABLE "Tenant" ADD COLUMN "deletedAt" TIMESTAMP;
   ALTER TABLE "Tenant" ADD COLUMN "deleteReason" TEXT;
   ```

6. 감사 로그 추가 (SOC 2 준수)

### 1개월 내 수행
7. 외부 보안 감사 진행
8. 침투 테스트 진행
9. Rate Limiting 추가

---

## 모니터링

### 일일 확인 (자동화 권장)

```sql
-- 1. 테넌트 없는 사용자 (0명이어야 함)
SELECT COUNT(*) as users_without_tenant
FROM auth.users u
LEFT JOIN "Tenant" t ON t."ownerId" = u.id
WHERE t.id IS NULL;

-- 2. 오늘 생성된 테넌트 수
SELECT COUNT(*) as new_tenants_today
FROM "Tenant"
WHERE "createdAt" >= CURRENT_DATE;

-- 3. RLS 상태 (모두 true여야 함)
SELECT
  COUNT(*) as total_tables,
  COUNT(*) FILTER (WHERE rowsecurity = true) as rls_enabled_tables
FROM pg_tables
WHERE schemaname = 'public';
```

### PostgreSQL 로그 모니터링

Supabase Dashboard → Logs → PostgreSQL Logs 에서 검색:
- "Failed to create tenant for user" → 트리거 실패 (즉시 조사 필요)
- "permission denied" → RLS 정책 문제 (정상적일 수 있음)

---

## FAQ

### Q: 기존 사용자에게 영향이 있나요?
**A**: 없습니다. RLS 정책은 테넌트가 있는 사용자에게는 투명하게 작동합니다.

### Q: 성능에 영향이 있나요?
**A**: 미미합니다. RLS는 WHERE 조건을 추가하는 것과 동일하며, 인덱스가 있으면 성능 영향이 거의 없습니다.

### Q: 트리거가 실패하면 회원가입도 실패하나요?
**A**: 아니요. 트리거는 `EXCEPTION` 핸들러로 에러를 잡아서 경고만 로깅하고 회원가입은 계속 진행됩니다.

### Q: 애플리케이션 코드의 테넌트 생성 로직을 삭제해야 하나요?
**A**: 아니요. 백업으로 유지하는 것을 권장합니다. 다층 방어 전략입니다.

### Q: Vercel에 다시 배포해야 하나요?
**A**: 아니요. 이 변경사항은 데이터베이스 수준이므로 Vercel 배포 없이 즉시 적용됩니다.

---

## 지원

문제가 발생하면:

1. **Supabase 로그 확인**: Dashboard → Logs → PostgreSQL Logs
2. **테넌트 상태 확인**: 위의 SQL 쿼리 실행
3. **롤백 고려**: 심각한 문제 시 위의 롤백 방법 사용
4. **이슈 보고**: GitHub 이슈 생성 또는 개발팀에 연락

---

## 결론

이 배포는 Echo Mail의 **가장 중요한 보안 업데이트**입니다.

**배포 전**:
- 🔴 사용자가 타인의 데이터를 볼 수 있음
- 🔴 테넌트 생성이 불안정함
- 🔴 서비스 출시 불가능

**배포 후**:
- ✅ 데이터베이스 수준의 완벽한 격리
- ✅ 테넌트 자동 생성 보장
- ✅ 서비스 출시 가능 🚀

**권장사항**: 가능한 빨리 배포하세요. 배포하지 않는 것이 배포하는 것보다 훨씬 위험합니다.
