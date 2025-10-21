# Supabase Auth 테스트 사용자 생성 가이드

## 문제
이 프로젝트는 Supabase Auth를 사용하는데, 직접 users 테이블에 추가한 계정은 Supabase Auth에 등록되지 않아 로그인할 수 없습니다.

## 해결 방법

### 방법 1: Supabase Dashboard에서 직접 생성 (추천)

1. **Supabase Dashboard** 접속
2. **Authentication** → **Users** 메뉴로 이동
3. **Add user** 버튼 클릭
4. 사용자 정보 입력:
   - **Email**: `test@echomail.com`
   - **Password**: `test123!`
   - **Auto Confirm User**: ✅ 체크 (이메일 인증 건너뛰기)
5. **Create user** 클릭

### 방법 2: SQL로 Supabase Auth 사용자 생성

Supabase SQL Editor에서 실행:

```sql
-- Supabase Auth에 사용자 추가
-- 주의: 이 방법은 Supabase의 내부 스키마에 직접 접근하므로 권장하지 않습니다
-- Dashboard에서 생성하는 것을 권장합니다
```

### 방법 3: 회원가입 페이지에서 직접 가입

1. https://echo-mail-blush.vercel.app/auth/signup 접속
2. `test@echomail.com`으로 회원가입
3. 이메일 인증 링크 클릭

## 생성 후 확인

### 1. Supabase Dashboard에서 확인
- Authentication → Users에서 `test@echomail.com` 확인
- Email Confirmed 상태가 ✅ 인지 확인

### 2. 로그인 테스트
- https://echo-mail-blush.vercel.app/auth/login
- Email: `test@echomail.com`
- Password: `test123!`

## 추가 설정 (필요 시)

Supabase Auth 사용자 생성 후, Prisma users 테이블과 연동하려면:

```sql
-- Supabase Auth UUID와 Prisma users 테이블 연동
-- (이미 Prisma에 사용자가 있다면 UPDATE, 없다면 INSERT)

-- 1. Supabase Auth에서 사용자 UUID 확인
SELECT id, email FROM auth.users WHERE email = 'test@echomail.com';

-- 2. 해당 UUID를 사용해 Prisma users 테이블 업데이트
-- (필요한 경우에만)
```

## 중요 참고 사항

- **Supabase Auth**와 **Prisma users 테이블**은 별개입니다
- 로그인은 Supabase Auth를 통해 이루어집니다
- Prisma users 테이블은 추가 사용자 정보 저장용입니다
- 두 시스템을 연동하려면 Auth hooks나 triggers를 사용해야 합니다
