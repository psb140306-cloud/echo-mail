# MCP 서버 설치 가이드

## 1. Context7 MCP 설치

Context7 MCP는 코드 분석 및 프로젝트 컨텍스트 관리를 위한 도구입니다.

### 설치 방법

```bash
# NPM을 통한 설치
npm install -g @modelcontextprotocol/context7

# 또는 npx로 직접 실행
npx @modelcontextprotocol/context7
```

### 설정 파일 업데이트

`.MCP.json` 파일에서 Context7 설정을 활성화:

```json
{
  "servers": {
    "context7": {
      "enabled": true,
      "installed": true
    }
  }
}
```

### 환경변수 설정

`.env.local` 파일에 Context7 API 키 추가:

```env
CONTEXT7_API_KEY=your-actual-context7-api-key
```

### 사용 방법

Context7 MCP가 설치되면 다음 기능을 사용할 수 있습니다:

1. **코드 분석**: 프로젝트 구조 및 의존성 분석
2. **컨텍스트 추적**: 코드 변경사항 자동 추적
3. **품질 평가**: 코드 품질 메트릭 제공
4. **문서 생성**: 코드 기반 문서 자동 생성

### 초기화 명령

```bash
# Context7 초기화
context7 init

# 프로젝트 분석 시작
context7 analyze

# 컨텍스트 업데이트
context7 update
```

## 2. GitHub MCP 설치

GitHub MCP는 저장소 관리 및 CI/CD 자동화를 위한 도구입니다.

### 설치 방법

```bash
# NPM을 통한 설치
npm install -g @modelcontextprotocol/github

# 또는 npx로 직접 실행
npx @modelcontextprotocol/github
```

### 설정 파일 업데이트

`.MCP.json` 파일에서 GitHub 설정을 활성화:

```json
{
  "servers": {
    "github": {
      "enabled": true,
      "installed": true
    }
  }
}
```

### GitHub 토큰 생성

1. GitHub.com에 로그인
2. Settings > Developer settings > Personal access tokens > Tokens (classic)
3. "Generate new token" 클릭
4. 다음 권한 선택:
   - `repo` (전체 저장소 접근)
   - `workflow` (GitHub Actions 관리)
   - `read:org` (조직 정보 읽기)
5. 토큰 생성 및 복사

### 환경변수 설정

`.env.local` 파일에 GitHub 정보 추가:

```env
GITHUB_TOKEN=your-actual-github-token
GITHUB_REPO_OWNER=your-github-username
GITHUB_REPO_NAME=echo-mail
```

### 사용 방법

GitHub MCP가 설치되면 다음 기능을 사용할 수 있습니다:

1. **이슈 관리**: 이슈 생성, 업데이트, 할당
2. **PR 관리**: Pull Request 생성 및 리뷰
3. **워크플로우 실행**: GitHub Actions 트리거
4. **릴리즈 관리**: 릴리즈 생성 및 태그 관리

### 초기화 명령

```bash
# GitHub MCP 초기화
github-mcp init

# 저장소 연결 확인
github-mcp verify

# 저장소 정보 조회
github-mcp info
```

## 3. MCP 서버 상태 확인

모든 MCP 서버의 상태를 확인하려면:

```bash
# MCP 상태 확인 스크립트 실행
npm run mcp:status

# 또는 개별 확인
npx context7 status
npx github-mcp status
```

## 4. 트러블슈팅

### Context7 MCP 문제 해결

- **API 키 오류**: Context7 대시보드에서 새 API 키 생성
- **분석 실패**: `.context7ignore` 파일로 제외 경로 설정
- **메모리 부족**: `--max-old-space-size=4096` 플래그 사용

### GitHub MCP 문제 해결

- **토큰 권한 부족**: GitHub 토큰의 권한 범위 확인
- **API 제한**: Rate limit 확인 및 대기
- **연결 실패**: 프록시 설정 확인

## 5. shadcn MCP 설치

shadcn MCP는 UI 컴포넌트 자동 설치 및 관리를 위한 도구입니다.

### 설치 방법

```bash
# NPM을 통한 설치
npm install -g @modelcontextprotocol/shadcn

# 또는 npx로 직접 실행
npx @modelcontextprotocol/shadcn
```

### 설정 파일 업데이트

`.MCP.json` 파일에서 shadcn 설정을 활성화:

```json
{
  "servers": {
    "shadcn": {
      "enabled": true,
      "installed": true
    }
  }
}
```

### 환경변수 설정

`.env.local` 파일에 shadcn 설정 추가:

```env
SHADCN_REGISTRY_URL=https://ui.shadcn.com/registry
SHADCN_COMPONENTS_PATH=./components/ui
SHADCN_UTILS_PATH=./lib/utils
```

### shadcn/ui 컴포넌트 설치

프로젝트에 필요한 기본 컴포넌트들을 설치:

```bash
# 기본 컴포넌트 일괄 설치
npm run shadcn:init

# 고급 컴포넌트까지 포함하여 설치
npm run shadcn:init -- --advanced

# 개별 컴포넌트 설치
npm run shadcn:add button
npm run shadcn:add card
npm run shadcn:add form
```

### 사용 방법

shadcn MCP가 설치되면 다음 기능을 사용할 수 있습니다:

1. **컴포넌트 자동 설치**: 필요한 UI 컴포넌트 자동 설치
2. **의존성 관리**: 컴포넌트 간 의존성 자동 해결
3. **테마 커스터마이징**: 브랜드에 맞는 색상 및 스타일 적용
4. **레지스트리 동기화**: 최신 컴포넌트 버전 유지

### 초기화 명령

```bash
# shadcn MCP 초기화
shadcn-mcp init

# 컴포넌트 상태 확인
shadcn-mcp status

# 컴포넌트 업데이트
shadcn-mcp update
```

## 6. 다음 단계

개발 도구 MCP 설치 후:

1. ✅ 프론트엔드 설정: shadcn MCP 설치 완료
2. 데이터베이스 설계 후 Supabase MCP 설치
3. 배포 준비 시 Vercel MCP 설치

각 단계별 MCP 설치는 해당 작업 진행 시 수행하세요.
