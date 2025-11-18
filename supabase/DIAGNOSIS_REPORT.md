# 대시보드 작동하지 않음 - 원인 진단 보고서

## 실행 날짜
2025-11-18

## 문제 현상
- SQL 마이그레이션 실행 완료 (트리거 + RLS 정책)
- 사용자: park8374@gmail.com 로그인 성공
- 대시보드 페이지: 데이터 표시 안됨 (빈 화면)

---

## 진단 결과: 3가지 가능한 원인

### 🔴 **원인 1: 기존 사용자의 Tenant가 생성되지 않음 (가능성 90%)**

#### 설명:
`park8374@gmail.com`은 트리거 배포 **이전**에 생성된 사용자입니다.

**타임라인:**
```
1. 2025-11-XX: park8374@gmail.com 회원가입
   → auth.users에 사용자 생성
   → 트리거가 없어서 tenant 생성 안됨

2. 2025-11-18: 트리거 배포
   → on_auth_user_created 트리거 생성
   → AFTER INSERT ON auth.users
   → ⚠️ 기존 사용자는 영향 없음 (INSERT 이벤트가 아님)

3. 현재: 로그인 시도
   → TenantContext가 tenantId 찾지 못함
   → API 요청 401 에러
   → 대시보드 빈 화면
```

#### 검증 방법:
```sql
-- 진단 쿼리 1: park8374@gmail.com의 tenant 존재 여부
SELECT
  u.id as user_id,
  u.email,
  u.created_at as user_created,
  t.id as tenant_id,
  t.name as tenant_name,
  tm.id as member_id,
  tm.role,
  tm.status
FROM auth.users u
LEFT JOIN tenants t ON t."ownerId" = u.id::text
LEFT JOIN tenant_members tm ON tm."userId" = u.id::text
WHERE u.email = 'park8374@gmail.com';
```

**예상 결과:**
- `tenant_id`: **NULL** (테넌트 없음)
- `member_id`: **NULL** (멤버십 없음)

#### 증거:
[app/dashboard/page.tsx:127-137](c:\startcoding\Echo Mail\app\dashboard\page.tsx#L127-L137)
```typescript
// ✅ CRITICAL: 테넌트 확인 - 없으면 에러
const companiesCheckRes = await fetch('/api/companies?limit=1')
if (companiesCheckRes.status === 401) {
  // 테넌트 없음 - 에러 표시하고 로그아웃
  toast({
    title: '계정 설정 오류',
    description: '테넌트가 생성되지 않았습니다. 다시 로그인해주세요.',
    variant: 'destructive',
  })
  await signOut()
  return
}
```

[app/api/companies/route.ts:38-49](c:\startcoding\Echo Mail\app\api\companies\route.ts#L38-L49)
```typescript
// CRITICAL: Get tenantId for multi-tenancy isolation
const tenantContext = TenantContext.getInstance()
const tenantId = tenantContext.getTenantId()

if (!tenantId) {
  return NextResponse.json(
    {
      success: false,
      error: 'Tenant context not found',
    },
    { status: 401 }
  )
}
```

[lib/middleware/tenant-context.ts:242-260](c:\startcoding\Echo Mail\lib\middleware\tenant-context.ts#L242-L260)
```typescript
// 사용자의 멤버십에서 tenantId 가져오기
const membership = await prisma.tenantMember.findFirst({
  where: {
    userId: user.id,
    status: 'ACTIVE',
  },
  include: {
    tenant: true,
  },
})

if (membership) {
  userTenantId = membership.tenantId
  logger.debug('User membership found', {
    userId: user.id,
    tenantId: userTenantId,
    role: membership.role,
  })
}
```

**결론:**
- `park8374@gmail.com` → auth.users에만 존재
- tenants 테이블에 해당 사용자의 tenant 없음
- tenant_members 테이블에 멤버십 없음
- API가 401 반환 → 대시보드 빈 화면

---

### 🟡 **원인 2: RLS 정책이 애플리케이션 코드를 차단함 (가능성 5%)**

#### 설명:
애플리케이션은 **Prisma Client**로 데이터베이스에 접근합니다.
Prisma는 기본적으로 **connection pooling**을 사용하며, 연결이 **service_role** 수준으로 작동할 수 있습니다.

하지만 RLS 정책은 **authenticated role**을 기준으로 작성되었습니다.

#### 확인 필요 사항:

**1. Prisma 연결 문자열 확인:**
```env
# DATABASE_URL이 service_role 키를 사용하는가?
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?pgbouncer=true"
```

**2. Supabase Direct URL vs Pooling URL:**
```env
# Next.js는 어떤 URL을 사용하는가?
DATABASE_URL="postgres://..."        # Supabase Pooler (RLS 영향)
DIRECT_URL="postgres://..."          # Direct Connection (service_role)
```

**3. RLS 정책에서 service_role 허용 확인:**
[supabase/migrations/02_enable_rls_policies.sql:65-68](c:\startcoding\Echo Mail\supabase\migrations\02_enable_rls_policies.sql#L65-L68)
```sql
CREATE POLICY "Service role full access on tenants"
  ON public.tenants
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
```

- ✅ 모든 테이블에 `service_role` full access 정책 있음
- ✅ Prisma는 일반적으로 service_role로 연결됨

**결론:** RLS가 애플리케이션을 차단할 가능성은 **낮음** (5%)

---

### 🟢 **원인 3: 트리거가 실행되지 않음 (가능성 5%)**

#### 설명:
트리거는 정상 배포되었지만, **활성화되지 않았거나** 함수에 **권한 문제**가 있을 수 있습니다.

#### 검증 방법:
```sql
-- 진단 쿼리 2: 트리거 존재 및 활성화 상태 확인
SELECT
  tgname as trigger_name,
  tgenabled as is_enabled,
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';
```

**예상 결과:**
- `is_enabled`: **O** (활성화됨)
- `is_security_definer`: **true** (권한 상승)

#### 추가 확인:
```sql
-- 진단 쿼리 3: 최근 가입한 사용자들의 tenant 생성 여부
SELECT
  u.email,
  u.created_at as user_created,
  t.id as has_tenant,
  tm.id as has_membership
FROM auth.users u
LEFT JOIN tenants t ON t."ownerId" = u.id::text
LEFT JOIN tenant_members tm ON tm."userId" = u.id::text
WHERE u.created_at > NOW() - INTERVAL '7 days'
ORDER BY u.created_at DESC;
```

**만약:**
- 최근 7일 가입자 중 tenant가 **없는 사용자가 여러 명**이면 → 트리거 문제
- 최근 가입자는 tenant가 **있는데** park8374만 없으면 → 원인 1 확정

---

## 진단 순서 (실행 가이드)

### Step 1: 사용자 상태 확인 (가장 먼저)
```sql
-- Supabase SQL Editor에서 실행
SELECT
  u.id, u.email, u.created_at,
  t.id as tenant_id,
  tm.id as member_id
FROM auth.users u
LEFT JOIN tenants t ON t."ownerId" = u.id::text
LEFT JOIN tenant_members tm ON tm."userId" = u.id::text
WHERE u.email = 'park8374@gmail.com';
```

**결과 해석:**
- `tenant_id = NULL` → **원인 1 확정** (기존 사용자 tenant 미생성)
- `tenant_id != NULL` → Step 2로 이동

---

### Step 2: 트리거 상태 확인
```sql
SELECT tgname, tgenabled, proname
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';
```

**결과 해석:**
- 결과 없음 → 트리거 배포 실패
- `tgenabled = O` → 트리거 정상 (Step 3으로)
- `tgenabled != O` → 트리거 비활성화됨

---

### Step 3: 최근 가입자 확인
```sql
SELECT u.email, u.created_at, t.id as tenant_id
FROM auth.users u
LEFT JOIN tenants t ON t."ownerId" = u.id::text
WHERE u.created_at > NOW() - INTERVAL '7 days'
ORDER BY u.created_at DESC;
```

**결과 해석:**
- 최근 가입자 **모두** tenant 없음 → **원인 3** (트리거 작동 안함)
- 최근 가입자는 있는데 park8374만 없음 → **원인 1** 확정

---

### Step 4: RLS 정책 확인
```sql
-- RLS 활성화 여부
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'tenant_members')
ORDER BY tablename;

-- 정책 개수 확인
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'tenant_members')
GROUP BY tablename;
```

**예상 결과:**
- `rowsecurity = true` (양쪽 모두)
- `policy_count >= 3` (각 테이블)

---

## 최종 판단 로직

```
IF (Step 1: tenant_id = NULL for park8374@gmail.com)
  → 원인 1: 기존 사용자 tenant 미생성
  → 해결: 수동으로 tenant 생성 필요

ELSE IF (Step 3: 최근 가입자도 tenant 없음)
  → 원인 3: 트리거 작동 안함
  → 해결: 트리거 재배포 또는 함수 권한 수정

ELSE
  → 원인 2: RLS 또는 애플리케이션 연결 문제
  → 해결: DATABASE_URL 확인, service_role 정책 검증
```

---

## 추천 진단 순서 (한 번에 실행)

아래 SQL을 **Supabase SQL Editor**에서 한 번에 실행하세요:

```sql
-- ============================================
-- 통합 진단 쿼리 (한 번에 실행)
-- ============================================

-- 1. 특정 사용자 상태 (park8374@gmail.com)
SELECT
  '1. Park User Status' as check_name,
  u.id as user_id,
  u.email,
  u.created_at as user_created,
  t.id as tenant_id,
  t.name as tenant_name,
  tm.id as member_id,
  tm.role,
  tm.status
FROM auth.users u
LEFT JOIN tenants t ON t."ownerId" = u.id::text
LEFT JOIN tenant_members tm ON tm."userId" = u.id::text
WHERE u.email = 'park8374@gmail.com';

-- 2. 트리거 존재 확인
SELECT
  '2. Trigger Status' as check_name,
  tgname as trigger_name,
  tgenabled as is_enabled,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- 3. 최근 7일 가입자 tenant 상태
SELECT
  '3. Recent Users' as check_name,
  u.email,
  u.created_at as user_created,
  CASE WHEN t.id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_tenant,
  CASE WHEN tm.id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_membership
FROM auth.users u
LEFT JOIN tenants t ON t."ownerId" = u.id::text
LEFT JOIN tenant_members tm ON tm."userId" = u.id::text
WHERE u.created_at > NOW() - INTERVAL '7 days'
ORDER BY u.created_at DESC;

-- 4. RLS 상태 확인
SELECT
  '4. RLS Status' as check_name,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'tenant_members')
ORDER BY tablename;

-- 5. 정책 개수 확인
SELECT
  '5. Policy Count' as check_name,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'tenant_members')
GROUP BY tablename;
```

---

## 결과 예시 및 해석

### 예시 1: 원인 1 확정 (기존 사용자 tenant 미생성)
```
1. Park User Status:
   email: park8374@gmail.com
   user_created: 2025-11-15
   tenant_id: NULL  ← 🚨 문제!
   member_id: NULL  ← 🚨 문제!

2. Trigger Status:
   trigger_name: on_auth_user_created
   is_enabled: O  ← 정상

3. Recent Users:
   (최근 가입자 없음, 또는 최근 가입자는 tenant 있음)
```

**진단:** park8374@gmail.com은 트리거 배포 전에 가입 → tenant 수동 생성 필요

---

### 예시 2: 원인 3 (트리거 작동 안함)
```
1. Park User Status:
   tenant_id: NULL

2. Trigger Status:
   trigger_name: on_auth_user_created
   is_enabled: O

3. Recent Users:
   email: newuser@test.com
   user_created: 2025-11-18 (트리거 배포 후)
   has_tenant: NO  ← 🚨 문제!
```

**진단:** 트리거가 배포되었지만 실행 안됨 → 함수 권한 또는 구문 오류

---

## 다음 단계

이 진단 쿼리를 실행하고 결과를 공유해주시면:
1. 정확한 원인을 확정할 수 있습니다
2. 원인별 해결 방법을 제시할 수 있습니다
3. 수동 tenant 생성 스크립트를 제공할 수 있습니다

**현재 90% 확신하는 원인:** 기존 사용자의 tenant가 생성되지 않음 (원인 1)
