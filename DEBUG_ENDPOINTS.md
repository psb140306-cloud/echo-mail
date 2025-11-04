# Debug API 엔드포인트

## 보안 주의사항

⚠️ **중요**: 모든 Debug API는 `DEBUG_API_KEY` 환경 변수로 보호됩니다.
- 프로덕션 환경에서는 반드시 강력한 API 키를 설정하세요
- API 키는 절대 코드에 하드코딩하지 마세요
- API 키는 `.env` 파일에만 저장하고 Git에 커밋하지 마세요

## 환경 변수 설정

```bash
# Vercel 환경 변수에 추가
DEBUG_API_KEY=your-very-secure-random-key-here
```

강력한 키 생성 방법:
```bash
# OpenSSL 사용
openssl rand -hex 32

# Node.js 사용
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## SMS 테스트 엔드포인트

### GET /api/debug/test-sms

SMS 발송을 테스트하는 디버그 엔드포인트입니다.

**특징:**
- Usage limiter 우회 (테넌트 검증 없음)
- SMS Provider 직접 호출
- 디버그 목적으로만 사용

**인증:**
- Authorization 헤더 필수
- 형식: `Bearer <DEBUG_API_KEY>`

**파라미터:**
- `recipient` (optional): 수신자 전화번호 (기본값: 01093704931)
- `message` (optional): 메시지 내용 (기본값: 테스트 메시지)

### 사용 예시

#### cURL
```bash
# 기본 테스트
curl -H "Authorization: Bearer your-debug-api-key" \
  "https://echo-mail-blush.vercel.app/api/debug/test-sms"

# 커스텀 수신자 및 메시지
curl -H "Authorization: Bearer your-debug-api-key" \
  "https://echo-mail-blush.vercel.app/api/debug/test-sms?recipient=01012345678&message=테스트%20메시지"
```

#### Postman
1. Method: GET
2. URL: `https://echo-mail-blush.vercel.app/api/debug/test-sms`
3. Headers:
   - Key: `Authorization`
   - Value: `Bearer your-debug-api-key`
4. Params (optional):
   - `recipient`: 수신자 번호
   - `message`: 메시지 내용

#### JavaScript/TypeScript
```typescript
const response = await fetch(
  'https://echo-mail-blush.vercel.app/api/debug/test-sms',
  {
    headers: {
      'Authorization': 'Bearer your-debug-api-key',
    },
  }
)

const result = await response.json()
console.log(result)
```

### 응답 형식

**성공 (200 OK):**
```json
{
  "success": true,
  "smsResult": {
    "success": true,
    "messageId": "solapi_1234567890",
    "cost": 20
  },
  "requestInfo": {
    "recipient": "01093704931",
    "messageLength": 35,
    "timestamp": "2025-11-04T10:30:00.000Z"
  },
  "env": {
    "NODE_ENV": "production",
    "ENABLE_REAL_NOTIFICATIONS": "true",
    "SMS_PROVIDER": "solapi",
    "testMode": false
  }
}
```

**인증 실패 (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Authorization 헤더가 필요합니다. (Bearer <DEBUG_API_KEY>)"
}
```

**잘못된 API 키 (403 Forbidden):**
```json
{
  "success": false,
  "error": "유효하지 않은 API 키입니다."
}
```

**Debug API 비활성화 (503 Service Unavailable):**
```json
{
  "success": false,
  "error": "Debug API가 비활성화되어 있습니다. 관리자에게 문의하세요."
}
```

## 보안 Best Practices

1. **API 키 관리**
   - 정기적으로 API 키 교체
   - 키 노출 시 즉시 변경
   - 팀원별로 다른 키 사용 고려

2. **접근 제어**
   - 필요한 경우에만 사용
   - 로그에서 접근 패턴 모니터링
   - 비정상적인 접근 시도 감지

3. **프로덕션 사용**
   - 가능한 한 프로덕션에서 사용 자제
   - 대안: 스테이징 환경 사용
   - 필요 시 IP 화이트리스트 추가 고려

## 문제 해결

### "Debug API가 비활성화되어 있습니다"
→ Vercel 환경 변수에 `DEBUG_API_KEY` 추가 필요

### "Authorization 헤더가 필요합니다"
→ 요청에 `Authorization: Bearer <key>` 헤더 추가 필요

### "유효하지 않은 API 키입니다"
→ DEBUG_API_KEY 환경 변수와 요청의 키가 일치하는지 확인

### SMS가 발송되지 않음
→ 응답의 `env.testMode` 확인
- `true`: ENABLE_REAL_NOTIFICATIONS=true 설정 필요
- `false`: SOLAPI 설정 확인 필요
