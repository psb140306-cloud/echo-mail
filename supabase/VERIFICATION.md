# Supabase 보안 마이그레이션 검증 가이드

## 수정 완료 사항

### 1. 트리거 파일 (01_create_tenant_trigger.sql)

**수정 내용**:
- ✅ `NEW.id::text` - UUID를 TEXT로 명시적 캐스팅
- ✅ `joinedAt` → `invitedAt`, `acceptedAt`로 변경 (스키마와 일치)

**근거**:
```sql
-- Prisma migration에서 확인한 실제 컬럼 타입
ALTER TABLE "tenants" ADD COLUMN "ownerId" TEXT  -- TEXT 타입
CREATE TABLE "tenant_members" ("userId" TEXT)     -- TEXT 타입

-- Supabase auth.users.id는 UUID 타입
-- 따라서 명시적 캐스팅 필요: NEW.id::text
```

### 2. RLS 정책 파일 (02_enable_rls_policies.sql)

**수정 내용**:
- ✅ 모든 `auth.uid()`에 `::text` 캐스팅 추가
- ✅ 테이블명을 소문자로 수정 (tenants, tenant_members 등)

**근거**:
```sql
-- auth.uid()는 UUID를 반환
-- 데이터베이스 컬럼은 TEXT 타입
-- 비교 시 타입 불일치 에러 발생: ERROR: operator does not exist: text = uuid
-- 해결: auth.uid()::text로 명시적 캐스팅
```

## 배포 전 체크리스트

### 1. 파일 검증

```bash
# 1. 트리거 파일 검증
grep "NEW.id::text" supabase/migrations/01_create_tenant_trigger.sql
# 결과: 2개 라인 (ownerId, userId)

# 2. RLS 파일 검증
grep "auth.uid()::text" supabase/migrations/02_enable_rls_policies.sql
# 결과: 9개 라인

# 3. 잘못된 컬럼명 체크
grep "joinedAt" supabase/migrations/01_create_tenant_trigger.sql
# 결과: 0개 (없어야 정상)
```

### 2. Supabase SQL Editor 배포 순서

#### 1단계: 트리거 배포
```sql
-- supabase/migrations/01_create_tenant_trigger.sql 전체 복사
-- Supabase SQL Editor에 붙여넣기
-- Run 클릭
-- ✅ "Success. No rows returned" 확인
```

#### 2단계: RLS 정책 배포
```sql
-- supabase/migrations/02_enable_rls_policies.sql 전체 복사
-- Supabase SQL Editor에 붙여넣기
-- Run 클릭
-- ✅ "Success" 확인
```

### 3. 배포 후 검증 쿼리

```sql
-- 1. 트리거 존재 확인
SELECT
  tgname,
  tgenabled,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';
-- 예상 결과: 1개 행 (on_auth_user_created, true, handle_new_user)

-- 2. RLS 활성화 확인
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'tenant_members', 'companies', 'contacts')
ORDER BY tablename;
-- 예상 결과: 모든 테이블 rls_enabled = true

-- 3. 정책 개수 확인
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
-- 예상 결과: 각 테이블마다 2-3개의 정책

-- 4. 헬퍼 함수 확인
SELECT
  proname,
  prorettype::regtype as return_type,
  prosecdef as security_definer
FROM pg_proc
WHERE proname = 'get_user_tenant_id';
-- 예상 결과: 1개 행 (get_user_tenant_id, text, true)
```

### 4. 실제 테스트

#### 테스트 1: 트리거 작동 확인
```sql
-- 테스트 사용자 생성 (Supabase Auth UI 사용)
-- 1. 시크릿 창에서 앱 접속
-- 2. 새 이메일로 회원가입
-- 3. 이메일 인증 완료
-- 4. 아래 쿼리로 테넌트 생성 확인

SELECT
  u.id as user_id,
  u.email,
  t.id as tenant_id,
  t.name,
  tm.role,
  tm.status
FROM auth.users u
LEFT JOIN tenants t ON t."ownerId" = u.id::text
LEFT JOIN tenant_members tm ON tm."userId" = u.id::text
WHERE u.email = 'YOUR_TEST_EMAIL'
ORDER BY u.created_at DESC
LIMIT 1;

-- 예상 결과:
-- tenant_id: NOT NULL
-- role: OWNER
-- status: ACTIVE
```

#### 테스트 2: RLS 격리 확인
```sql
-- 사용자 A로 로그인 → 업체 등록
-- 사용자 B로 로그인 → 업체 등록
-- 각 사용자는 자신의 업체만 보여야 함

-- 관리자로 확인:
SELECT
  t.name as tenant_name,
  t."ownerEmail",
  COUNT(c.id) as company_count
FROM tenants t
LEFT JOIN companies c ON c."tenantId" = t.id
GROUP BY t.id, t.name, t."ownerEmail"
ORDER BY t."createdAt" DESC;

-- 각 테넌트별로 회사가 분리되어야 함
```

## 문제 해결

### 문제 1: "operator does not exist: text = uuid"
**원인**: auth.uid()를 TEXT 컬럼과 직접 비교
**해결**: auth.uid()::text로 캐스팅
**상태**: ✅ 수정 완료

### 문제 2: "column joinedAt does not exist"
**원인**: 스키마에 없는 컬럼 사용
**해결**: invitedAt, acceptedAt 사용
**상태**: ✅ 수정 완료

### 문제 3: "relation public.Tenant does not exist"
**원인**: 테이블명 대소문자 불일치
**해결**: 소문자 테이블명 사용 (tenants, tenant_members)
**상태**: ✅ 수정 완료

## 롤백 방법

문제 발생 시:

```sql
-- 1. 트리거 제거
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. RLS 비활성화
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) ||
                ' DISABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- 3. 정책 제거
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) ||
                ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 4. 헬퍼 함수 제거
DROP FUNCTION IF EXISTS public.get_user_tenant_id();
```

## 최종 확인

- [ ] 01_create_tenant_trigger.sql 파일에 `NEW.id::text` 2곳 확인
- [ ] 01_create_tenant_trigger.sql 파일에 `joinedAt` 없음 확인
- [ ] 02_enable_rls_policies.sql 파일에 `auth.uid()::text` 확인
- [ ] 02_enable_rls_policies.sql 파일에 소문자 테이블명 사용 확인
- [ ] Supabase SQL Editor에서 배포
- [ ] 트리거 작동 테스트
- [ ] RLS 격리 테스트
- [ ] 프로덕션 배포

## 요약

**근본 원인**: PostgreSQL의 타입 시스템 - UUID vs TEXT 불일치

**근본 해결**: 명시적 타입 캐스팅
- Supabase `auth.uid()` → UUID
- Prisma String 타입 → TEXT
- 해결: `::text` 캐스팅

**부수적 문제**:
- 잘못된 컬럼명 (joinedAt)
- 대소문자 불일치 (Tenant vs tenants)

**모두 수정 완료** ✅
