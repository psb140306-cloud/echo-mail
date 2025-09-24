# 📋 Echo Mail 개발 실행 계획

## 🎯 프로젝트 목표

발주 확인 자동 문자/카톡 발송 시스템 구축을 통한 업무 효율성 향상

## 🛠 추천 기술 스택

- **Backend**: Node.js (Express.js) 또는 Python (FastAPI)
- **Database**: PostgreSQL (업체 정보 및 규칙 저장)
- **Cache**: Redis (메일 처리 상태 관리)
- **Message Queue**: RabbitMQ 또는 Bull (비동기 알림 처리)
- **Frontend**: Next.js 14 + TypeScript (App Router)
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
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

- [ ] **기술 스택 세팅**
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

### 2. 데이터베이스 설계 및 구축

- [x] **ERD 설계**
  - [x] 업체 정보 테이블 (companies)
  - [x] 담당자 정보 테이블 (contacts)
  - [x] 지역별 납품 규칙 테이블 (delivery_rules)
  - [x] 공휴일 관리 테이블 (holidays)
  - [x] 메일 수신 로그 테이블 (email_logs)
  - [x] 알림 발송 로그 테이블 (notification_logs)

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

### 3. 메일 수신 및 처리 시스템

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

### 4. 업체 정보 관리 시스템

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

### 5. 납품 일정 관리 시스템

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

### 6. 알림 발송 시스템

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

### 7. 관리자 대시보드 (Frontend)

- [x] **UI/UX 설계**
  - [x] 와이어프레임 작성
  - [x] shadcn/ui 테마 커스터마이징 (Echo Mail 브랜드 컬러)
  - [x] 재사용 가능한 컴포넌트 설계 (ResponsiveGrid, MobileTable 등)
  - [x] App Router 구조 설계 (app/companies, app/settings 등)
  - [x] 레이아웃 컴포넌트 설계 (MobileHeader, MobileNav)

- [x] **업체 관리 화면**
  - [x] shadcn/ui Table 컴포넌트로 업체 목록 구현
  - [x] 업체 CRUD 인터페이스 구현
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

### 8. 예외 처리 및 모니터링

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

### 9. 테스트

- [x] **단위 테스트**
  - [x] 테스트 프레임워크 설정 (Jest + Testing Library)
  - [x] 메일 파싱 로직 테스트 (EmailFormatValidator - 29개 테스트 케이스)
  - [x] 미등록 업체 처리 로직 테스트 (UnregisteredCompanyHandler - 25개 테스트 케이스)
  - [x] 에러 관리 시스템 테스트 (EchoMailError - 20개 테스트 케이스)
  - [x] 납기일 계산 로직 테스트 (DeliveryDateCalculator - 28개 테스트 케이스)
  - [x] API 엔드포인트 테스트 (Companies API - 25개 테스트 케이스)
  - [x] 데이터 검증 테스트 (Validation System - 69개 테스트 케이스)

- [x] **통합 테스트**
  - [x] 메일 수신 → 알림 발송 플로우 테스트 (Email to Notification - 12개 시나리오)
  - [x] 데이터베이스 트랜잭션 테스트 (Database Transactions - 15개 시나리오)
  - [x] 외부 API 연동 테스트 (External APIs - 20개 시나리오)

- [x] **E2E 테스트**
  - [x] 관리자 대시보드 시나리오 테스트 (Admin Dashboard - 8개 주요 시나리오 그룹, 30+ 테스트 케이스)
  - [x] 업체 등록 → 메일 수신 → 알림 발송 전체 플로우 (Complete Workflow - 4개 주요 시나리오 그룹, 15+ 테스트 케이스)

- [x] **성능 테스트**
  - [x] 부하 테스트 (대량 메일 처리) - Bulk Email Processing (15개 시나리오, 메모리/성능 최적화)
  - [x] 동시성 테스트 (Concurrency Tests - 8개 시나리오 그룹, 부하/스트레스 테스트)
  - [x] 메모리 누수 테스트 (Memory Leak Detection - 6개 시나리오 그룹, 힙 분석)

### 10. 배포 및 운영

- [ ] **배포 준비**
  - [ ] Vercel MCP 설치 및 설정
  - [ ] .MCP.json에 Vercel 설정 추가
  - [ ] 프로덕션 환경 변수 설정
  - [ ] 데이터베이스 백업 전략
  - [ ] SSL 인증서 설정
  - [ ] 도메인 설정

- [ ] **배포**
  - [ ] 서버 환경 구성 (AWS/NCP/온프레미스)
  - [ ] 컨테이너 이미지 빌드
  - [ ] 배포 스크립트 작성
  - [ ] 롤백 전략 수립
  - [ ] 무중단 배포 설정

- [ ] **운영 준비**
  - [ ] 운영 매뉴얼 작성
  - [ ] 관리자 교육 자료 작성
  - [ ] 백업/복구 절차 문서화
  - [ ] 장애 대응 프로세스 수립
  - [ ] 모니터링 대시보드 구축

### 11. 문서화

- [ ] **기술 문서**
  - [ ] API 명세서 작성 (Swagger/OpenAPI)
  - [ ] 데이터베이스 스키마 문서
  - [ ] 아키텍처 다이어그램
  - [ ] 시퀀스 다이어그램

- [ ] **사용자 문서**
  - [ ] 관리자 사용 가이드
  - [ ] FAQ 문서
  - [ ] 트러블슈팅 가이드

## 📊 예상 일정

- 프로젝트 초기 설정: 2일
- 데이터베이스 설계 및 구축: 3일
- 메일 수신 시스템: 5일
- 업체 관리 시스템: 3일
- 납품 일정 관리: 3일
- 알림 발송 시스템: 5일
- 관리자 대시보드: 7일
- 예외 처리 및 모니터링: 3일
- 테스트: 5일
- 배포 및 문서화: 3일

**총 예상 개발 기간: 약 39일 (8주)**

## 🚀 MVP 우선순위

1. 메일 수신 및 확인 (기본 기능)
2. 업체 정보 관리 (CRUD)
3. SMS 알림 발송
4. 관리자 대시보드 (기본 UI)
5. 납품 일정 자동 계산

## ⚠️ 리스크 관리

- **메일 서버 호환성**: 다양한 메일 서버 테스트 필요
- **SMS/카카오톡 API 제한**: 발송량 제한 및 비용 고려
- **공휴일 API 의존성**: 백업 수동 관리 기능 필수
- **대량 발송 성능**: 큐 시스템 및 비동기 처리 중요
- **개인정보 보호**: 암호화 및 접근 권한 관리 필수
