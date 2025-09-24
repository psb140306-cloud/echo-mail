# Supabase 설정 스크립트 (PowerShell)
Write-Host "🚀 Supabase 설정을 시작합니다..." -ForegroundColor Green

# 사용자 입력 받기
$supabaseUrl = Read-Host "Supabase Project URL을 입력하세요 (https://xxxxx.supabase.co)"
$supabaseAnonKey = Read-Host "Supabase Anon Key를 입력하세요"
$supabaseServiceKey = Read-Host "Supabase Service Role Key를 입력하세요"
$databaseUrl = Read-Host "Database URL을 입력하세요 (postgresql://...)"

# .env.local 파일 경로
$envFile = ".env.local"

# 파일 내용 읽기
$content = Get-Content $envFile -Raw

# 환경변수 업데이트
$content = $content -replace 'NEXT_PUBLIC_SUPABASE_URL=".*"', "NEXT_PUBLIC_SUPABASE_URL=`"$supabaseUrl`""
$content = $content -replace 'NEXT_PUBLIC_SUPABASE_ANON_KEY=".*"', "NEXT_PUBLIC_SUPABASE_ANON_KEY=`"$supabaseAnonKey`""
$content = $content -replace 'SUPABASE_SERVICE_ROLE_KEY=".*"', "SUPABASE_SERVICE_ROLE_KEY=`"$supabaseServiceKey`""
$content = $content -replace 'DATABASE_URL=".*"', "DATABASE_URL=`"$databaseUrl`""

# 파일 저장
$content | Set-Content $envFile -NoNewline

Write-Host "✅ 환경변수가 업데이트되었습니다!" -ForegroundColor Green

# 데이터베이스 마이그레이션
Write-Host "`n📦 데이터베이스 마이그레이션을 시작합니다..." -ForegroundColor Yellow
npx prisma db push

# Seed 데이터 추가
$seed = Read-Host "`n테스트 데이터를 추가하시겠습니까? (y/n)"
if ($seed -eq "y") {
    Write-Host "🌱 Seed 데이터를 추가합니다..." -ForegroundColor Yellow
    npm run db:seed
}

Write-Host "`n🎉 Supabase 설정이 완료되었습니다!" -ForegroundColor Green
Write-Host "다음 명령으로 개발 서버를 시작하세요: npm run dev" -ForegroundColor Cyan