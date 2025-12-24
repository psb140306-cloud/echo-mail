# 스팸 필터링 및 IMAP 동기화 통합 가이드

## 개요

3가지 새로운 기능을 Echo Mail에 통합합니다:
1. **스팸 필터링 강화** (`spam-filter.ts`)
2. **IMAP 동기화** (`imap-sync-service.ts`)
3. **특수문자 디코딩 개선** (`email-decoder.ts`)

---

## 1. 스팸 필터 통합

### 1-1. mail-monitor-service.ts 수정

`processEmail()` 함수에서 스팸 체크 추가:

```typescript
// lib/mail/mail-monitor-service.ts

import { checkSpam } from './spam-filter'

// processEmail() 함수 내부, 메일 파싱 후:
private async processEmail(...) {
  // ... 기존 코드 ...

  // 스팸 체크 (헤더 체크 후 추가 검사)
  const spamCheck = checkSpam({
    sender: from?.address || '',
    senderName: senderName || undefined,
    subject: subject || '',
    body: parsedEmail.textBody || undefined,
  })

  if (spamCheck.isSpam) {
    logger.info('[MailMonitor] 스팸 메일 감지, 무시 처리', {
      sender: from?.address,
      score: spamCheck.score,
      reasons: spamCheck.reasons,
    })

    // 스팸으로 저장 (상태: IGNORED)
    await prisma.emailLog.create({
      data: {
        // ... 기본 필드 ...
        status: 'IGNORED',
        errorMessage: `스팸 (점수: ${spamCheck.score}): ${spamCheck.reasons.join(', ')}`,
        // ...
      },
    })

    // 읽음 처리하고 종료
    if (mailConfig.autoMarkAsRead) {
      await this.safeMarkAsRead(client, message.uid)
    }
    return
  }

  // 일반 메일 처리 계속...
}
```

### 1-2. 관리자 UI 추가 (선택사항)

블랙리스트 도메인을 관리할 수 있는 UI:

```typescript
// app/api/admin/spam-blacklist/route.ts
import { addSpamDomain, removeSpamDomain } from '@/lib/mail/spam-filter'

export async function POST(request: Request) {
  const { domain, action } = await request.json()

  if (action === 'add') {
    addSpamDomain(domain)
  } else if (action === 'remove') {
    removeSpamDomain(domain)
  }

  return NextResponse.json({ success: true })
}
```

---

## 2. IMAP 동기화 통합

### 2-1. Cron Job 추가

매일 1회 IMAP 동기화 실행:

```typescript
// app/api/cron/sync-imap/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { imapSyncService } from '@/lib/mail/imap-sync-service'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  // Cron Secret 검증
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 활성 테넌트 조회
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  const results = []

  for (const tenant of tenants) {
    // 메일 설정 조회
    const mailConfig = await getMailConfig(tenant.id)

    if (mailConfig.enabled) {
      const result = await imapSyncService.syncTenantMails(
        tenant.id,
        {
          host: mailConfig.host,
          port: mailConfig.port,
          username: mailConfig.username,
          password: mailConfig.password,
          useSSL: mailConfig.useSSL,
        },
        7 // 최근 7일만 동기화
      )

      results.push({ tenantId: tenant.id, ...result })
    }
  }

  return NextResponse.json({
    success: true,
    results,
  })
}
```

### 2-2. Vercel Cron 설정

`vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-mail",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/sync-imap",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## 3. 특수문자 디코딩 통합

### 3-1. mail-monitor-service.ts 수정

기존 `decodeMimeHeader()` 대신 새 디코더 사용:

```typescript
// lib/mail/mail-monitor-service.ts 상단
import { decodeEmailHeader, decodeEmailAddress, getSafeDisplayName } from './email-decoder'

// decodeMimeHeader() 함수를 decodeEmailHeader()로 교체:
function decodeMimeHeader(header: string | undefined): string {
  const result = decodeEmailHeader(header)
  return result.decoded
}

// 또는 직접 사용:
const subject = decodeEmailHeader(rawSubject).decoded
```

### 3-2. 발신자 정보 디코딩

```typescript
// processEmail() 함수 내부:

// IMAP envelope에서 발신자 정보 추출
const fromEnvelope = message.envelope.from?.[0]

// 강화된 디코딩 사용
const senderInfo = decodeEmailAddress(
  fromEnvelope?.name
    ? `${fromEnvelope.name} <${fromEnvelope.address}>`
    : fromEnvelope?.address
)

const senderName = senderInfo.name
const senderAddress = senderInfo.address || fromEnvelope?.address || ''

// 표시용 이름 (디코딩 실패 시 경고 표시)
const displayName = getSafeDisplayName(senderAddress, senderName)
```

---

## 4. 테스트 계획

### 4-1. 스팸 필터 테스트

```typescript
// __tests__/spam-filter.test.ts

import { checkSpam } from '@/lib/mail/spam-filter'

test('nru.com 도메인은 스팸으로 감지', () => {
  const result = checkSpam({
    sender: 'test@nru.com',
    subject: '정상 제목',
  })

  expect(result.isSpam).toBe(true)
  expect(result.score).toBeGreaterThanOrEqual(40)
})

test('스팸 키워드 포함 시 점수 증가', () => {
  const result = checkSpam({
    sender: 'normal@example.com',
    subject: '발기부전 치료제 100% 정품 할인마트',
  })

  expect(result.score).toBeGreaterThan(50)
})
```

### 4-2. IMAP 동기화 테스트

1. 테스트 메일 발송
2. Echo Mail에서 수신 확인
3. 다음 메일함에서 해당 메일 스팸함으로 이동
4. Cron Job 수동 실행: `curl https://your-domain.vercel.app/api/cron/sync-imap -H "Authorization: Bearer YOUR_CRON_SECRET"`
5. Echo Mail에서 메일 상태 확인 (IGNORED 상태로 변경되었는지)

### 4-3. 특수문자 디코딩 테스트

```typescript
import { decodeEmailHeader } from '@/lib/mail/email-decoder'

test('특수문자 정규화', () => {
  const result = decodeEmailHeader('만족도∧1위')
  expect(result.decoded).toBe('만족도^1위')
  expect(result.hasSpecialChars).toBe(true)
})

test('MIME 인코딩 디코딩', () => {
  const result = decodeEmailHeader('=?UTF-8?B?7ZWc6riA?=')
  expect(result.decodingMethod).toBe('mime')
})
```

---

## 5. 배포 체크리스트

- [ ] 새 파일 3개 추가 확인
  - `lib/mail/spam-filter.ts`
  - `lib/mail/imap-sync-service.ts`
  - `lib/mail/email-decoder.ts`
- [ ] `mail-monitor-service.ts` 수정
- [ ] Cron Job API 추가 (`app/api/cron/sync-imap/route.ts`)
- [ ] `vercel.json` 크론 스케줄 추가
- [ ] 환경변수 `CRON_SECRET` 설정
- [ ] 테스트 실행
- [ ] 프로덕션 배포
- [ ] 24시간 후 로그 확인

---

## 6. 모니터링

### 로그 확인 위치

```bash
# Vercel Logs
vercel logs --follow

# 스팸 필터 로그
grep "스팸 메일 감지" logs/app.log

# IMAP 동기화 로그
grep "\[ImapSync\]" logs/app.log

# 디코딩 로그
grep "\[EmailDecoder\]" logs/app.log
```

### 주요 메트릭

- 스팸 감지율 (1일 평균)
- IMAP 동기화 - 삭제 메일 수
- IMAP 동기화 - 스팸 이동 메일 수
- 디코딩 실패율

---

## 7. 추후 개선 사항

1. **스팸 필터 학습**: 사용자가 "스팸 아님" 표시한 메일을 학습
2. **베이지안 필터**: 확률 기반 스팸 분류
3. **실시간 동기화**: IMAP IDLE 명령어 사용
4. **다중 언어 지원**: 일본어, 중국어 등 특수문자 디코딩
5. **관리자 대시보드**: 스팸 통계, 블랙리스트 관리 UI
