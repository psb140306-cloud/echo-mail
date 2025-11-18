# Supabase 보안 배포 빠른 시작 가이드

## 5분 안에 배포하기

### 1. Supabase 대시보드 접속
1. https://supabase.com 로그인
2. Echo Mail 프로젝트 선택
3. **SQL Editor** 클릭

### 2. 트리거 배포 (2분)
1. **New query** 클릭
2. `supabase/migrations/01_create_tenant_trigger.sql` 전체 복사
3. 붙여넣기 → **Run** 클릭
4. ✅ "Success. No rows returned" 확인

### 3. RLS 정책 배포 (2분)
1. **New query** 클릭
2. `supabase/migrations/02_enable_rls_policies.sql` 전체 복사
3. 붙여넣기 → **Run** 클릭
4. ✅ "Success" 확인

### 4. 확인 (1분)
```sql
-- 트리거 확인
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- 결과: 1개 행

-- RLS 확인
SELECT COUNT(*) FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
-- 결과: 14
```

### 5. 테스트
1. 시크릿 창에서 새 사용자로 회원가입
2. 대시보드 접속 확인
3. 완료! 🎉

---

## 배포 확인 체크리스트

- [ ] 트리거 생성 확인 (1개 행)
- [ ] RLS 활성화 확인 (14개 테이블)
- [ ] 새 사용자 회원가입 테스트
- [ ] 테넌트 자동 생성 확인
- [ ] 기존 사용자 로그인 테스트

---

## 문제 발생 시

### 사용자에게 테넌트가 없다면?
```sql
-- 사용자 확인
SELECT u.id, u.email, t.id as tenant_id
FROM auth.users u
LEFT JOIN "Tenant" t ON t."ownerId" = u.id
WHERE u.email = 'USER_EMAIL';

-- 수동 생성 (필요시)
-- scripts/fix-user-exssuda.ts 참고
```

### 롤백이 필요하다면?
```sql
-- RLS 비활성화
ALTER TABLE public."Tenant" DISABLE ROW LEVEL SECURITY;
-- (다른 테이블도 동일하게)

-- 트리거 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

---

## 더 자세한 정보

- 전체 가이드: `DEPLOYMENT_GUIDE.md`
- 보안 분석: `SECURITY_ANALYSIS.md`
- 사용법: `supabase/README.md`

---

## 결과

**Before**: 🔴 사용자가 타인의 데이터 볼 수 있음
**After**: ✅ 완벽한 테넌트 격리

배포하지 않는 것이 배포하는 것보다 위험합니다. 지금 바로 배포하세요!
