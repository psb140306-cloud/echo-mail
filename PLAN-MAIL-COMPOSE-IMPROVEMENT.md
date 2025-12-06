# Echo Mail - 메일 작성 기능 개선 계획

## 1. 개요

### 1.1 현재 상태
- 단순 텍스트 입력 (Textarea)
- CC/BCC 지원
- 답장 기능 (inReplyTo 헤더)
- 백엔드에 첨부파일 인터페이스 정의됨 (UI 미구현)

### 1.2 목표
B2B 메일 서비스로서 경쟁력 있는 메일 작성 기능 구현:
1. 리치 텍스트 에디터 (서식, 이미지, 표, 링크)
2. 파일 첨부 기능
3. 주소록 연동
4. 메일 템플릿
5. 예약 발송
6. 서명(명함) 기능

---

## 2. 기술 스택 결정

### 2.1 리치 텍스트 에디터: **TipTap**
- 선정 이유:
  - Headless 아키텍처로 완전한 커스터마이징 가능
  - Shadcn UI와 호환되는 커뮤니티 패키지 존재
  - Next.js SSR 지원
  - 확장성 높음 (이미지, 표, 링크 등 Extension 제공)
  - 2025년 기준 가장 권장되는 에디터

- 필요 패키지:
```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
npm install @tiptap/extension-link @tiptap/extension-image @tiptap/extension-table
npm install @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
npm install @tiptap/extension-placeholder @tiptap/extension-text-align @tiptap/extension-underline
npm install @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-highlight
```

### 2.2 파일 업로드
- 기존 multer 사용 (package.json에 이미 포함)
- Supabase Storage 활용 (이미 연동됨)

---

## 3. 구현 계획

### Phase 1: 리치 텍스트 에디터 도입 (핵심)

#### 3.1.1 TipTap 에디터 컴포넌트 생성
**파일:** `components/mail/rich-text-editor.tsx`

기능:
- 기본 서식: 굵게(B), 기울임(I), 밑줄(U), 취소선
- 제목 레벨 (H1, H2, H3)
- 글자 색상, 배경 색상
- 정렬 (왼쪽, 가운데, 오른쪽, 양쪽)
- 목록 (번호, 글머리)
- 인용구
- 코드 블록
- 링크 삽입/편집
- 이미지 삽입 (URL 또는 업로드)
- 표 삽입/편집

#### 3.1.2 에디터 툴바 컴포넌트
**파일:** `components/mail/editor-toolbar.tsx`

- Shadcn UI 버튼/토글 사용
- 툴바 그룹핑 (서식 | 정렬 | 목록 | 삽입)
- 반응형 디자인 (모바일에서 축소)

#### 3.1.3 메일 작성 페이지 수정
**파일:** `app/mail/compose/page.tsx`

- Textarea → TipTap 에디터로 교체
- HTML 출력을 API로 전송

---

### Phase 2: 파일 첨부 기능

#### 3.2.1 파일 업로드 API
**파일:** `app/api/mail/attachments/route.ts`

- POST: 파일 업로드 (Supabase Storage)
- DELETE: 파일 삭제
- 파일 크기 제한 (플랜별 차등)
- 허용 확장자 검증

#### 3.2.2 첨부파일 UI 컴포넌트
**파일:** `components/mail/attachment-uploader.tsx`

- 드래그 앤 드롭 지원
- 파일 목록 표시 (이름, 크기, 삭제 버튼)
- 업로드 진행률 표시
- 파일 미리보기 (이미지)

#### 3.2.3 메일 발송 API 수정
**파일:** `lib/mail/mail-sender.ts`

- 첨부파일 정보 받아서 nodemailer attachments로 전달
- Supabase Storage에서 파일 다운로드 후 첨부

---

### Phase 3: 주소록 연동

#### 3.3.1 주소록 검색 API
**파일:** `app/api/mail/address-book/route.ts`

기능:
- 등록된 Contact 테이블에서 이메일 검색
- 자동완성용 빠른 검색 (limit 10)
- 검색 필드: 이름, 이메일, 회사명

#### 3.3.2 주소록 자동완성 컴포넌트
**파일:** `components/mail/address-autocomplete.tsx`

- cmdk (이미 설치됨) 활용
- 입력 시 실시간 검색
- 선택 시 이메일 칩으로 추가
- 다중 선택 지원

#### 3.3.3 메일 작성 페이지 연동
- 받는 사람, 참조, 숨은참조 필드에 자동완성 적용

---

### Phase 4: 메일 템플릿

#### 3.4.1 DB 스키마 추가
**파일:** `prisma/schema.prisma`

```prisma
model EmailTemplate {
  id          String   @id @default(cuid())
  name        String
  subject     String
  content     String   @db.Text  // HTML 형식
  category    String?             // 카테고리 분류
  isDefault   Boolean  @default(false)

  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  createdBy   String              // 생성자 userId

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, name])
  @@index([tenantId])
  @@index([tenantId, category])
  @@map("email_templates")
}
```

#### 3.4.2 템플릿 관리 API
**파일:** `app/api/mail/templates/route.ts`

- GET: 템플릿 목록 조회
- POST: 템플릿 생성
- PUT: 템플릿 수정
- DELETE: 템플릿 삭제

#### 3.4.3 템플릿 선택 UI
**파일:** `components/mail/template-selector.tsx`

- 템플릿 목록 드롭다운
- 선택 시 제목/본문 자동 채우기
- "현재 내용을 템플릿으로 저장" 기능

#### 3.4.4 템플릿 관리 페이지
**파일:** `app/settings/templates/page.tsx`

- 템플릿 CRUD UI
- 미리보기 기능

---

### Phase 5: 예약 발송

#### 3.5.1 DB 스키마 추가
**파일:** `prisma/schema.prisma`

```prisma
model ScheduledEmail {
  id          String   @id @default(cuid())

  // 메일 내용
  to          String[]
  cc          String[]
  bcc         String[]
  subject     String
  text        String?  @db.Text
  html        String   @db.Text
  attachments Json?              // 첨부파일 정보

  // 예약 정보
  scheduledAt DateTime           // 예약 발송 시간
  status      ScheduledEmailStatus @default(PENDING)

  // 발송 결과
  sentAt      DateTime?
  messageId   String?            // 발송 후 메시지 ID
  errorMessage String?

  // 멀티테넌시
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  createdBy   String              // 생성자 userId

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId])
  @@index([tenantId, status])
  @@index([scheduledAt, status])
  @@map("scheduled_emails")
}

enum ScheduledEmailStatus {
  PENDING   // 대기
  SENDING   // 발송 중
  SENT      // 발송 완료
  FAILED    // 발송 실패
  CANCELLED // 취소됨
}
```

#### 3.5.2 예약 발송 API
**파일:** `app/api/mail/schedule/route.ts`

- POST: 예약 메일 생성
- GET: 예약 메일 목록 조회
- DELETE: 예약 취소

#### 3.5.3 예약 발송 처리 Cron
**파일:** `lib/scheduler/scheduled-email-processor.ts`

- 1분마다 실행
- scheduledAt이 지난 PENDING 메일 발송
- 발송 결과 업데이트

#### 3.5.4 예약 발송 UI
**파일:** `components/mail/schedule-picker.tsx`

- 날짜/시간 선택기
- "지금 보내기" vs "예약 발송" 선택
- 예약된 메일 목록 페이지

---

### Phase 6: 서명(명함) 기능

#### 3.6.1 DB 스키마 추가
**파일:** `prisma/schema.prisma`

```prisma
model EmailSignature {
  id          String   @id @default(cuid())
  name        String
  content     String   @db.Text  // HTML 형식
  isDefault   Boolean  @default(false)

  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  createdBy   String              // 생성자 userId

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("email_signatures")
}
```

#### 3.6.2 서명 관리 API
**파일:** `app/api/mail/signatures/route.ts`

- CRUD API

#### 3.6.3 서명 관리 UI
**파일:** `app/settings/signatures/page.tsx`

- 서명 CRUD UI
- 리치 텍스트 에디터로 서명 편집
- 미리보기 기능

#### 3.6.4 메일 작성 시 서명 자동 삽입
- 기본 서명 자동 삽입 옵션
- 서명 변경 드롭다운

---

## 4. 파일 구조

```
components/
  mail/
    rich-text-editor.tsx      # TipTap 에디터 래퍼
    editor-toolbar.tsx        # 에디터 툴바
    attachment-uploader.tsx   # 파일 첨부 컴포넌트
    address-autocomplete.tsx  # 주소록 자동완성
    template-selector.tsx     # 템플릿 선택기
    schedule-picker.tsx       # 예약 발송 날짜 선택
    signature-selector.tsx    # 서명 선택기

app/
  api/
    mail/
      attachments/route.ts    # 첨부파일 업로드 API
      address-book/route.ts   # 주소록 검색 API
      templates/route.ts      # 메일 템플릿 API
      schedule/route.ts       # 예약 발송 API
      signatures/route.ts     # 서명 API

  settings/
    templates/page.tsx        # 템플릿 관리 페이지
    signatures/page.tsx       # 서명 관리 페이지

lib/
  scheduler/
    scheduled-email-processor.ts  # 예약 메일 처리
```

---

## 5. 구현 우선순위

| 순위 | 기능 | 이유 | 예상 작업량 |
|------|------|------|-------------|
| 1 | 리치 텍스트 에디터 | 가장 기본적인 편집 기능, 다른 기능의 기반 | 중 |
| 2 | 파일 첨부 | B2B에서 필수, 백엔드 일부 구현됨 | 중 |
| 3 | 주소록 연동 | 기존 Contact 데이터 활용 가능, 효율성 향상 | 소 |
| 4 | 서명(명함) | B2B 필수 기능, 비교적 단순 | 소 |
| 5 | 메일 템플릿 | 반복 업무 효율화 | 중 |
| 6 | 예약 발송 | 편의 기능, 스케줄러 연동 필요 | 대 |

---

## 6. 플랜별 기능 제한 (제안)

| 기능 | FREE_TRIAL | STARTER | PROFESSIONAL | BUSINESS+ |
|------|------------|---------|--------------|-----------|
| 리치 텍스트 | O | O | O | O |
| 파일 첨부 | 5MB/파일 | 10MB/파일 | 25MB/파일 | 50MB/파일 |
| 첨부 개수 | 3개 | 5개 | 10개 | 무제한 |
| 주소록 연동 | O | O | O | O |
| 서명 개수 | 1개 | 3개 | 10개 | 무제한 |
| 템플릿 개수 | 3개 | 10개 | 50개 | 무제한 |
| 예약 발송 | X | X | O | O |

---

## 7. 마이그레이션 계획

1. DB 스키마 변경 (prisma db push)
2. 기존 메일 작성 페이지는 유지하면서 새 에디터 개발
3. 기능 완성 후 기존 페이지 교체
4. 단계별 배포로 안정성 확보

---

## 8. 테스트 계획

- 유닛 테스트: 에디터 컴포넌트, API 핸들러
- 통합 테스트: 메일 발송 플로우
- E2E 테스트: 메일 작성 → 발송 전체 흐름
- 브라우저 호환성: Chrome, Firefox, Safari, Edge

---

## 9. 예상 일정

- **Phase 1 (리치 텍스트 에디터)**: 핵심 작업
- **Phase 2 (파일 첨부)**: Phase 1 완료 후 진행
- **Phase 3 (주소록 연동)**: Phase 1과 병행 가능
- **Phase 4 (서명)**: Phase 1 완료 후 진행
- **Phase 5 (템플릿)**: Phase 4 완료 후 진행
- **Phase 6 (예약 발송)**: 마지막 단계

---

## 10. 참고 자료

- [TipTap React 설치 가이드](https://tiptap.dev/docs/editor/getting-started/install/react)
- [@tiptap/react npm](https://www.npmjs.com/package/@tiptap/react)
- [TipTap GitHub](https://github.com/ueberdosis/tiptap)
- [reactjs-tiptap-editor (Shadcn 호환)](https://github.com/hunghg255/reactjs-tiptap-editor)
