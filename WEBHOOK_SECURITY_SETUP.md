# Supabase 웹훅 보안 설정 가이드

## 🔒 보안 문제

현재 `/api/auth/webhook` 엔드포인트에 인증이 추가되어, 누구나 임의로 테넌트를 생성할 수 없도록 보호되었습니다.

## 📋 설정 방법

### 1단계: 웹훅 비밀 키 생성

강력한 랜덤 문자열을 생성합니다:

```bash
# macOS/Linux
openssl rand -base64 32

# Windows PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2단계: Vercel 환경 변수 설정

1. Vercel 대시보드 접속
2. 프로젝트 선택 → Settings → Environment Variables
3. 새 환경 변수 추가:
   - **Name**: `SUPABASE_WEBHOOK_SECRET`
   - **Value**: (1단계에서 생성한 비밀 키)
   - **Environments**: Production, Preview, Development 모두 선택

4. 저장 후 재배포

### 3단계: Supabase 웹훅 설정

1. Supabase 대시보드 접속
2. Authentication → Webhooks 메뉴
3. "Create a new hook" 클릭
4. 설정:
   - **Name**: Auth Webhook
   - **Events**: `INSERT` on `auth.users` table 선택
   - **URL**: `https://your-domain.vercel.app/api/auth/webhook`
   - **Method**: POST
   - **HTTP Headers** 추가:
     ```
     Authorization: Bearer <여기에 SUPABASE_WEBHOOK_SECRET 값 입력>
     ```

5. "Create webhook" 클릭

### 4단계: 테스트

새로운 사용자로 회원가입을 시도하고, Vercel 로그에서 다음을 확인:

**성공 케이스:**
```
Auth webhook received { type: 'INSERT', email: 'test@example.com' }
Tenant and user created successfully
```

**실패 케이스 (인증 없음):**
```
Webhook authentication failed: Missing authorization header
```

## 🛡️ 보안 강화 사항

✅ **완료된 개선사항:**
- Webhook에 Bearer 토큰 인증 추가
- 잘못된 요청 IP 로깅
- 비밀 키 미설정 시 503 에러 반환

⚠️ **추가 권장사항:**
- 웹훅 비밀 키를 정기적으로 교체 (3~6개월)
- Vercel 로그에서 실패한 인증 시도 모니터링
- Rate limiting 추가 고려

## 📝 참고사항

- 웹훅 비밀 키는 절대 Git에 커밋하지 마세요
- Vercel 환경 변수에만 저장하세요
- 팀원과 공유 시 안전한 방법(1Password, Vault 등) 사용

## 🔗 관련 파일

- `app/api/auth/webhook/route.ts` - 웹훅 엔드포인트 (인증 로직 포함)
- `.env.example` - 환경 변수 예제
