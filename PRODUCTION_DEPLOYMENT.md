# 🚀 Echo Mail 프로덕션 배포 가이드

## 목차
1. [사전 준비사항](#사전-준비사항)
2. [환경변수 설정](#환경변수-설정)
3. [데이터베이스 설정](#데이터베이스-설정)
4. [Vercel 배포](#vercel-배포)
5. [배포 후 확인사항](#배포-후-확인사항)
6. [모니터링 설정](#모니터링-설정)
7. [롤백 절차](#롤백-절차)

---

## 사전 준비사항

### 1. 필수 서비스 계정
- ✅ **GitHub** 계정 (저장소 관리)
- ✅ **Vercel** 계정 (프론트엔드 배포)
- ✅ **Supabase** 계정 (PostgreSQL 데이터베이스)
- ✅ **토스페이먼츠** 계정 (결제 시스템)
- ⬜ **Upstash** 또는 **Redis Cloud** (Redis 호스팅)
- ⬜ **SMS API** 제공업체 (알리고/솔루션링크/NCP)
- ⬜ **카카오 비즈니스** 계정 (알림톡)

### 2. 로컬 빌드 테스트
```bash
# 의존성 설치
npm install

# 타입 체크
npm run type-check

# 린트 검사
npm run lint

# 프로덕션 빌드
npm run build

# 빌드 결과 확인
npm run start
```

---

## 환경변수 설정

### 1. Vercel 환경변수 설정

Vercel 대시보드에서 다음 환경변수를 설정합니다:

#### 필수 환경변수
```env
# 애플리케이션
NODE_ENV=production
APP_NAME=Echo Mail
APP_URL=https://your-domain.com

# 데이터베이스 (Supabase)
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis (Upstash)
REDIS_URL=redis://...
REDIS_PASSWORD=xxx

# 인증
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=xxx (32자 이상)
JWT_SECRET=xxx

# 토스페이먼츠
TOSS_CLIENT_KEY=live_ck_...
TOSS_SECRET_KEY=live_sk_...
TOSS_WEBHOOK_SECRET=xxx
```

#### 선택적 환경변수 (기능별)
```env
# SMS (알리고)
SMS_PROVIDER=aligo
ALIGO_API_KEY=xxx
ALIGO_USER_ID=xxx
ALIGO_SENDER=010-xxxx-xxxx

# 카카오톡
KAKAO_API_KEY=xxx
KAKAO_SENDER_KEY=xxx

# 모니터링
SENTRY_DSN=https://...
LOG_LEVEL=info
```

### 2. 환경변수 그룹별 설정

**Production 환경:**
- `NODE_ENV=production`
- `USE_MOCK_DATA=false`
- `ENABLE_REAL_NOTIFICATIONS=true`

**Preview 환경 (Staging):**
- `NODE_ENV=staging`
- `USE_MOCK_DATA=false`
- `ENABLE_REAL_NOTIFICATIONS=false`

**Development 환경:**
- `.env.local` 파일 사용
- Mock 데이터 사용 가능

---

## 데이터베이스 설정

### 1. Supabase 프로젝트 생성

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 새 프로젝트 생성
3. PostgreSQL 버전: 15.x
4. 리전: `Northeast Asia (Seoul)` 권장

### 2. 데이터베이스 마이그레이션

```bash
# Prisma 스키마 적용
npx prisma migrate deploy

# 또는 Prisma 클라이언트 생성
npx prisma generate
```

### 3. Row-Level Security (RLS) 설정

Supabase SQL Editor에서 실행:

```sql
-- 모든 테이블에 RLS 활성화
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 테넌트별 데이터 격리 정책
CREATE POLICY tenant_isolation_policy ON companies
  USING (tenant_id = current_setting('app.current_tenant_id')::text);

-- 추가 정책들...
```

### 4. 초기 데이터 시딩 (선택사항)

```bash
# Seed 스크립트 실행
npm run db:seed

# 또는 수동으로 SQL 실행
psql $DATABASE_URL -f prisma/seed.sql
```

---

## Vercel 배포

### 1. Vercel CLI 설치 및 로그인

```bash
npm i -g vercel
vercel login
```

### 2. 프로젝트 연결

```bash
# Vercel 프로젝트 연결
vercel link

# 환경변수 설정 확인
vercel env ls
```

### 3. 배포 실행

```bash
# Preview 배포 (테스트)
vercel

# Production 배포
vercel --prod
```

### 4. 도메인 설정

1. Vercel Dashboard → Settings → Domains
2. 커스텀 도메인 추가: `echomail.co.kr`
3. DNS 레코드 설정:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

### 5. 서브도메인 와일드카드 설정 (멀티테넌시)

```
Type: CNAME
Name: *
Value: cname.vercel-dns.com
```

---

## 배포 후 확인사항

### 1. 헬스체크

```bash
# 헬스체크 엔드포인트 호출
curl https://your-domain.com/api/health

# 예상 응답
{
  "status": "healthy",
  "timestamp": "2025-01-11T...",
  "services": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

### 2. 주요 기능 테스트

- [ ] 회원가입 및 로그인
- [ ] 테넌트 생성
- [ ] 구독 플랜 선택
- [ ] 업체 등록
- [ ] 알림 발송 (테스트 모드)
- [ ] 결제 플로우 (테스트 결제)

### 3. 성능 확인

```bash
# Lighthouse 점수 확인
npx lighthouse https://your-domain.com --view

# 목표:
# - Performance: 90+
# - Accessibility: 95+
# - Best Practices: 95+
# - SEO: 90+
```

### 4. 보안 점수 확인

```bash
# Security Headers 확인
curl -I https://your-domain.com

# 필수 헤더:
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - Strict-Transport-Security
# - Content-Security-Policy
```

---

## 모니터링 설정

### 1. Vercel Analytics

```bash
# package.json에 추가
npm install @vercel/analytics

# app/layout.tsx에 추가
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### 2. Sentry 에러 추적

```bash
npm install @sentry/nextjs

# Sentry 초기화
npx @sentry/wizard@latest -i nextjs
```

### 3. Uptime Monitoring

- [UptimeRobot](https://uptimerobot.com) 설정
- 체크 간격: 5분
- 알림: 이메일, Slack

---

## 롤백 절차

### 긴급 롤백

```bash
# Vercel Dashboard에서 이전 배포로 롤백
# 또는 CLI 사용
vercel rollback [deployment-url]
```

### 데이터베이스 롤백

```bash
# Prisma 마이그레이션 롤백
npx prisma migrate resolve --rolled-back [migration-name]

# 백업에서 복구
pg_restore -d $DATABASE_URL backup.dump
```

---

## 체크리스트

### 배포 전
- [ ] 모든 테스트 통과 확인
- [ ] 프로덕션 빌드 성공
- [ ] 환경변수 모두 설정
- [ ] 데이터베이스 백업 완료
- [ ] DNS 레코드 준비

### 배포 중
- [ ] Vercel 배포 성공
- [ ] 도메인 연결 확인
- [ ] SSL 인증서 발급 확인
- [ ] 헬스체크 통과

### 배포 후
- [ ] 주요 기능 테스트
- [ ] 성능 지표 확인
- [ ] 에러 모니터링 활성화
- [ ] 팀에 배포 완료 공지
- [ ] 사용자 피드백 수집 준비

---

## 지원 및 문의

- **기술 문의**: tech@echomail.co.kr
- **긴급 장애**: +82-10-xxxx-xxxx
- **문서**: https://docs.echomail.co.kr

---

**마지막 업데이트**: 2025-01-11
**작성자**: Echo Mail 개발팀
