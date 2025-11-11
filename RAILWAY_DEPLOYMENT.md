# Railway 워커 배포 가이드

Echo Mail의 메일 모니터링 워커를 Railway에 배포하는 방법입니다.

## 수정된 버그 목록

이번 배포 전에 다음 버그들이 수정되었습니다:

✅ **IMAP 읽음 처리 버그 수정**
- `messageFlagsAdd({ uid: true }, String(uid), ['\\Seen'])` 올바른 형식으로 수정
- 이메일이 처리 후 정확히 읽음 처리되어 중복 발송 방지

✅ **납품일 계산 시간 오류 수정**
- 이메일 실제 수신 시간(`message.envelope.date`) 사용
- `new Date()` 대신 정확한 주문 시간 기준으로 납품일 계산

✅ **알림 발송 이력 DB 저장 활성화**
- NotificationLog 테이블에 발송 이력 저장
- 발송 내역 조회 및 통계 확인 가능

✅ **EmailLog 기반 중복 발송 방지**
- 각 이메일마다 고유 EmailLog 생성
- 동일 emailLogId로 이미 발송했는지 확인
- IMAP 읽음 처리 실패 시에도 중복 방지

## 1. Railway 프로젝트 생성

1. [Railway 대시보드](https://railway.app) 접속
2. "New Project" 클릭
3. "Deploy from GitHub repo" 선택
4. `echo-mail` 저장소 선택

## 2. 환경변수 설정

Railway 프로젝트 Settings → Variables에서 다음 환경변수를 설정하세요:

### 필수 환경변수

```bash
# 데이터베이스 (Supabase)
DATABASE_URL=postgresql://user:password@host:5432/database

# Node 환경
NODE_ENV=production

# 알림 발송 활성화
ENABLE_REAL_NOTIFICATIONS=true

# SOLAPI (SMS 발송)
SOLAPI_API_KEY=your-api-key
SOLAPI_API_SECRET=your-api-secret
SOLAPI_SENDER=01012345678

# Railway 워커 시크릿 (임의 생성)
RAILWAY_WORKER_SECRET=random-secret-32-chars-minimum

# 로그 레벨
LOG_LEVEL=info
```

### 선택 환경변수

```bash
# 카카오톡 (선택)
KAKAO_API_KEY=your-kakao-api-key
KAKAO_SENDER_KEY=your-sender-key
```

## 3. Railway 워커 시크릿 생성

터미널에서 실행:

```bash
# 랜덤 시크릿 생성
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

생성된 값을 `RAILWAY_WORKER_SECRET`으로 설정

## 4. Vercel 환경변수 설정

Vercel 프로젝트 Settings → Environment Variables:

```bash
# Railway 워커 URL (배포 후 설정)
RAILWAY_WORKER_URL=https://your-worker.up.railway.app

# Railway 워커 시크릿 (위에서 생성한 것과 동일)
RAILWAY_WORKER_SECRET=same-as-railway-secret
```

## 5. 배포 설정

Railway는 자동으로 다음 파일을 감지합니다:

### `Procfile` (이미 존재)
```
worker: node worker/index.js
```

### `railway.json` (선택사항)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node worker/index.js",
    "healthcheckPath": "/health"
  }
}
```

## 6. 배포 및 확인

### 배포
Railway는 GitHub push 시 자동 배포됩니다.

### 확인 사항

1. **배포 로그 확인**
   - Railway 대시보드 → Deployments → 최신 배포 클릭
   - 로그에서 다음 메시지 확인:
     ```
     [MailScheduler] 초기화 시작
     [MailScheduler] 활성 테넌트 X개 발견
     [API] 워커 API 서버 시작: 포트 8080
     ```

2. **Health Check**
   ```bash
   curl https://your-worker.up.railway.app/health
   ```

   응답:
   ```json
   {
     "status": "healthy",
     "service": "echo-mail-worker",
     "timestamp": "2025-11-11T..."
   }
   ```

3. **스케줄러 상태 확인**
   ```bash
   curl -H "Authorization: Bearer YOUR_RAILWAY_WORKER_SECRET" \
        https://your-worker.up.railway.app/scheduler/status
   ```

## 7. 메일 서버 설정

Echo Mail 웹 앱에서:

1. **설정 → 메일 서버** 이동
2. IMAP 서버 정보 입력:
   - 호스트: `imap.naver.com` (네이버 기준)
   - 포트: `993`
   - 사용자명: 메일 주소
   - 비밀번호: 메일 비밀번호 또는 앱 비밀번호
   - SSL/TLS: 활성화
3. **확인 간격**: 1~5분 (기본 1분)
4. **메일 수신 활성화** 체크
5. **저장**

저장 시 자동으로 Railway 워커에 스케줄러 재로드 요청이 전송됩니다.

## 8. 테스트

1. **메일 발송**
   - 등록된 업체 이메일로 테스트 메일 발송
   - 발주 관련 키워드 포함 (예: "발주", "주문")

2. **로그 확인**
   - Railway 대시보드에서 실시간 로그 확인
   - 메일 수신, 업체 매칭, SMS 발송 확인

3. **발송 내역 확인**
   - Echo Mail 웹 앱 → 알림 관리 → 발송 내역
   - 통계 및 상세 내역 확인

## 9. 문제 해결

### 메일 확인이 안 됨
- Railway 로그에서 IMAP 연결 오류 확인
- 메일 서버 설정 (호스트, 포트, 인증) 재확인
- 네이버/Gmail의 경우 앱 비밀번호 사용 필요

### SMS가 발송 안 됨
- `ENABLE_REAL_NOTIFICATIONS=true` 설정 확인
- SOLAPI 잔액 확인
- Railway 로그에서 에러 메시지 확인

### 중복 SMS 발송
- 수정됨! IMAP 읽음 처리 및 EmailLog 기반 중복 방지
- 만약 여전히 문제 시 Railway 로그 공유

### 워커가 시작 안 됨
- `DATABASE_URL` 환경변수 확인
- Railway 로그에서 에러 확인
- Supabase 연결 상태 확인

## 10. 모니터링

### Railway 로그
```bash
# 실시간 로그 확인
railway logs -f
```

### 주요 로그 메시지

**정상:**
```
[MailScheduler] 스케줄 등록: tenantId=xxx, intervalMinutes=1
[MailMonitor] 테넌트 xxx 새 메일 2개 발견
[MailMonitor] 업체 매칭 성공: companyId=xxx
[MailMonitor] 알림 발송 완료: successCount=1
[MailMonitor] 읽음 처리 성공: uid=12345
```

**에러:**
```
[MailMonitor] IMAP 연결 실패
[MailMonitor] 업체를 찾을 수 없음
[MailMonitor] 알림 발송 실패
```

## 11. 비용 최적화

### Railway 무료 플랜
- 월 $5 크레딧 제공
- CPU/메모리 사용량에 따라 차감
- 워커는 경량이므로 무료 플랜으로도 충분

### 권장 설정
- 메일 확인 간격: 3~5분 (1분은 빈번함)
- IMAP IDLE 사용 (현재 미구현)

## 12. 업데이트 배포

GitHub에 push하면 Railway가 자동 재배포:

```bash
git add .
git commit -m "feat: 새 기능 추가"
git push origin main
```

## 요약

1. ✅ Railway 프로젝트 생성 및 GitHub 연결
2. ✅ 환경변수 설정 (DATABASE_URL, SOLAPI, RAILWAY_WORKER_SECRET)
3. ✅ Vercel에 RAILWAY_WORKER_URL, RAILWAY_WORKER_SECRET 추가
4. ✅ 배포 확인 (Health Check, 로그)
5. ✅ 웹 앱에서 메일 서버 설정
6. ✅ 테스트 메일 발송 및 확인

**이제 모든 버그가 수정되어 안전하게 사용 가능합니다!**
