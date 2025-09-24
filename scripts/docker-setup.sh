#!/bin/bash

# =============================================================================
# Echo Mail Docker Setup Script
# Docker 환경 설정 및 초기화 스크립트
# =============================================================================

set -e

echo "🚀 Echo Mail Docker 환경 설정을 시작합니다..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 함수 정의
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Docker 및 Docker Compose 설치 확인
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker가 설치되지 않았습니다. Docker를 먼저 설치해주세요."
        exit 1
    fi

    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose가 설치되지 않았습니다. Docker Compose를 먼저 설치해주세요."
        exit 1
    fi

    print_status "Docker 및 Docker Compose 설치 확인 완료"
}

# 환경 변수 파일 생성
create_env_files() {
    if [ ! -f .env.local ]; then
        print_warning ".env.local 파일이 없습니다. 템플릿을 생성합니다..."
        cat > .env.local << EOF
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/echomail"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-here"

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
APP_URL="http://localhost:3000"
EOF
        print_status ".env.local 파일이 생성되었습니다. 필요한 값들을 설정해주세요."
    else
        print_status ".env.local 파일이 이미 존재합니다."
    fi
}

# Docker 네트워크 및 볼륨 생성
setup_docker_resources() {
    print_status "Docker 네트워크 및 볼륨을 설정합니다..."

    # 네트워크 생성 (이미 존재하면 무시)
    docker network create echomail-network 2>/dev/null || true

    # 볼륨 생성 (이미 존재하면 무시)
    docker volume create echomail-postgres-data 2>/dev/null || true
    docker volume create echomail-redis-data 2>/dev/null || true

    print_status "Docker 리소스 설정 완료"
}

# 개발 환경 실행
start_dev_environment() {
    print_status "개발 환경을 시작합니다..."
    docker compose -f docker-compose.dev.yml up -d

    # 서비스 상태 확인
    echo "서비스 상태를 확인합니다..."
    sleep 5
    docker compose -f docker-compose.dev.yml ps

    print_status "개발 환경이 시작되었습니다!"
    echo ""
    echo "📁 서비스 접속 정보:"
    echo "   - 애플리케이션: http://localhost:3000"
    echo "   - PostgreSQL: localhost:5432"
    echo "   - Redis: localhost:6379"
    echo ""
    echo "📋 유용한 명령어:"
    echo "   - 로그 확인: docker compose -f docker-compose.dev.yml logs -f"
    echo "   - 서비스 중지: docker compose -f docker-compose.dev.yml down"
    echo "   - 데이터베이스 접속: docker exec -it echomail-dev-postgres psql -U postgres -d echomail_dev"
}

# 프로덕션 환경 실행
start_prod_environment() {
    print_status "프로덕션 환경을 시작합니다..."
    docker compose up -d

    # 서비스 상태 확인
    echo "서비스 상태를 확인합니다..."
    sleep 10
    docker compose ps

    print_status "프로덕션 환경이 시작되었습니다!"
    echo ""
    echo "📁 서비스 접속 정보:"
    echo "   - 애플리케이션: http://localhost:3000"
    echo "   - PostgreSQL: localhost:5432"
    echo "   - Redis: localhost:6379"
    echo "   - Redis Commander: http://localhost:8081 (tools 프로필)"
    echo "   - pgAdmin: http://localhost:5050 (tools 프로필)"
    echo "   - Prometheus: http://localhost:9090 (monitoring 프로필)"
    echo "   - Grafana: http://localhost:3001 (monitoring 프로필)"
}

# 메뉴 출력
show_menu() {
    echo ""
    echo "🐳 Echo Mail Docker 환경 설정"
    echo ""
    echo "1. 개발 환경 시작 (최소 구성)"
    echo "2. 프로덕션 환경 시작 (전체 서비스)"
    echo "3. 모니터링 도구 포함 시작"
    echo "4. 관리 도구 포함 시작"
    echo "5. 전체 환경 정리"
    echo "6. 종료"
    echo ""
    read -p "선택하세요 (1-6): " choice
}

# 스크립트 실행
main() {
    check_docker
    create_env_files
    setup_docker_resources

    while true; do
        show_menu
        case $choice in
            1)
                start_dev_environment
                ;;
            2)
                start_prod_environment
                ;;
            3)
                print_status "모니터링 도구와 함께 시작합니다..."
                docker compose --profile monitoring up -d
                ;;
            4)
                print_status "관리 도구와 함께 시작합니다..."
                docker compose --profile tools up -d
                ;;
            5)
                print_warning "모든 컨테이너와 볼륨을 정리합니다..."
                docker compose down -v
                docker compose -f docker-compose.dev.yml down -v
                print_status "환경 정리 완료"
                ;;
            6)
                print_status "스크립트를 종료합니다."
                exit 0
                ;;
            *)
                print_error "잘못된 선택입니다."
                ;;
        esac
        echo ""
        read -p "Enter 키를 눌러서 계속하세요..."
    done
}

# 스크립트 시작
main