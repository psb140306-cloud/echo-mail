# 📧 Echo Mail

발주 확인 자동 문자/카톡 발송 시스템

## 📋 프로젝트 개요

Echo Mail은 업체에서 보내는 발주 메일을 자동으로 감지하여 SMS/카카오톡으로 접수 확인 및 납품 일정을
알림으로 발송하는 시스템입니다. 불필요한 확인 전화를 줄이고 업무 효율성을 향상시키는 것이
목표입니다.

## 🎯 주요 기능

- **자동 메일 감지**: 등록된 업체의 발주 메일 자동 수신 및 확인
- **스마트 알림**: SMS/카카오톡을 통한 발주 접수 확인 및 납품 일정 알림
- **업체 관리**: 업체 정보, 담당자, 연락처 통합 관리
- **납품 일정 관리**: 지역별 납품 규칙 및 공휴일을 고려한 자동 납기일 계산
- **관리자 대시보드**: 웹 기반 관리 인터페이스

## 🛠 기술 스택

### Frontend

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **Charts**: Recharts

### Backend

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Queue**: Bull (비동기 알림 처리)

### External APIs

- **Email**: IMAP 프로토콜
- **SMS**: 알리고/솔루션링크/NCP SMS
- **KakaoTalk**: 카카오 비즈메시지 API
- **Holidays**: 한국 공공데이터 공휴일 API

### MCP 서버

- **GitHub MCP**: 저장소 관리 및 CI/CD 자동화
- **Context7 MCP**: 코드 분석 및 컨텍스트 관리
- **Supabase MCP**: 백엔드 서비스 연동
- **Vercel MCP**: 배포 자동화
- **shadcn MCP**: UI 컴포넌트 자동 관리

## 📁 프로젝트 구조

```
Echo Mail/
├── app/                 # Next.js 14 App Router
│   ├── (dashboard)/     # 대시보드 레이아웃 그룹
│   ├── api/            # API 라우트
│   └── globals.css     # 전역 스타일
├── components/         # shadcn/ui 컴포넌트
│   ├── ui/            # 기본 UI 컴포넌트
│   └── custom/        # 커스텀 컴포넌트
├── lib/               # 유틸리티 함수
│   ├── utils.ts       # 공통 유틸리티
│   ├── db.ts          # 데이터베이스 연결
│   └── validations.ts # 데이터 검증
├── hooks/             # 커스텀 React 훅
├── types/             # TypeScript 타입 정의
└── docs/              # 프로젝트 문서
```

## 🚀 시작하기

### 필수 요구사항

- Node.js 18.0+
- PostgreSQL 13+
- Redis 6+
- npm 또는 yarn

### 설치

```bash
# 저장소 클론
git clone <repository-url>
cd echo-mail

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 필요한 환경변수 설정

# MCP 서버 설정 (선택사항)
# .MCP.json 파일에서 필요한 MCP 서버 활성화

# 데이터베이스 마이그레이션
npm run db:migrate

# 개발 서버 실행
npm run dev
```

### 환경변수

```env
# 애플리케이션
NODE_ENV=production
APP_NAME="Echo Mail"
APP_URL=https://echo-mail-production.up.railway.app

# 데이터베이스 (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres.xxx:password@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&statement_cache_size=0"
DATABASE_URL_DIRECT="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# SMS API (SOLAPI)
SMS_PROVIDER="solapi"
SOLAPI_API_KEY="your-solapi-api-key"
SOLAPI_API_SECRET="your-solapi-api-secret"
SOLAPI_SENDER_PHONE="010-0000-0000"
SOLAPI_KAKAO_PFID=""  # 카카오 비즈니스 채널 pfId (선택)

# 실제 알림 발송 활성화
ENABLE_REAL_NOTIFICATIONS=true  # false면 테스트 모드

# Redis (선택사항 - 캐싱 기능)
REDIS_URL="redis://localhost:6379"

# MCP 서버 설정 (선택)
GITHUB_TOKEN="your-github-token"
VERCEL_TOKEN="your-vercel-token"
```

#### 주요 환경변수 설명

- **NODE_ENV**: 환경 모드 (`development`, `production`)
- **DATABASE_URL**: Supabase pooling connection (세션 모드)
- **DATABASE_URL_DIRECT**: Supabase direct connection (마이그레이션용)
- **ENABLE_REAL_NOTIFICATIONS**: `true`로 설정하면 실제 SMS/카카오톡 발송
- **REDIS_URL**: (선택) Redis 캐싱 활성화
- **SMS_PROVIDER**: 사용할 SMS 프로바이더 (`solapi`, `aligo`, `ncp` 중 선택)

## 🚢 배포

### Railway 배포 (프로덕션)

Echo Mail은 Railway에 Docker 컨테이너로 배포됩니다.

**배포 URL**: https://echo-mail-production.up.railway.app

#### Railway 환경변수 설정

Railway 대시보드에서 다음 환경변수를 추가:

**필수 환경변수:**
1. `NODE_ENV=production`
2. `DATABASE_URL` (Supabase pooling)
3. `DATABASE_URL_DIRECT` (Supabase direct)
4. `NEXT_PUBLIC_SUPABASE_URL`
5. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. `SUPABASE_SERVICE_ROLE_KEY`
7. `SOLAPI_API_KEY`
8. `SOLAPI_API_SECRET`
9. `SOLAPI_SENDER_PHONE`
10. `ENABLE_REAL_NOTIFICATIONS=true`

**선택 환경변수:**
- `REDIS_URL` (Redis 플러그인 추가 시 자동 설정)

#### 배포 프로세스

1. **GitHub Push**: 코드를 main 브랜치에 푸시
2. **자동 빌드**: Railway가 Dockerfile을 감지하고 자동 빌드
3. **Docker 이미지**: Alpine Linux 3.19 + Node.js 18 + Prisma
4. **배포 완료**: 약 2분 소요
5. **스케줄러 시작**: node-cron이 자동으로 초기화됨

#### 기술 스택 (Railway)

- **Base Image**: node:18-alpine3.19
- **Build Tool**: Docker multi-stage build
- **Database**: Supabase PostgreSQL
- **Scheduler**: node-cron (내부 스케줄러)
- **Port**: 8080

#### Railway 설정

**Networking:**
- Public Domain: `echo-mail-production.up.railway.app`
- Private Network: `echo-mail.railway.internal`

**Build:**
- Dockerfile 자동 감지
- Standalone Next.js output
- Prisma Client 자동 생성

### Vercel 배포 (개발/스테이징)

개발 및 스테이징 환경은 Vercel에 배포됩니다.

**Vercel 환경변수:**
위의 필수 환경변수와 동일하게 설정

**주의사항:**
- Vercel Cron은 제한적이므로 Railway를 프로덕션으로 사용
- 메일 스케줄러는 Railway에서만 완전히 작동

## 🔧 MCP 서버 설정

Echo Mail 프로젝트는 개발 효율성을 높이기 위해 여러 MCP(Model Context Protocol) 서버를 단계별로
사용합니다.

### 설정 파일

MCP 서버 설정은 `.MCP.json` 파일에서 중앙 관리됩니다.

```json
{
  "servers": {
    "github": { "enabled": true, "installed": true },
    "context7": { "enabled": true, "installed": true },
    "supabase": { "enabled": false, "installed": false },
    "vercel": { "enabled": false, "installed": false },
    "shadcn": { "enabled": true, "installed": true }
  }
}
```

### 단계별 설치

1. **초기 설정**: GitHub MCP, Context7 MCP
2. **프론트엔드**: shadcn MCP
3. **데이터베이스**: Supabase MCP
4. **배포**: Vercel MCP

## 📊 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 서버 실행
npm start

# 린트 검사
npm run lint

# 타입 검사
npm run type-check

# 테스트 실행
npm test

# 데이터베이스 마이그레이션
npm run db:migrate

# 데이터베이스 시드
npm run db:seed
```

## 🎯 목표 성과

- 업체 담당자의 발주 확인 전화 **90% 이상 감소**
- 알림 발송 성공률 **99% 이상**
- 관리자 작업 처리 시간 **1분 이내**

## 📝 개발 상태

현재 개발 중인 프로젝트입니다. 자세한 개발 진행 상황은
[task_list_output.md](./task_list_output.md)를 참고하세요.

## 📚 문서

- [PRD (Product Requirements Document)](./Echo_Mail_PRD.md)
- [개발 작업 목록](./task_list_output.md)
- [클로드 코드 가이드](./CLAUDE.md)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참고하세요.

---

⚡ **Echo Mail** - 효율적인 발주 관리를 위한 스마트 알림 시스템
