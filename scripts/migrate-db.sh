#!/bin/bash

# Railway 데이터베이스 마이그레이션 스크립트
# 사용법: npm run db:migrate:railway

echo "🔄 Railway 데이터베이스 마이그레이션 시작..."

# DATABASE_URL 환경변수 확인
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL 환경변수가 설정되지 않았습니다."
  echo "Railway에서 DATABASE_URL을 가져오세요:"
  echo "  railway variables"
  exit 1
fi

# Prisma DB Push 실행
echo "📦 Prisma 스키마를 데이터베이스에 적용 중..."
npx prisma db push --accept-data-loss

if [ $? -eq 0 ]; then
  echo "✅ 마이그레이션 완료!"
else
  echo "❌ 마이그레이션 실패"
  exit 1
fi
