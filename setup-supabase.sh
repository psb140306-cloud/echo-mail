#!/bin/bash

# Supabase 설정 스크립트 (Bash)
echo "🚀 Supabase 설정을 시작합니다..."

# 사용자 입력 받기
read -p "Supabase Project URL을 입력하세요 (https://xxxxx.supabase.co): " SUPABASE_URL
read -p "Supabase Anon Key를 입력하세요: " SUPABASE_ANON_KEY
read -p "Supabase Service Role Key를 입력하세요: " SUPABASE_SERVICE_KEY
read -p "Database URL을 입력하세요 (postgresql://...): " DATABASE_URL_INPUT

# .env.local 파일 업데이트
ENV_FILE=".env.local"

# 환경변수 업데이트 (sed 사용)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|NEXT_PUBLIC_SUPABASE_URL=\".*\"|NEXT_PUBLIC_SUPABASE_URL=\"$SUPABASE_URL\"|" $ENV_FILE
    sed -i '' "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=\".*\"|NEXT_PUBLIC_SUPABASE_ANON_KEY=\"$SUPABASE_ANON_KEY\"|" $ENV_FILE
    sed -i '' "s|SUPABASE_SERVICE_ROLE_KEY=\".*\"|SUPABASE_SERVICE_ROLE_KEY=\"$SUPABASE_SERVICE_KEY\"|" $ENV_FILE
    sed -i '' "s|DATABASE_URL=\".*\"|DATABASE_URL=\"$DATABASE_URL_INPUT\"|" $ENV_FILE
else
    # Linux
    sed -i "s|NEXT_PUBLIC_SUPABASE_URL=\".*\"|NEXT_PUBLIC_SUPABASE_URL=\"$SUPABASE_URL\"|" $ENV_FILE
    sed -i "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=\".*\"|NEXT_PUBLIC_SUPABASE_ANON_KEY=\"$SUPABASE_ANON_KEY\"|" $ENV_FILE
    sed -i "s|SUPABASE_SERVICE_ROLE_KEY=\".*\"|SUPABASE_SERVICE_ROLE_KEY=\"$SUPABASE_SERVICE_KEY\"|" $ENV_FILE
    sed -i "s|DATABASE_URL=\".*\"|DATABASE_URL=\"$DATABASE_URL_INPUT\"|" $ENV_FILE
fi

echo "✅ 환경변수가 업데이트되었습니다!"

# 데이터베이스 마이그레이션
echo ""
echo "📦 데이터베이스 마이그레이션을 시작합니다..."
npx prisma db push

# Seed 데이터 추가
echo ""
read -p "테스트 데이터를 추가하시겠습니까? (y/n): " SEED_CONFIRM
if [ "$SEED_CONFIRM" = "y" ]; then
    echo "🌱 Seed 데이터를 추가합니다..."
    npm run db:seed
fi

echo ""
echo "🎉 Supabase 설정이 완료되었습니다!"
echo "다음 명령으로 개발 서버를 시작하세요: npm run dev"