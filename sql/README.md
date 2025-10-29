# SQL 스크립트 모음

이 폴더에는 Supabase 데이터베이스 설정을 위한 SQL 스크립트들이 있습니다.

## 실행 순서

### 1단계: 테이블 생성
```bash
sql/create-missing-tables.sql
```
- 빠진 7개 테이블 생성 (tenant_users, sessions, accounts 등)
- **필수! 가장 먼저 실행**

### 2단계: Auth Webhook 설정
```bash
sql/supabase-auth-trigger.sql
```
- 회원가입 시 자동 Tenant 생성
- Trigger 및 Webhook 함수 설정

### 3단계: RLS (Row Level Security) 설정
```bash
sql/setup-rls.sql
```
- 데이터 보안 정책 설정
- 사용자가 자신의 tenant 데이터만 볼 수 있도록

## 실행 방법

1. **Supabase 대시보드** 접속
2. **SQL Editor** 메뉴 클릭
3. **New Query** 클릭
4. SQL 파일 내용 복사 → 붙여넣기
5. **Run** 버튼 클릭

## 파일 설명

| 파일 | 용도 | 필수 여부 |
|------|------|----------|
| `create-missing-tables.sql` | 누락된 테이블 생성 | ⭐️ 필수 |
| `supabase-auth-trigger.sql` | 회원가입 자동화 | ⭐️ 필수 |
| `setup-rls.sql` | 보안 정책 설정 | 권장 |
| `create-tables.sql` | (기존) 초기 테이블 생성 | 참고용 |
| `check-rls.sql` | RLS 정책 확인 | 테스트용 |
| `test-rls.sql` | RLS 동작 테스트 | 테스트용 |

## 주의사항

- SQL 스크립트는 **순서대로** 실행해야 합니다
- 이미 실행한 스크립트는 다시 실행해도 안전합니다 (IF NOT EXISTS 사용)
- 오류가 발생하면 로그를 확인하고 다시 실행하세요
