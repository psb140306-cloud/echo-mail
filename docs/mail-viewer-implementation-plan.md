# 메일 뷰어 구현 계획 체크리스트

## 📋 개요
- **목표**: 아웃룩과 유사한 메일 조회 기능 구현
- **원칙**: 기존 구현된 기능(EmailLog, IMAP, 이메일 파싱) 최대한 활용
- **단계**: Phase 1 (기본 메일 조회) → Phase 2 (발주 특화 기능)

---

## Phase 1: 기본 메일 뷰어 (우선순위: 높음)

### 1. 데이터베이스 스키마 확인 및 수정
**활용**: 기존 `EmailLog` 테이블 활용

- [ ] **1.1** `prisma/schema.prisma` 파일 읽기
  - 현재 `EmailLog` 모델 구조 확인
  - 필요한 필드가 있는지 체크 (subject, from, receivedDate, body 등)

- [ ] **1.2** 스키마 수정 (필요시)
  - [ ] `body` 필드 추가 (메일 본문 저장용)
  - [ ] `bodyHtml` 필드 추가 (HTML 메일 본문용)
  - [ ] `attachments` 필드 추가 (첨부파일 메타데이터용, JSON 타입)
  - [ ] `isRead` 필드 추가 (읽음 여부 - IMAP 상태와 별도 관리)
  - [ ] `folder` 필드 추가 (INBOX, SENT 등 메일함 구분)
  - [ ] `size` 필드 추가 (메일 크기, Int)

- [ ] **1.3** Migration 실행
  ```bash
  npx prisma migrate dev --name add_mail_viewer_fields
  npx prisma generate
  ```

### 2. 백엔드 API 구현

#### 2.1 메일 목록 조회 API
**파일**: `app/api/mail/list/route.ts` (신규)

- [ ] **2.1.1** GET 엔드포인트 구현
  - [ ] 테넌트 컨텍스트 인증 (`withTenantContext`)
  - [ ] 쿼리 파라미터 스키마 정의 (Zod)
    - `page` (기본값: 1)
    - `limit` (기본값: 50, 최대: 100)
    - `folder` (기본값: 'INBOX')
    - `search` (검색어, 선택)
    - `dateFrom` (날짜 필터, 선택)
    - `dateTo` (날짜 필터, 선택)
    - `isRead` (읽음 필터, 선택)

- [ ] **2.1.2** EmailLog 테이블 쿼리
  ```typescript
  const emails = await prisma.emailLog.findMany({
    where: {
      tenantId,
      folder: folder || 'INBOX',
      // 검색어가 있으면 subject, from, body에서 검색
      OR: search ? [
        { subject: { contains: search } },
        { from: { contains: search } },
        { body: { contains: search } }
      ] : undefined,
      // 날짜 필터
      receivedDate: {
        gte: dateFrom,
        lte: dateTo,
      },
      // 읽음 필터
      isRead: isRead,
    },
    orderBy: { receivedDate: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      messageId: true,
      subject: true,
      from: true,
      receivedDate: true,
      isRead: true,
      isOrder: true,
      size: true,
      hasAttachments: true, // attachments 필드가 null이 아닌지 체크
    }
  })
  ```

- [ ] **2.1.3** 총 개수 쿼리 (페이지네이션용)
  ```typescript
  const totalCount = await prisma.emailLog.count({
    where: { /* 동일한 조건 */ }
  })
  ```

- [ ] **2.1.4** 응답 반환
  ```typescript
  return createSuccessResponse({
    emails,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    }
  })
  ```

#### 2.2 메일 상세 조회 API
**파일**: `app/api/mail/[id]/route.ts` (신규)

- [ ] **2.2.1** GET 엔드포인트 구현
  - [ ] 테넌트 컨텍스트 인증
  - [ ] `id` 파라미터로 EmailLog 조회
  - [ ] 테넌트 격리 확인

- [ ] **2.2.2** EmailLog + 관련 데이터 조회
  ```typescript
  const email = await prisma.emailLog.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      notifications: {
        include: {
          contact: {
            include: {
              company: true,
            }
          }
        }
      },
      company: true, // 매칭된 업체 정보
    }
  })
  ```

- [ ] **2.2.3** 메일 본문이 없으면 IMAP에서 실시간 조회
  - [ ] `lib/mail/mail-monitor-service.ts`의 기존 IMAP 연결 로직 재사용
  - [ ] `fetchFullEmail(messageId)` 함수 활용 또는 신규 작성
  - [ ] 조회 후 EmailLog에 body 업데이트

- [ ] **2.2.4** 읽음 상태 업데이트
  ```typescript
  if (!email.isRead) {
    await prisma.emailLog.update({
      where: { id },
      data: { isRead: true }
    })
  }
  ```

- [ ] **2.2.5** 응답 반환 (전체 메일 정보)

#### 2.3 메일 읽음/안읽음 토글 API
**파일**: `app/api/mail/[id]/mark-read/route.ts` (신규)

- [ ] **2.3.1** PUT 엔드포인트 구현
  - [ ] 테넌트 컨텍스트 인증
  - [ ] Request body: `{ isRead: boolean }`

- [ ] **2.3.2** EmailLog 업데이트
  ```typescript
  const updated = await prisma.emailLog.update({
    where: { id },
    data: { isRead: data.isRead }
  })
  ```

- [ ] **2.3.3** IMAP 서버에도 읽음 상태 동기화 (선택)
  - [ ] `lib/mail/mail-monitor-service.ts`의 `safeMarkAsRead` 재사용
  - [ ] 에러가 발생해도 로컬 DB는 업데이트 유지

#### 2.4 메일 삭제 API
**파일**: `app/api/mail/[id]/route.ts` (위 2.2와 동일 파일)

- [ ] **2.4.1** DELETE 엔드포인트 추가
  - [ ] 테넌트 컨텍스트 인증
  - [ ] EmailLog 삭제 (soft delete 또는 hard delete 선택)

- [ ] **2.4.2** IMAP 서버에서도 삭제 (선택)
  - [ ] 기존 IMAP 연결 로직 재사용
  - [ ] `client.messageDelete()` 호출

### 3. 프론트엔드 UI 구현

#### 3.1 메일함 페이지 생성
**파일**: `app/mail/page.tsx` (신규)

- [ ] **3.1.1** 페이지 레이아웃 구조
  - [ ] 좌측: 메일함 목록 (INBOX, SENT 등)
  - [ ] 중앙: 메일 목록 (테이블 또는 리스트)
  - [ ] 우측: 메일 상세 (선택 시 표시)

- [ ] **3.1.2** 메일 목록 테이블 컴포넌트
  - [ ] 컬럼: 읽음 상태 아이콘, 발송자, 제목, 날짜, 크기
  - [ ] 발주 메일은 뱃지 표시 (isOrder === true)
  - [ ] 읽지 않은 메일은 굵은 글씨
  - [ ] 클릭 시 상세 보기

- [ ] **3.1.3** 검색 및 필터 UI
  - [ ] 검색창 (제목/발송자/본문 검색)
  - [ ] 날짜 범위 필터 (DatePicker)
  - [ ] 읽음/안읽음 필터 (Select)

- [ ] **3.1.4** 페이지네이션
  - [ ] shadcn/ui `Pagination` 컴포넌트 사용
  - [ ] 페이지 이동 시 URL 쿼리 파라미터 업데이트

- [ ] **3.1.5** API 연동
  ```typescript
  const { data, isLoading } = useQuery({
    queryKey: ['mail-list', page, folder, search, filters],
    queryFn: () => fetch('/api/mail/list?...').then(r => r.json())
  })
  ```

#### 3.2 메일 상세 패널 컴포넌트
**파일**: `app/mail/components/MailDetailPanel.tsx` (신규)

- [ ] **3.2.1** 메일 헤더 정보 표시
  - [ ] 발송자 (from)
  - [ ] 수신자 (to)
  - [ ] 제목 (subject)
  - [ ] 날짜 (receivedDate)
  - [ ] 첨부파일 목록

- [ ] **3.2.2** 메일 본문 렌더링
  - [ ] HTML 메일: `dangerouslySetInnerHTML` 또는 sanitize 후 렌더
  - [ ] Plain text: `<pre>` 태그로 표시

- [ ] **3.2.3** 액션 버튼
  - [ ] 읽음/안읽음 토글
  - [ ] 삭제
  - [ ] (Phase 2) 발주 정보 추출

- [ ] **3.2.4** 발주 메일 특별 표시
  - [ ] isOrder === true 일 때 "발주 메일" 뱃지
  - [ ] 매칭된 업체 정보 표시
  - [ ] 발송된 알림 내역 표시 (notifications)

#### 3.3 메일함 사이드바 컴포넌트
**파일**: `app/mail/components/MailFolderSidebar.tsx` (신규)

- [ ] **3.3.1** 메일함 목록
  - [ ] INBOX (받은 편지함)
  - [ ] SENT (보낸 편지함) - 향후 구현
  - [ ] 각 메일함별 읽지 않은 메일 수 표시

- [ ] **3.3.2** 통계 표시
  - [ ] 총 메일 수
  - [ ] 오늘 받은 메일 수
  - [ ] 발주 메일 수

### 4. 기존 코드 수정

#### 4.1 mail-monitor-service.ts 수정
**파일**: `lib/mail/mail-monitor-service.ts`

- [ ] **4.1.1** EmailLog 저장 시 추가 필드 포함
  ```typescript
  await prisma.emailLog.create({
    data: {
      // ... 기존 필드
      body: emailContent.text,        // 추가
      bodyHtml: emailContent.html,    // 추가
      attachments: attachmentsMeta,   // 추가
      isRead: false,                  // 추가
      folder: 'INBOX',                // 추가
      size: emailSize,                // 추가
    }
  })
  ```

- [ ] **4.1.2** 메일 본문 파싱 함수 개선
  - [ ] 현재: 제목과 일부만 파싱
  - [ ] 개선: HTML/Text 본문 전체 저장
  - [ ] 첨부파일 메타데이터 추출 (파일명, 크기, MIME 타입)

#### 4.2 네비게이션 메뉴 추가
**파일**: `app/components/Header.tsx` 또는 `app/components/Sidebar.tsx`

- [ ] **4.2.1** "메일함" 메뉴 항목 추가
  ```tsx
  <Link href="/mail">
    <Mail className="h-4 w-4" />
    <span>메일함</span>
  </Link>
  ```

### 5. 테스트

- [ ] **5.1** API 테스트
  - [ ] `/api/mail/list` GET 요청 (Postman/curl)
  - [ ] `/api/mail/[id]` GET 요청
  - [ ] `/api/mail/[id]/mark-read` PUT 요청
  - [ ] `/api/mail/[id]` DELETE 요청

- [ ] **5.2** UI 테스트
  - [ ] 메일 목록 렌더링 확인
  - [ ] 메일 클릭 시 상세 보기
  - [ ] 검색 기능 동작 확인
  - [ ] 페이지네이션 동작 확인
  - [ ] 읽음/안읽음 토글 동작 확인

- [ ] **5.3** 기존 기능 회귀 테스트
  - [ ] 메일 모니터링 정상 작동 확인
  - [ ] 발주 메일 감지 정상 확인
  - [ ] SMS/카카오톡 발송 정상 확인
  - [ ] EmailLog 저장 정상 확인

---

## Phase 2: 발주 특화 기능 (우선순위: 중간)

### 6. 발주 정보 자동 추출

#### 6.1 email-parser.ts 확장
**파일**: `lib/mail/email-parser.ts`

- [ ] **6.1.1** 발주 정보 추출 함수 추가
  - [ ] 발주 번호 추출 (PO#, 주문번호 등)
  - [ ] 납품 요청일 추출
  - [ ] 품목 정보 추출 (테이블 파싱)
  - [ ] 수량 정보 추출

- [ ] **6.1.2** 추출 정확도 개선
  - [ ] 정규표현식 패턴 고도화
  - [ ] HTML 테이블 파싱 로직
  - [ ] 신뢰도 점수 계산

#### 6.2 발주 정보 DB 저장
**파일**: `prisma/schema.prisma`

- [ ] **6.2.1** OrderInfo 모델 추가 (선택)
  ```prisma
  model OrderInfo {
    id              String    @id @default(cuid())
    emailLogId      String
    emailLog        EmailLog  @relation(fields: [emailLogId], references: [id])
    orderNumber     String?
    requestedDate   DateTime?
    items           Json?     // 품목 정보 배열
    totalAmount     Decimal?
    extractedAt     DateTime  @default(now())
    tenantId        String
    tenant          Tenant    @relation(fields: [tenantId], references: [id])
  }
  ```

#### 6.3 UI: 발주 정보 표시
**파일**: `app/mail/components/OrderInfoPanel.tsx` (신규)

- [ ] **6.3.1** 추출된 발주 정보 표시
  - [ ] 발주 번호
  - [ ] 납품 요청일
  - [ ] 품목 테이블
  - [ ] 금액 정보

- [ ] **6.3.2** 수동 수정 기능
  - [ ] 잘못 추출된 정보 수정
  - [ ] 누락된 정보 추가

### 7. 발주 메일 필터 및 통계

#### 7.1 발주 메일 전용 뷰
**파일**: `app/mail/orders/page.tsx` (신규)

- [ ] **7.1.1** 발주 메일만 필터링 (isOrder === true)
- [ ] **7.1.2** 발주 상태별 필터
  - [ ] 알림 발송됨
  - [ ] 알림 실패
  - [ ] 알림 미발송

- [ ] **7.1.3** 업체별 그룹화 옵션

#### 7.2 발주 메일 통계 대시보드
**파일**: `app/dashboard/page.tsx` (기존 파일 수정)

- [ ] **7.2.1** 위젯 추가
  - [ ] 오늘 받은 발주 메일 수
  - [ ] 이번 주 발주 메일 수
  - [ ] 미처리 발주 메일 수 (알림 미발송)

- [ ] **7.2.2** API 추가
  **파일**: `app/api/dashboard/stats/route.ts`
  ```typescript
  const orderMailCount = await prisma.emailLog.count({
    where: {
      tenantId,
      isOrder: true,
      receivedDate: { gte: today }
    }
  })
  ```

### 8. 대량 작업

#### 8.1 대량 읽음 처리
**파일**: `app/api/mail/bulk-mark-read/route.ts` (신규)

- [ ] **8.1.1** POST 엔드포인트
  - [ ] Request body: `{ emailIds: string[], isRead: boolean }`
  - [ ] 여러 EmailLog 한번에 업데이트

#### 8.2 대량 삭제
**파일**: `app/api/mail/bulk-delete/route.ts` (신규)

- [ ] **8.2.1** POST 엔드포인트
  - [ ] Request body: `{ emailIds: string[] }`
  - [ ] 여러 EmailLog 한번에 삭제

#### 8.3 UI: 체크박스 선택 및 일괄 처리
**파일**: `app/mail/page.tsx` 수정

- [ ] **8.3.1** 메일 목록에 체크박스 추가
- [ ] **8.3.2** "모두 선택" 체크박스
- [ ] **8.3.3** 상단 액션 바
  - [ ] 일괄 읽음 처리 버튼
  - [ ] 일괄 삭제 버튼

---

## Phase 3: 고급 기능 (우선순위: 낮음)

### 9. 첨부파일 다운로드

- [ ] **9.1** API: 첨부파일 다운로드
  **파일**: `app/api/mail/[id]/attachments/[attachmentId]/route.ts`
  - [ ] IMAP에서 첨부파일 바이너리 조회
  - [ ] Content-Type 헤더 설정
  - [ ] 파일 다운로드 응답

- [ ] **9.2** UI: 첨부파일 다운로드 버튼
  **파일**: `app/mail/components/MailDetailPanel.tsx` 수정

### 10. 메일 검색 고도화

- [ ] **10.1** 전문 검색 (Full-text search)
  - [ ] PostgreSQL `tsvector` 활용
  - [ ] 검색 인덱스 추가

### 11. 메일 라벨/태그 시스템

- [ ] **11.1** MailLabel 모델 추가
- [ ] **11.2** 라벨 할당 API
- [ ] **11.3** 라벨별 필터링 UI

---

## 🔍 검증 체크리스트

### Phase 1 완료 후 검증
- [ ] 메일 목록이 정상적으로 표시되는가?
- [ ] 메일 클릭 시 상세 내용이 보이는가?
- [ ] 읽음/안읽음 토글이 작동하는가?
- [ ] 검색 기능이 정상 작동하는가?
- [ ] 페이지네이션이 정확하게 동작하는가?
- [ ] **기존 메일 모니터링 기능이 정상 작동하는가?** (회귀 테스트)
- [ ] **발주 메일 감지 및 알림 발송이 정상인가?** (회귀 테스트)

### Phase 2 완료 후 검증
- [ ] 발주 정보가 정확하게 추출되는가?
- [ ] 발주 메일 필터가 정상 작동하는가?
- [ ] 대시보드 통계가 정확한가?
- [ ] 대량 작업 기능이 정상 작동하는가?

---

## 📝 참고사항

### 기존 코드 재사용 포인트
1. **IMAP 연결**: `lib/mail/mail-monitor-service.ts`의 `connectToIMAP()` 재사용
2. **이메일 파싱**: `lib/mail/email-parser.ts`의 `parseOrderEmail()` 재사용
3. **테넌트 컨텍스트**: `lib/middleware/tenant-context.ts`의 `withTenantContext` 재사용
4. **Validation**: `lib/utils/validation.ts`의 `parseAndValidate` 재사용
5. **Logger**: `lib/utils/logger.ts` 재사용

### 주의사항
- EmailLog 테이블 스키마 변경 시 기존 메일 모니터링 로직 영향 확인 필수
- IMAP 연결은 리소스 소모가 크므로 connection pooling 고려
- 메일 본문 저장 시 개인정보 보호 정책 확인
- 대량 메일 처리 시 성능 이슈 발생 가능 → 페이지네이션 필수

### 예상 소요 시간 (1인 개발 기준)
- **Phase 1**: 2-3일
  - DB 스키마: 0.5일
  - 백엔드 API: 1일
  - 프론트엔드 UI: 1-1.5일
  - 테스트: 0.5일
- **Phase 2**: 1-2일
- **Phase 3**: 1일

---

## ✅ 현재 진행 상황
- [ ] Phase 1 시작 전
