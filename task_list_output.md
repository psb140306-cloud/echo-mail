# 📋 Echo Mail 개발 실행 계획 (SaaS 버전)

## 🎯 프로젝트 목표

발주 확인 자동 문자/카톡 발송 시스템을 **멀티테넌트 SaaS 서비스**로 구축

## 🛠 추천 기술 스택

- **Backend**: Node.js (Express.js) 또는 Python (FastAPI)
- **Database**: PostgreSQL (업체 정보 및 규칙 저장) + Row-Level Security
- **Cache**: Redis (메일 처리 상태 관리 + 사용량 추적)
- **Message Queue**: RabbitMQ 또는 Bull (비동기 알림 처리)
- **Frontend**: Next.js 14 + TypeScript (App Router)
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **Payment**: 토스페이먼츠 (정기 결제)
- **Email**: IMAP (node-imap 또는 imaplib)
- **SMS API**: 알리고, 솔루션링크, NCP SMS
- **Kakao API**: 카카오 비즈메시지 API
- **Scheduler**: node-cron 또는 APScheduler

## 📝 개발 작업 체크리스트

### 1. 프로젝트 초기 설정

- [x] **개발 환경 구성**
  - [x] Git 저장소 초기화
  - [x] .gitignore 파일 생성
  - [x] 프로젝트 구조 설계 및 폴더 생성
    - [x] app 디렉토리 구조 (Next.js 14 App Router)
    - [x] components 폴더 (shadcn/ui 컴포넌트)
    - [x] lib 폴더 (유틸리티 함수)
    - [x] hooks 폴더 (커스텀 훅)
    - [x] types 폴더 (TypeScript 타입 정의)
  - [x] README.md 작성
  - [x] 환경변수 관리 (.env 설정)
  - [x] Docker 설정 (docker-compose.yml)
  - [x] CI/CD 파이프라인 설정

- [x] **기술 스택 세팅**
  - [x] Backend 프레임워크 설치 (Express/FastAPI)
  - [x] 데이터베이스 설치 및 연결 설정
  - [x] Redis 설치 및 연결 설정
  - [x] 개발 도구 MCP 설치
    - [x] Context7 MCP 설치 (코드 분석용)
    - [x] GitHub MCP 설치 (저장소 관리용)
    - [x] .MCP.json 설정 파일 생성
  - [x] Message Queue 설치 (선택사항)
  - [x] Next.js 프로젝트 생성 (create-next-app)
  - [x] TypeScript 설정
  - [x] Tailwind CSS 설정
  - [x] shadcn MCP 설치 및 설정
  - [x] shadcn/ui 설치 및 설정
  - [x] ESLint, Prettier 설정
  - [x] Docker 환경 설정

### 2. 데이터베이스 설계 및 구축 (SaaS 확장)

- [x] **ERD 설계**
  - [x] 업체 정보 테이블 (companies)
  - [x] 담당자 정보 테이블 (contacts)
  - [x] 지역별 납품 규칙 테이블 (delivery_rules)
  - [x] 공휴일 관리 테이블 (holidays)
  - [x] 메일 수신 로그 테이블 (email_logs)
  - [x] 알림 발송 로그 테이블 (notification_logs)

- [x] **SaaS 멀티테넌시 스키마 확장**
  - [x] Tenant 모델 추가
    ```prisma
    model Tenant {
      id               String @id @default(cuid())
      name             String
      subdomain        String @unique
      customDomain     String?
      ownerId          String?
      subscriptionPlan SubscriptionPlan @default(FREE_TRIAL)
      subscriptionStatus SubscriptionStatus @default(TRIAL)
      trialEndsAt      DateTime
      maxCompanies     Int @default(10)
      maxContacts      Int @default(50)
      maxEmails        Int @default(500)
      maxNotifications Int @default(1000)
      createdAt        DateTime @default(now())
      updatedAt        DateTime @updatedAt
    }
    ```
  - [x] TenantUser 관계 모델 추가 (다대다 관계)
  - [x] TenantUserRole enum 추가 (OWNER, ADMIN, MANAGER, OPERATOR, VIEWER)
  - [x] TenantInvitation 모델 추가 (사용자 초대)
  - [x] Invoice 모델 추가 (인보이스 및 결제)
  - [x] 모든 기존 테이블에 tenantId 필드 추가
  - [x] Row-Level Security (RLS) 정책 생성
  - [x] 테넌트별 데이터 격리 검증

- [x] **Supabase MCP 연동**
  - [x] Supabase MCP 설치
  - [x] Supabase 프로젝트 생성
  - [x] .MCP.json에 Supabase 설정 추가
  - [x] 데이터베이스 스키마 동기화

- [x] **데이터베이스 구현**
  - [x] 마이그레이션 파일 생성
  - [x] 테이블 생성 스크립트 작성
  - [x] 인덱스 설정
  - [x] 외래키 제약조건 설정
  - [x] Seed 데이터 작성 (테스트용)
  - [x] 데이터베이스 연결 확인 및 테스트 데이터 추가

### 3. 인증 및 권한 시스템 (SaaS 필수)

- [x] **Supabase Auth 통합**
  - [x] 회원가입 플로우
    - [x] 이메일/비밀번호 가입 페이지
    - [x] 회사 정보 입력 단계
    - [x] 이메일 인증
    - [x] 온보딩 프로세스
  - [x] 로그인/로그아웃 구현
  - [x] 비밀번호 재설정 기능
  - [ ] 소셜 로그인 (Google, GitHub)
  - [ ] 세션 관리 및 리프레시 토큰

- [x] **역할 기반 접근 제어 (RBAC)**
  - [x] TenantUserRole 모델
    ```typescript
    enum TenantUserRole {
      OWNER     // 결제 관리, 테넌트 삭제 가능
      ADMIN     // 모든 설정 가능
      MANAGER   // 업체/담당자 관리
      OPERATOR  // 알림 발송만
      VIEWER    // 읽기 전용
    }
    ```
  - [x] 권한 체크 미들웨어
  - [x] 페이지별 접근 권한 설정
  - [x] API 엔드포인트별 권한 검증
  - [x] 역할별 UI 요소 표시/숨김

### 4. 멀티테넌시 API 구현

- [x] **테넌트 컨텍스트 관리**
  - [x] 테넌트 식별 미들웨어 (subdomain/custom domain)
  - [x] API 요청에 tenantId 자동 주입
  - [x] Cross-tenant 접근 방지
  - [x] 테넌트별 rate limiting

- [x] **기존 API 멀티테넌시 적용**
  - [x] 모든 쿼리에 tenantId 필터 추가
  - [x] Prisma 미들웨어로 자동 필터링
  - [x] 테넌트별 데이터 격리 테스트
  - [x] 성능 최적화 (인덱스, 쿼리 최적화)

### 5. 메일 수신 및 처리 시스템

- [x] **메일 서버 연동**
  - [x] IMAP 클라이언트 구현
  - [x] 메일 서버 연결 설정 (SSL/TLS)
  - [x] 인증 처리 구현
  - [x] 연결 풀 관리

- [x] **메일 모니터링**
  - [x] 실시간 메일 수신 리스너 구현
  - [x] 폴링 방식 백업 구현 (IMAP IDLE 미지원 서버용)
  - [x] 메일 파싱 모듈 개발
  - [x] 첨부파일 처리 로직

- [x] **메일 확인 옵션 구현**
  - [x] 단순 수신 확인 기능
  - [x] 제목/본문 키워드 매칭 기능
  - [x] 발주서 첨부파일 검증 기능
  - [x] 업체 이메일 매칭 로직

- [x] **SaaS 멀티테넌시 적용**
  - [x] 테넌트별 메일 계정 관리
  - [x] 테넌트별 메일 처리 큐
  - [x] 사용량 추적 (월별 메일 처리 수)

### 6. 업체 정보 관리 시스템

- [x] **백엔드 API 개발**
  - [x] 업체 CRUD API
    - [x] POST /api/companies (업체 생성)
    - [x] GET /api/companies (업체 목록 조회)
    - [x] GET /api/companies/:id (업체 상세 조회)
    - [x] PUT /api/companies/:id (업체 수정)
    - [x] DELETE /api/companies/:id (업체 삭제)
  - [x] 담당자 정보 관리 API
  - [x] 입력값 검증 미들웨어
  - [x] 에러 핸들링

- [x] **데이터 검증**
  - [x] 이메일 형식 검증
  - [x] 전화번호 형식 검증
  - [x] 중복 업체 확인
  - [x] 필수 필드 검증

- [x] **SaaS 제한 사항 적용**
  - [x] 플랜별 업체 수 제한 체크
  - [x] 플랜별 담당자 수 제한 체크
  - [x] 제한 초과 시 업그레이드 유도

### 7. 납품 일정 관리 시스템

- [x] **납품 규칙 설정**
  - [x] 지역별 납품 규칙 CRUD API
  - [x] 납기일 계산 로직 구현
  - [x] 오전/오후 구분 처리
  - [x] 지역-시간대 매핑

- [x] **공휴일 처리**
  - [x] 공휴일 API 연동 (한국 공공데이터)
  - [x] 공휴일 수동 관리 기능
  - [x] 주말 제외 로직
  - [x] 영업일 계산 함수
  - [x] 다음 영업일 자동 계산

### 8. 알림 발송 시스템

- [x] **SMS 발송 모듈**
  - [x] SMS API 선정 및 계정 생성
  - [x] SMS API 연동 모듈 개발
  - [x] 발송 템플릿 관리
  - [x] 발송 실패 시 재시도 로직
  - [x] 발송 결과 로깅

- [x] **카카오톡 발송 모듈**
  - [x] 카카오 비즈메시지 API 신청
  - [x] 알림톡 템플릿 등록
  - [x] API 연동 모듈 개발
  - [x] 친구톡/알림톡 구분 처리
  - [x] 발송 실패 시 SMS 폴백

- [x] **알림 발송 관리**
  - [x] 발송 큐 시스템 구현
  - [x] 비동기 발송 처리
  - [x] 발송 우선순위 관리
  - [x] 발송 제한 관리 (Rate limiting)
  - [x] 발송 내역 저장

- [x] **SaaS 사용량 추적**
  - [x] 테넌트별 발송 수 추적
  - [x] 플랜별 발송 제한 체크
  - [x] 초과 시 발송 차단
  - [x] 사용량 알림 (80%, 100%)

### 9. 구독 및 결제 시스템 (SaaS 핵심)

- [x] **구독 플랜 모델**
  - [x] Subscription 테이블 생성
  - [x] 플랜 정의 | 플랜 | 월 가격 | 업체 | 담당자 | 메일 | 알림 |
        |------|---------|------|--------|------|------| | 무료체험 | ₩0 (14일) | 10개 | 50명 |
        100건 | 100건 | | STARTER | ₩29,900 | 10개 | 50명 | 500건 | 500건 | | PROFESSIONAL | ₩79,900
        | 50개 | 300명 | 2,000건 | 2,000건 | | BUSINESS | ₩199,900 | 무제한 | 무제한 | 10,000건 |
        10,000건 | | ENTERPRISE | 별도 문의 | 무제한 | 무제한 | 무제한 | 무제한 |
  - [x] 플랜 변경 로직
  - [x] 무료 체험 기간 관리

- [x] **토스페이먼츠 통합**
  - [x] API 키 설정 및 환경 변수
  - [x] 결제 SDK 통합
  - [x] 정기 결제 (빌링키) 구현
  - [x] 결제 웹훅 처리
    - [x] 결제 성공
    - [x] 결제 실패
    - [x] 환불 처리
    - [x] 빌링키 생성/삭제
  - [x] 결제 실패 재시도 로직
  - [x] 구독 관리 서비스

- [ ] **인보이스 시스템**
  - [x] 인보이스 자동 생성
  - [x] 결제 정보 연동
  - [x] 인보이스 상태 관리
  - [ ] PDF 다운로드
  - [ ] 이메일 발송
  - [ ] 세금계산서 발행

### 10. 관리자 대시보드 (Frontend)

- [x] **UI/UX 설계**
  - [x] 와이어프레임 작성
  - [x] shadcn/ui 테마 커스터마이징 (Echo Mail 브랜드 컬러)
  - [x] 재사용 가능한 컴포넌트 설계 (ResponsiveGrid, MobileTable 등)
  - [x] App Router 구조 설계 (app/companies, app/settings 등)
  - [x] 레이아웃 컴포넌트 설계 (MobileHeader, MobileNav)

- [x] **퍼블릭 페이지 (SaaS)**
  - [x] 랜딩 페이지 (`/`)
    - [x] 히어로 섹션
    - [x] 주요 기능 소개 (3-4개)
    - [x] 요금제 미리보기
    - [x] 고객 후기
    - [x] FAQ
    - [x] CTA 버튼
  - [x] 요금제 페이지 (`/pricing`)
    - [x] 플랜 비교 테이블
    - [x] 기능 상세 설명
    - [x] FAQ
    - [x] 무료 체험 시작 버튼
  - [ ] 기능 소개 페이지 (`/features`)
  - [ ] 회사 소개 페이지 (`/about`)
  - [ ] 문의하기 페이지 (`/contact`)

- [x] **인증 페이지**
  - [x] 회원가입 (`/signup`)
    - [x] Step 1: 이메일/비밀번호
    - [x] Step 2: 회사 정보
    - [x] Step 3: 플랜 선택
    - [x] Step 4: 결제 정보
  - [x] 로그인 (`/login`)
  - [x] 비밀번호 재설정 (`/reset-password`)
  - [x] 이메일 인증 (`/verify-email`)

- [x] **테넌트 대시보드**
  - [x] 메인 대시보드 (`/dashboard`)
    - [x] 오늘의 통계
    - [x] 사용량 현황
    - [x] 최근 활동
    - [x] 빠른 작업
  - [x] 구독 관리 (`/settings/subscription`)
    - [x] 현재 플랜 정보
    - [x] 사용량 상세
    - [x] 플랜 업그레이드/다운그레이드
    - [x] 구독 취소
  - [ ] 결제 정보 (`/settings/billing`)
    - [ ] 결제 수단 관리
    - [ ] 결제 내역
    - [ ] 인보이스 다운로드
  - [ ] 팀 관리 (`/settings/team`)
    - [ ] 사용자 목록
    - [ ] 사용자 초대
    - [ ] 역할 관리
    - [ ] 활동 로그

- [ ] **업체 관리 화면**
  - [x] shadcn/ui Table 컴포넌트로 업체 목록 구현
  - [ ] 업체 등록 및 담당자 관리 UI
    - [x] 업체 목록 페이지 (`/companies`)
    - [x] 업체 등록 페이지 기본 구조 (`/companies/new`)
    - [ ] 업체 등록 시 담당자 정보 통합 입력
      - [ ] 담당자 이름, 전화번호 필수 입력
      - [ ] 이메일, 직책 선택 입력
      - [ ] SMS/카카오톡 알림 활성화 설정
    - [ ] 업체 상세 페이지 (`/companies/[id]`)
      - [ ] 업체 정보 표시 및 수정
      - [ ] 담당자 목록 표시
      - [ ] 담당자 추가/수정/삭제 기능
      - [ ] 발송 내역 조회
  - [x] AlertDialog로 업체 삭제 확인
  - [x] Input 컴포넌트로 검색 기능
  - [x] Pagination 컴포넌트 구현

- [x] **납품 규칙 관리 화면**
  - [x] Card 컴포넌트로 지역별 규칙 표시
  - [x] Dialog + Form으로 규칙 생성/수정
  - [x] 공휴일 관리 인터페이스
  - [x] 납기일 계산기 구현

- [x] **시스템 설정 화면**
  - [x] Tabs 컴포넌트로 설정 섹션 구분 (메일, SMS, 카카오톡, 시스템, 템플릿)
  - [x] Switch로 서비스 활성화/비활성화 설정
  - [x] Textarea로 알림 템플릿 편집
  - [x] Input + 연결 테스트로 API 키 관리
  - [x] Badge로 시스템 상태 표시

- [x] **로그 및 통계 화면**
  - [x] Table로 발송 내역 조회
  - [x] Recharts + Card로 발송 통계 차트 (Bar, Pie, Line Chart)
  - [x] Tabs로 통계/알림로그/시스템로그 구분
  - [x] 날짜 필터 및 검색 기능
  - [x] 반응형 Grid 레이아웃으로 대시보드 위젯 배치

- [x] **반응형 모바일 최적화**
  - [x] MobileHeader 및 MobileNav 컴포넌트
  - [x] ResponsiveGrid 및 MobileTable 컴포넌트
  - [x] 모든 화면의 모바일 반응형 대응

### 11. Super Admin 패널 (SaaS 운영)

- [x] **테넌트 관리**
  - [x] 전체 테넌트 목록 (`/super-admin/tenants`)
  - [x] 테넌트 상세 정보
  - [x] 테넌트 상태 관리 (활성/비활성/정지)
  - [x] 수동 플랜 조정
  - [x] 테넌트 삭제

- [x] **시스템 모니터링**
  - [x] 서버 상태 대시보드 (`/super-admin/monitoring`)
  - [x] 에러 로그 조회 (`/super-admin/logs`)
  - [x] 성능 메트릭 (`/super-admin/performance`)
  - [x] API 사용량 통계
  - [x] 알림 큐 상태

- [ ] **매출 분석**
  - [ ] MRR/ARR 대시보드 (`/admin/revenue`)
  - [ ] 플랜별 가입 현황
  - [ ] Churn rate 분석
  - [ ] 고객 LTV 분석
  - [ ] 결제 실패 현황

- [ ] **고객 지원**
  - [ ] 지원 티켓 관리
  - [ ] 공지사항 관리
  - [ ] 시스템 메시지 발송

### 12. 예외 처리 및 모니터링

- [x] **예외 처리 구현**
  - [x] 미등록 업체 처리 로직 (UnregisteredCompanyHandler)
    - [x] 이메일에서 업체 정보 자동 추출
    - [x] 자동 등록, 수동 검토, 차단 로직 구현
    - [x] 신뢰도 기반 처리 결정 시스템
    - [x] 관리자 승인/거부 인터페이스
  - [x] 메일 형식 오류 처리 (EmailFormatValidator)
    - [x] 포괄적인 이메일 검증 시스템
    - [x] 발신자, 제목, 내용, 첨부파일 검증
    - [x] 비즈니스 데이터 추출 및 신뢰도 계산
    - [x] 스팸 및 악성 콘텐츠 탐지
  - [x] 관리자 알림 시스템 (AdminNotificationSystem)
    - [x] 다채널 알림 지원 (이메일, Slack, SMS, 웹훅)
    - [x] 우선순위 기반 알림 라우팅
    - [x] 템플릿 기반 메시지 생성
    - [x] 쓰로틀링 및 에스컬레이션 로직
  - [x] 에러 분류 및 코드 정의 (EchoMailError)
    - [x] 50+ 구체적 에러 코드 정의
    - [x] 카테고리별 에러 분류 (시스템, 이메일, 업체, 배송, 알림 등)
    - [x] 심각도 기반 처리 전략
    - [x] 사용자 친화적 메시지 생성
  - [x] 전역 에러 핸들러 (GlobalErrorHandler)
    - [x] 자동 에러 수집 및 분류
    - [x] 메트릭 기반 에러 추적
    - [x] 자동 복구 로직
    - [x] Express/Next.js 미들웨어 지원

- [x] **모니터링 시스템**
  - [x] 로깅 시스템 구축 (Winston 기반 EchoMailLogger)
    - [x] 구조화된 JSON 로그 포맷
    - [x] 카테고리별 로그 분류
    - [x] 일별 로그 파일 로테이션
    - [x] 성능 측정 및 HTTP 요청 로깅
  - [x] 헬스체크 및 상태 모니터링
    - [x] 시스템 컴포넌트 상태 확인
    - [x] 외부 서비스 연결 상태 모니터링
    - [x] 실시간 상태 대시보드 연동
  - [x] 알림 발송 상태 모니터링
    - [x] SMS/카카오톡 발송 성공률 추적
    - [x] 큐 상태 실시간 모니터링
    - [x] 실패한 알림 자동 재시도 시스템
  - [x] 종합 모니터링 대시보드 통합
    - [x] 프론트엔드 로그 및 통계 화면
    - [x] 실시간 차트 및 메트릭 표시
    - [x] 필터링 및 검색 기능

- [ ] **SaaS 모니터링 추가**
  - [ ] 테넌트별 사용량 모니터링
  - [ ] 테넌트별 에러율 추적
  - [ ] 결제 실패 알림
  - [ ] 무료 체험 만료 알림

### 13. 자동화 시스템 (SaaS)

- [x] **사용량 추적**
  - [x] Redis 기반 실시간 카운터
  - [x] 월별 사용량 집계 배치
  - [x] 사용량 리포트 생성
  - [x] 사용량 초과 알림

- [ ] **자동화 작업**
  - [ ] 무료 체험 만료 처리
  - [ ] 결제 실패 후속 조치
  - [ ] 구독 갱신 처리
  - [ ] 테넌트 데이터 백업
  - [ ] 비활성 테넌트 정리

### 14. 테스트

- [x] **단위 테스트**
  - [x] 테스트 프레임워크 설정 (Jest + Testing Library)
  - [x] 메일 파싱 로직 테스트 (EmailFormatValidator - 29개 테스트 케이스)
  - [x] 미등록 업체 처리 로직 테스트 (UnregisteredCompanyHandler - 25개 테스트 케이스)
  - [x] 에러 관리 시스템 테스트 (EchoMailError - 20개 테스트 케이스)
  - [x] 납기일 계산 로직 테스트 (DeliveryDateCalculator - 28개 테스트 케이스)
  - [x] API 엔드포인트 테스트 (Companies API - 25개 테스트 케이스)
  - [x] 데이터 검증 테스트 (Validation System - 69개 테스트 케이스)

- [x] **SaaS 단위 테스트 추가**
  - [x] 멀티테넌시 격리 테스트
  - [x] 권한 시스템 테스트
  - [x] 구독 플랜 로직 테스트
  - [x] 사용량 제한 테스트

- [x] **통합 테스트**
  - [x] 메일 수신 → 알림 발송 플로우 테스트 (Email to Notification - 12개 시나리오)
  - [x] 데이터베이스 트랜잭션 테스트 (Database Transactions - 15개 시나리오)
  - [x] 외부 API 연동 테스트 (External APIs - 20개 시나리오)

- [ ] **SaaS 통합 테스트 추가**
  - [ ] 회원가입 → 구독 → 사용 전체 플로우
  - [ ] 결제 성공/실패 시나리오
  - [ ] 플랜 업그레이드/다운그레이드
  - [ ] 테넌트 간 데이터 격리

- [x] **E2E 테스트**
  - [x] 관리자 대시보드 시나리오 테스트 (Admin Dashboard - 8개 주요 시나리오 그룹, 30+ 테스트
        케이스)
  - [x] 업체 등록 → 메일 수신 → 알림 발송 전체 플로우 (Complete Workflow - 4개 주요 시나리오 그룹,
        15+ 테스트 케이스)

- [ ] **SaaS E2E 테스트 추가**
  - [ ] 랜딩 페이지 → 회원가입 → 온보딩
  - [ ] 구독 관리 시나리오
  - [ ] 팀 초대 및 권한 관리

- [x] **성능 테스트**
  - [x] 부하 테스트 (대량 메일 처리) - Bulk Email Processing (15개 시나리오, 메모리/성능 최적화)
  - [x] 동시성 테스트 (Concurrency Tests - 8개 시나리오 그룹, 부하/스트레스 테스트)
  - [x] 메모리 누수 테스트 (Memory Leak Detection - 6개 시나리오 그룹, 힙 분석)

- [ ] **SaaS 성능 테스트 추가**
  - [ ] 멀티테넌트 부하 테스트
  - [ ] 대규모 동시 접속 테스트
  - [ ] 데이터베이스 쿼리 성능 테스트

### 15. UI/UX 개선

- [x] **다크/라이트 모드 시스템**
  - [x] next-themes 패키지 설치
  - [x] ThemeProvider 컴포넌트 생성 및 적용
  - [x] 테마 토글 버튼 컴포넌트 개발
  - [x] 헤더에 테마 스위치 통합
  - [x] 다크 모드 스타일 테스트 및 조정
  - [x] 사용자 테마 선택 저장 기능

- [x] **접근성 개선**
  - [x] 색상 대비 검증
    - [x] 기존 디자인 WCAG AA 준수 (색상 조정 완료)
    - [x] 모던 디자인 색상 대비 검증 (90% → 100% 통과)
    - [x] Green-700 색상 개선 (3.30:1 → 4.75:1)
  - [x] 키보드 네비게이션 테스트
    - [x] Skip-to-main-content 링크 구현
    - [x] Focus-visible 스타일 전역 적용
    - [x] 키보드 네비게이션 유틸리티 (lib/accessibility/keyboard-navigation.ts)
  - [x] 스크린 리더 호환성 확인
    - [x] ARIA 레이블 적용 (mobile-nav.tsx 등)
    - [x] ARIA 헬퍼 함수 생성 (lib/accessibility/aria-labels.ts)
    - [x] 시맨틱 HTML 사용
  - [x] WCAG 2.1 AA 준수
    - [x] 색상 대비 4.5:1 이상 달성
    - [x] 접근성 체크리스트 작성 (scripts/accessibility-checklist.md)
    - [ ] 애니메이션 reduced-motion 지원 (권장사항)

- [x] **반응형 개선**
  - [x] 모바일 UI 최적화 (대시보드 카드 2x2 레이아웃)
  - [x] 터치 인터페이스 개선 (테마 토글 버튼)
  - [x] 다양한 화면 크기 테스트 (shadcn/ui 반응형 시스템)

### 16. 배포 및 운영

- [x] **로컬 테스트 (배포 전)**
  - [x] 의존성 설치 (`npm install`)
  - [x] 데이터베이스 설정 (`npm run db:generate`, `npm run db:migrate`)
  - [x] 개발 서버 구동 (`npm run dev`)
  - [x] 기본 기능 동작 확인
    - [x] 메인 페이지 로딩 테스트
    - [ ] 메일 모니터링 기능 테스트
    - [ ] SMS/카카오톡 발송 기능 테스트
    - [ ] 대시보드 및 설정 페이지 확인
  - [x] 빌드 및 품질 검사
    - [x] 타입 체크 (`npm run type-check`)
    - [x] 린트 검사 (`npm run lint`)
    - [x] 프로덕션 빌드 테스트 (`npm run build`)
    - [x] 단위 테스트 실행 (`npm run test`)

- [ ] **배포 준비**
  - [ ] Vercel MCP 설치 및 설정
  - [ ] .MCP.json에 Vercel 설정 추가
  - [ ] 프로덕션 환경 변수 설정
  - [ ] 데이터베이스 백업 전략
  - [ ] SSL 인증서 설정
  - [ ] 도메인 설정
    - [ ] 메인 도메인 (echomail.co.kr)
    - [ ] 와일드카드 서브도메인 (\*.echomail.co.kr)
    - [ ] 커스텀 도메인 지원

- [ ] **배포**
  - [ ] Vercel 프로덕션 배포
  - [ ] 데이터베이스 마이그레이션
  - [ ] Redis 클러스터 설정
  - [ ] CDN 설정
  - [ ] 무중단 배포 설정

- [ ] **운영 준비**
  - [ ] 운영 매뉴얼 작성
  - [ ] 관리자 교육 자료 작성
  - [ ] 백업/복구 절차 문서화
  - [ ] 장애 대응 프로세스 수립
  - [ ] 24/7 모니터링 설정

### 17. 문서화

- [ ] **기술 문서**
  - [ ] API 명세서 작성 (Swagger/OpenAPI)
  - [ ] 데이터베이스 스키마 문서
  - [ ] 아키텍처 다이어그램
  - [ ] 시퀀스 다이어그램
  - [ ] SaaS 멀티테넌시 가이드

- [ ] **사용자 문서**
  - [ ] 사용자 가이드
  - [ ] 관리자 가이드
  - [ ] API 개발자 가이드
  - [ ] FAQ 문서
  - [ ] 트러블슈팅 가이드

- [ ] **마케팅 자료**
  - [ ] 제품 소개서
  - [ ] 요금제 비교표
  - [ ] 사례 연구
  - [ ] 백서

## 📊 예상 일정

### 기존 시스템 개발 (완료)

- 프로젝트 초기 설정: 2일 ✅
- 데이터베이스 설계 및 구축: 3일 ✅
- 메일 수신 시스템: 5일 ✅
- 업체 관리 시스템: 3일 ✅
- 납품 일정 관리: 3일 ✅
- 알림 발송 시스템: 5일 ✅
- 관리자 대시보드: 7일 ✅
- 예외 처리 및 모니터링: 3일 ✅
- 테스트: 5일 ✅

### SaaS 전환 (신규)

- Phase 1: 멀티테넌시 기반 구축: 2주
  - 데이터베이스 스키마 확장: 3일
  - 테넌트 컨텍스트 관리: 2일
  - API 멀티테넌시 적용: 5일
- Phase 2: 인증 및 권한 시스템: 1주
  - Supabase Auth 통합: 3일
  - RBAC 구현: 2일
- Phase 3: 구독 및 결제 시스템: 2주
  - 구독 모델 구현: 3일
  - 토스페이먼츠 통합: 4일
  - 사용량 추적: 3일
- Phase 4: 사용자 인터페이스: 2주
  - 퍼블릭 페이지: 4일
  - 테넌트 대시보드: 6일
- Phase 5: 운영 도구 및 테스트: 1주
  - Super Admin 패널: 3일
  - 추가 테스트: 2일

**기존 개발 완료: 약 36일** **SaaS 전환 예상: 약 8주 (56일)** **총 프로젝트 기간: 약 92일 (13주)**

## 🚀 MVP 우선순위 (SaaS)

### 즉시 실행 가능 (1주차)

1. Tenant 모델 추가 및 마이그레이션
2. 모든 테이블에 tenantId 추가
3. 테넌트 컨텍스트 미들웨어
4. 회원가입/로그인 페이지

### 핵심 기능 (2-3주차)

5. Supabase Auth 통합
6. 기본 RBAC 구현
7. 구독 플랜 모델
8. 사용량 추적 시스템

### 결제 및 구독 (4-5주차)

9. 토스페이먼츠 통합
10. 정기 결제 구현
11. 플랜 업그레이드/다운그레이드
12. 인보이스 시스템

### UI/UX (6-7주차)

13. 랜딩 페이지
14. 요금제 페이지
15. 테넌트 대시보드
16. 구독 관리 UI

### 고도화 (8주차)

17. Super Admin 패널
18. 자동화 시스템
19. 고급 모니터링
20. 성능 최적화

## 💰 예상 비용 및 수익

### 인프라 비용 (월간)

- Supabase Pro: $25/월
- Vercel Pro: $20/월
- Redis Cloud: $10/월
- 도메인/SSL: $15/월
- 결제 수수료: 매출의 3.2%
- SMS/카톡 API: 사용량 기반 (건당 ₩20-50)
- **총 고정비: 약 $70/월 (₩91,000)**

### 수익 모델

- **목표**:
  - 3개월: 20개 회사 (베타)
  - 6개월: 50개 회사
  - 12개월: 100개 회사
- **평균 구독료**: ₩79,900/월
- **예상 월 매출** (12개월 후): ₩7,990,000
- **예상 순이익**: ₩5,593,000 (순이익률 70%)

### 주요 KPI

- **CAC** (Customer Acquisition Cost): ₩200,000 이하
- **LTV** (Lifetime Value): ₩2,000,000 이상
- **Churn Rate**: 월 5% 이하
- **MRR** (Monthly Recurring Revenue):
  - 3개월: ₩1,598,000
  - 6개월: ₩3,995,000
  - 12개월: ₩7,990,000

## ⚠️ 리스크 관리 (SaaS)

### 기술적 리스크

- **데이터 유출**:
  - 철저한 테넌트 격리
  - 정기 보안 감사
  - 펜테스트 실시
- **성능 저하**:
  - 테넌트별 리소스 제한
  - 자동 스케일링
  - 데이터베이스 인덱싱
- **결제 실패**:
  - 다중 재시도 로직
  - 대체 결제 수단
  - 고객 알림 시스템
- **서비스 중단**:
  - 고가용성 아키텍처
  - 실시간 모니터링
  - 자동 장애 조치

### 사업적 리스크

- **낮은 전환율**:
  - 14일 무료 체험
  - 온보딩 최적화
  - 고객 성공 프로그램
- **높은 이탈률**:
  - 정기 피드백 수집
  - 기능 지속 개선
  - 고객 지원 강화
- **경쟁사**:
  - 차별화된 기능
  - 우수한 UX
  - 합리적인 가격
- **규제 변화**:
  - GDPR 준수
  - 개인정보보호법 준수
  - 정기 법률 검토

## 📈 성장 전략

### 단기 (3개월)

- 베타 테스터 20개 회사 확보
- 제품-시장 적합성 검증
- 초기 피드백 반영
- 핵심 기능 안정화

### 중기 (6개월)

- 정식 런칭
- 콘텐츠 마케팅 (블로그, 사례 연구)
- 유료 광고 캠페인
- 파트너십 구축

### 장기 (12개월)

- 100개 이상 고객 확보
- 추가 기능 개발 (AI 기반 예측)
- API 오픈 및 생태계 구축
- 시리즈 A 투자 유치 검토

## 🎯 성공 기준

### 제품 지표

- 시스템 가용성: 99.9% 이상
- 평균 응답 시간: 200ms 이하
- 동시 접속자: 1,000명 이상 처리
- 버그 발생률: 월 10건 이하

### 비즈니스 지표

- MRR: ₩10,000,000 달성
- 유료 고객: 100개 이상
- NPS: 50 이상
- 고객 만족도: 90% 이상

### 운영 지표

- 고객 문의 응답: 24시간 이내
- 버그 수정: 48시간 이내
- 기능 배포: 2주 스프린트
- 다운타임: 월 1시간 이하
