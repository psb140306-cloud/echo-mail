#!/bin/bash
# SMS 테스트 스크립트
# 사용법: ./test-sms.sh <DEBUG_API_KEY>

if [ -z "$1" ]; then
  echo "사용법: ./test-sms.sh <DEBUG_API_KEY>"
  echo "예시: ./test-sms.sh abc123xyz456"
  exit 1
fi

API_KEY="$1"

echo "🚀 SMS 발송 테스트 시작..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  "https://echo-mail-blush.vercel.app/api/debug/test-sms")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "HTTP Status: $http_code"
echo ""
echo "Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$http_code" = "200" ]; then
  echo "✅ 요청 성공!"

  # testMode 확인
  testMode=$(echo "$body" | jq -r '.env.testMode' 2>/dev/null)
  if [ "$testMode" = "true" ]; then
    echo "⚠️  테스트 모드: 실제 SMS가 발송되지 않았습니다"
    echo "   실제 발송하려면 ENABLE_REAL_NOTIFICATIONS=true 설정 필요"
  else
    echo "📱 실제 SMS 발송 모드"
    success=$(echo "$body" | jq -r '.smsResult.success' 2>/dev/null)
    if [ "$success" = "true" ]; then
      echo "✅ SMS 발송 성공!"
      messageId=$(echo "$body" | jq -r '.smsResult.messageId' 2>/dev/null)
      echo "   Message ID: $messageId"
    else
      echo "❌ SMS 발송 실패"
      error=$(echo "$body" | jq -r '.smsResult.error' 2>/dev/null)
      echo "   에러: $error"
    fi
  fi
else
  echo "❌ 요청 실패 (HTTP $http_code)"
fi
