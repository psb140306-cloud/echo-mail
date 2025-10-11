# Supabase 설정 가이드

## Supabase 프로젝트 생성 및 연결

### 1. Supabase 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard)에 접속
2. "New project" 클릭
3. 프로젝트 정보 입력:
   - Organization 선택 또는 생성
   - Project name: `echo-mail`
   - Database Password: 강력한 비밀번호 설정
   - Region: `Northeast Asia (Seoul)` 선택 (한국 사용자용)
   - Pricing Plan: Free tier 또는 Pro 선택

### 2. 프로젝트 설정 확인

프로젝트가 생성되면 다음 정보를 확인:

1. **Settings > API** 에서:
   - `URL`: 프로젝트 URL
   - `anon public`: 공개 API 키
   - `service_role secret`: 서비스 역할 키

2. **Settings > Database** 에서:
   - Connection string 확인

### 3. 환경변수 설정

`.env.local` 파일을 열고 다음 값들을 실제 값으로 변경:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"
SUPABASE_SERVICE_ROLE_KEY="[YOUR-SERVICE-ROLE-KEY]"
SUPABASE_PROJECT_REF="[YOUR-PROJECT-REF]"

# Database URL (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

### 4. 데이터베이스 마이그레이션

```bash
# Prisma 스키마를 Supabase 데이터베이스에 적용
npx prisma db push

# 또는 마이그레이션 실행
npx prisma migrate deploy

# Seed 데이터 추가
npm run db:seed
```

### 5. Supabase 대시보드에서 확인

1. **Table Editor**에서 생성된 테이블 확인:
   - companies
   - contacts
   - delivery_rules
   - holidays
   - email_logs
   - notification_logs
   - system_configs
   - message_templates
   - users

2. **Authentication > Users**에서 사용자 관리

3. **Storage**에서 파일 버킷 생성 (필요시):
   - `attachments`: 이메일 첨부파일용
   - `documents`: 문서 저장용

### 6. Row Level Security (RLS) 설정

보안을 위해 RLS 정책 설정:

```sql
-- companies 테이블 RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON companies
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON companies
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON companies
    FOR UPDATE USING (auth.role() = 'authenticated');

-- contacts 테이블 RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON contacts
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON contacts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

### 7. 연결 테스트

```typescript
// test-supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function testConnection() {
  const { data, error } = await supabase.from('companies').select('*').limit(5)

  if (error) {
    console.error('Connection failed:', error)
  } else {
    console.log('Connection successful! Data:', data)
  }
}

testConnection()
```

### 8. 실시간 구독 설정 (선택사항)

```typescript
// 이메일 로그 실시간 구독
const subscription = supabase
  .channel('email_logs')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_logs' }, (payload) => {
    console.log('New email received:', payload.new)
  })
  .subscribe()
```

## 주의사항

1. **절대 커밋하지 말 것**:
   - `.env.local` 파일
   - 실제 API 키가 포함된 파일

2. **프로덕션 환경**:
   - 프로덕션용 별도 프로젝트 생성
   - 환경변수는 Vercel/AWS 등 호스팅 플랫폼에서 관리

3. **백업**:
   - Supabase 대시보드에서 정기 백업 설정
   - 중요 데이터는 별도 백업

## 문제 해결

### 연결 오류

- 환경변수 확인
- 프로젝트 상태 확인 (paused 상태인지)
- 네트워크/방화벽 설정 확인

### 권한 오류

- RLS 정책 확인
- Service role key vs Anon key 사용 구분

### 마이그레이션 오류

- DATABASE_URL 형식 확인
- SSL 설정: `?sslmode=require` 추가
