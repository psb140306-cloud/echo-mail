#!/usr/bin/env node

/**
 * =============================================================================
 * Vercel 설정 자동화 스크립트
 * Echo Mail 프로젝트의 Vercel 배포 환경을 자동으로 설정합니다.
 * =============================================================================
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

// 로그 함수들
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`${colors.cyan}${colors.bright}${msg}${colors.reset}`),
}

class VercelSetup {
  constructor() {
    this.projectRoot = process.cwd()
    this.vercelConfigPath = path.join(this.projectRoot, 'vercel.json')
    this.envExamplePath = path.join(this.projectRoot, '.env.example')
  }

  // Vercel CLI 설치 확인
  checkVercelCLI() {
    try {
      execSync('vercel --version', { stdio: 'pipe' })
      log.success('Vercel CLI가 설치되어 있습니다.')
      return true
    } catch (error) {
      log.error('Vercel CLI가 설치되지 않았습니다.')
      return false
    }
  }

  // 로그인 상태 확인
  checkLoginStatus() {
    try {
      const result = execSync('vercel whoami', { stdio: 'pipe', encoding: 'utf8' })
      log.success(`Vercel에 로그인되어 있습니다: ${result.trim()}`)
      return true
    } catch (error) {
      log.warning('Vercel에 로그인되어 있지 않습니다.')
      return false
    }
  }

  // 프로젝트 링크 확인
  checkProjectLink() {
    const vercelDir = path.join(this.projectRoot, '.vercel')
    if (fs.existsSync(vercelDir)) {
      log.success('프로젝트가 Vercel에 연결되어 있습니다.')
      return true
    } else {
      log.warning('프로젝트가 Vercel에 연결되어 있지 않습니다.')
      return false
    }
  }

  // 환경 변수 템플릿 생성
  createEnvTemplate() {
    if (!fs.existsSync(this.envExamplePath)) {
      const envTemplate = `# =============================================================================
# Echo Mail Environment Variables Template
# Vercel 배포를 위한 환경 변수 설정 가이드
# =============================================================================

# Database
DATABASE_URL="postgresql://username:password@hostname:port/database"

# Redis
REDIS_URL="redis://username:password@hostname:port"

# NextAuth.js
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="your-nextauth-secret-here-32-chars-min"

# Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# SMS Configuration (예: 알리고)
SMS_API_KEY="your-sms-api-key"
SMS_USER_ID="your-sms-user-id"

# KakaoTalk Configuration
KAKAO_API_KEY="your-kakao-api-key"
KAKAO_ADMIN_KEY="your-kakao-admin-key"

# Application
APP_NAME="Echo Mail"
APP_URL="https://your-domain.vercel.app"
`

      fs.writeFileSync(this.envExamplePath, envTemplate)
      log.success('.env.example 파일이 생성되었습니다.')
    } else {
      log.info('.env.example 파일이 이미 존재합니다.')
    }
  }

  // Vercel 설정 검증
  validateVercelConfig() {
    if (fs.existsSync(this.vercelConfigPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(this.vercelConfigPath, 'utf8'))
        log.success('vercel.json 설정이 유효합니다.')

        // 주요 설정 확인
        if (config.framework === 'nextjs') {
          log.info('Next.js 프레임워크로 설정되어 있습니다.')
        }

        if (config.regions && config.regions.includes('icn1')) {
          log.info('한국 리전(ICN1)으로 설정되어 있습니다.')
        }

        return true
      } catch (error) {
        log.error('vercel.json 파일이 잘못된 형식입니다.')
        return false
      }
    } else {
      log.error('vercel.json 파일이 없습니다.')
      return false
    }
  }

  // 배포 스크립트 생성
  createDeploymentScripts() {
    const deployScript = `#!/bin/bash

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
`

    const deployScriptPath = path.join(this.projectRoot, 'scripts', 'deploy-vercel.sh')

    // scripts 디렉토리가 없으면 생성
    const scriptsDir = path.dirname(deployScriptPath)
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true })
    }

    fs.writeFileSync(deployScriptPath, deployScript)

    // 실행 권한 설정 (Unix 계열에서)
    try {
      execSync(`chmod +x "${deployScriptPath}"`)
    } catch (error) {
      // Windows에서는 무시
    }

    log.success('배포 스크립트가 생성되었습니다: scripts/deploy-vercel.sh')
  }

  // 환경 변수 설정 가이드 출력
  showEnvSetupGuide() {
    log.title('\n📋 Vercel 환경 변수 설정 가이드')
    console.log(`
다음 명령어들을 사용하여 Vercel에 환경 변수를 설정하세요:

${colors.yellow}# 데이터베이스 설정${colors.reset}
vercel env add DATABASE_URL production
vercel env add REDIS_URL production

${colors.yellow}# 인증 설정${colors.reset}
vercel env add NEXTAUTH_URL production
vercel env add NEXTAUTH_SECRET production

${colors.yellow}# 이메일 설정${colors.reset}
vercel env add SMTP_HOST production
vercel env add SMTP_PORT production
vercel env add SMTP_USER production
vercel env add SMTP_PASS production

${colors.yellow}# SMS/카카오톡 설정${colors.reset}
vercel env add SMS_API_KEY production
vercel env add SMS_USER_ID production
vercel env add KAKAO_API_KEY production
vercel env add KAKAO_ADMIN_KEY production

${colors.yellow}# 또는 .env.local 파일에서 일괄 업로드:${colors.reset}
vercel env pull .env.production.local

${colors.cyan}환경 변수 관리:${colors.reset}
- vercel env ls           # 환경 변수 목록 확인
- vercel env rm VAR_NAME  # 환경 변수 삭제
- vercel env pull         # 환경 변수 다운로드
`)
  }

  // 배포 가이드 출력
  showDeploymentGuide() {
    log.title('\n🚀 배포 가이드')
    console.log(`
${colors.cyan}배포 명령어:${colors.reset}
- npm run vercel:preview   # 프리뷰 배포
- npm run vercel:deploy    # 프로덕션 배포
- npm run vercel:dev       # 로컬 개발 서버 (Vercel 환경)

${colors.cyan}배포 단계:${colors.reset}
1. 환경 변수 설정: vercel env add [VAR_NAME] production
2. 프로젝트 링크: vercel link
3. 프리뷰 배포: vercel
4. 프로덕션 배포: vercel --prod

${colors.cyan}유용한 명령어:${colors.reset}
- vercel logs              # 배포 로그 확인
- vercel domains           # 도메인 관리
- vercel alias             # 도메인 별칭 설정
- vercel inspect [URL]     # 배포 상세 정보
`)
  }

  // 메인 실행 함수
  async run() {
    log.title('🔧 Echo Mail Vercel 설정을 시작합니다...\n')

    // 1. Vercel CLI 확인
    if (!this.checkVercelCLI()) {
      log.error('npm install -g vercel 명령어로 Vercel CLI를 설치해주세요.')
      return
    }

    // 2. 로그인 상태 확인
    if (!this.checkLoginStatus()) {
      log.info('vercel login 명령어로 로그인해주세요.')
    }

    // 3. 프로젝트 링크 확인
    this.checkProjectLink()

    // 4. 설정 파일들 생성/검증
    this.createEnvTemplate()
    this.validateVercelConfig()
    this.createDeploymentScripts()

    // 5. 가이드 출력
    this.showEnvSetupGuide()
    this.showDeploymentGuide()

    log.success('\n✨ Vercel 설정이 완료되었습니다!')
    log.info('가이드를 참고하여 환경 변수를 설정하고 배포를 진행해주세요.')
  }
}

// 스크립트 실행
if (require.main === module) {
  const setup = new VercelSetup()
  setup.run().catch((error) => {
    log.error(`설정 중 오류가 발생했습니다: ${error.message}`)
    process.exit(1)
  })
}

module.exports = VercelSetup
