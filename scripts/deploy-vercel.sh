#!/bin/bash

# =============================================================================
# Echo Mail Vercel 배포 스크립트
# =============================================================================

set -e

echo "🚀 Echo Mail Vercel 배포를 시작합니다..."

# 환경 변수 확인
if [ ! -f .env.local ]; then
    echo "❌ .env.local 파일이 없습니다. 환경 변수를 설정해주세요."
    exit 1
fi

# 빌드 테스트
echo "🔨 프로덕션 빌드를 테스트합니다..."
npm run build

# 타입 체크
echo "🔍 TypeScript 타입을 체크합니다..."
npm run type-check

# 린트 체크
echo "📝 코드 스타일을 체크합니다..."
npm run lint

# Vercel 배포
echo "🌐 Vercel에 배포합니다..."
if [ "$1" = "prod" ] || [ "$1" = "production" ]; then
    vercel --prod
    echo "✅ 프로덕션 배포가 완료되었습니다!"
else
    vercel
    echo "✅ 프리뷰 배포가 완료되었습니다!"
fi
