#!/bin/bash

# =============================================================================
# Echo Mail Blue-Green Deployment Script
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PROJECT_NAME="echomail"
DEPLOY_DIR="/opt/echomail"
HEALTH_CHECK_URL="http://localhost:3000/api/health"
NEW_VERSION=${1:-latest}

# Logging functions
log() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Function to check current active environment
get_active_environment() {
    if docker-compose -f docker-compose.blue.yml ps | grep -q "Up"; then
        echo "blue"
    elif docker-compose -f docker-compose.green.yml ps | grep -q "Up"; then
        echo "green"
    else
        echo "none"
    fi
}

# Function to get inactive environment
get_inactive_environment() {
    local active=$(get_active_environment)
    case $active in
        blue) echo "green" ;;
        green) echo "blue" ;;
        none) echo "blue" ;;
    esac
}

# Function to check service health
check_health() {
    local port=$1
    local max_attempts=30
    local attempt=1

    log "Checking service health on port $port"

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:$port/api/health" > /dev/null 2>&1; then
            success "Service on port $port is healthy!"
            return 0
        fi

        log "Health check attempt $attempt/$max_attempts failed, waiting 10 seconds..."
        sleep 10
        ((attempt++))
    done

    error "Service on port $port failed health check"
    return 1
}

# Function to deploy to inactive environment
deploy_inactive() {
    local inactive_env=$(get_inactive_environment)
    local compose_file="docker-compose.$inactive_env.yml"

    log "Deploying to $inactive_env environment using $compose_file"

    # Update environment-specific compose file
    if [ "$inactive_env" = "blue" ]; then
        export APP_PORT=3000
        export NGINX_PORT=80
    else
        export APP_PORT=3001
        export NGINX_PORT=81
    fi

    # Create environment-specific compose file
    cat > "$compose_file" << EOF
version: '3.8'

services:
  app-$inactive_env:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    container_name: echomail-app-$inactive_env
    ports:
      - "$APP_PORT:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}
      - REDIS_URL=\${REDIS_URL}
      - NEXTAUTH_URL=\${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=\${NEXTAUTH_SECRET}
    volumes:
      - ./logs:/app/logs
    networks:
      - echomail-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx-$inactive_env:
    image: nginx:alpine
    container_name: echomail-nginx-$inactive_env
    ports:
      - "$NGINX_PORT:80"
    volumes:
      - ./config/nginx.$inactive_env.conf:/etc/nginx/nginx.conf
    depends_on:
      - app-$inactive_env
    networks:
      - echomail-network
    restart: unless-stopped

networks:
  echomail-network:
    external: true
EOF

    # Deploy to inactive environment
    if ! docker-compose -f "$compose_file" up -d --build; then
        error "Failed to deploy to $inactive_env environment"
        return 1
    fi

    # Wait for service to be ready
    if ! check_health "$APP_PORT"; then
        error "Health check failed for $inactive_env environment"
        docker-compose -f "$compose_file" down
        return 1
    fi

    success "$inactive_env environment deployed successfully"
    return 0
}

# Function to switch traffic
switch_traffic() {
    local new_active_env=$(get_inactive_environment)
    local old_active_env=$(get_active_environment)

    log "Switching traffic from $old_active_env to $new_active_env"

    # Update load balancer configuration
    if [ "$new_active_env" = "blue" ]; then
        export ACTIVE_PORT=3000
        export ACTIVE_NGINX_PORT=80
    else
        export ACTIVE_PORT=3001
        export ACTIVE_NGINX_PORT=81
    fi

    # Create main nginx configuration pointing to new environment
    cat > "./config/nginx.conf" << EOF
events {
    worker_connections 1024;
}

http {
    upstream echomail_backend {
        server app-$new_active_env:3000;
    }

    server {
        listen 80;
        server_name _;

        location / {
            proxy_pass http://echomail_backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        location /api/health {
            proxy_pass http://echomail_backend/api/health;
            access_log off;
        }
    }
}
EOF

    # Reload main nginx
    if docker-compose exec nginx nginx -s reload; then
        success "Traffic switched to $new_active_env environment"

        # Wait a bit for traffic to settle
        sleep 30

        # Verify new environment is serving traffic
        if check_health "80"; then
            success "Traffic switch verification completed"
            return 0
        else
            error "Traffic switch verification failed"
            return 1
        fi
    else
        error "Failed to reload nginx configuration"
        return 1
    fi
}

# Function to cleanup old environment
cleanup_old() {
    local old_env=$(get_active_environment)
    local old_compose_file="docker-compose.$old_env.yml"

    if [ "$old_env" != "none" ] && [ -f "$old_compose_file" ]; then
        warning "Stopping and removing old $old_env environment"

        # Stop old environment
        docker-compose -f "$old_compose_file" down

        # Remove old compose file
        rm -f "$old_compose_file"

        success "Old $old_env environment cleaned up"
    fi
}

# Function to rollback
rollback() {
    local current_env=$(get_active_environment)
    local rollback_env=$(get_inactive_environment)

    warning "Rolling back from $current_env to $rollback_env"

    if [ -f "docker-compose.$rollback_env.yml" ]; then
        # Start rollback environment
        docker-compose -f "docker-compose.$rollback_env.yml" up -d

        # Check health
        if [ "$rollback_env" = "blue" ]; then
            local rollback_port=3000
        else
            local rollback_port=3001
        fi

        if check_health "$rollback_port"; then
            # Switch traffic back
            switch_traffic
            success "Rollback completed successfully"
        else
            error "Rollback environment failed health check"
            return 1
        fi
    else
        error "No rollback environment available"
        return 1
    fi
}

# Function to run smoke tests
run_smoke_tests() {
    local test_port=$1

    log "Running smoke tests against port $test_port"

    # Basic connectivity test
    if ! curl -f -s "http://localhost:$test_port/api/health" > /dev/null; then
        error "Smoke test failed: Health endpoint not responding"
        return 1
    fi

    # Test main page
    if ! curl -f -s "http://localhost:$test_port/" > /dev/null; then
        error "Smoke test failed: Main page not responding"
        return 1
    fi

    # Test API endpoints
    local api_endpoints=(
        "/api/companies"
        "/api/contacts"
        "/api/notifications/status"
    )

    for endpoint in "${api_endpoints[@]}"; do
        if ! curl -f -s "http://localhost:$test_port$endpoint" > /dev/null; then
            warning "Smoke test warning: $endpoint not responding (might require auth)"
        fi
    done

    success "Smoke tests completed"
    return 0
}

# Main deployment function
main() {
    log "Starting Blue-Green deployment for Echo Mail"
    log "Target version: $NEW_VERSION"

    local active_env=$(get_active_environment)
    local inactive_env=$(get_inactive_environment)

    log "Current active environment: $active_env"
    log "Deploying to inactive environment: $inactive_env"

    # Change to deployment directory
    cd "$DEPLOY_DIR" || {
        error "Failed to change to deployment directory: $DEPLOY_DIR"
        exit 1
    }

    # Deploy to inactive environment
    if ! deploy_inactive; then
        error "Deployment to inactive environment failed"
        exit 1
    fi

    # Run smoke tests on inactive environment
    local test_port
    if [ "$inactive_env" = "blue" ]; then
        test_port=3000
    else
        test_port=3001
    fi

    if ! run_smoke_tests "$test_port"; then
        error "Smoke tests failed, aborting deployment"
        docker-compose -f "docker-compose.$inactive_env.yml" down
        exit 1
    fi

    # Switch traffic to new environment
    if ! switch_traffic; then
        error "Traffic switch failed, rolling back"
        docker-compose -f "docker-compose.$inactive_env.yml" down
        exit 1
    fi

    # Run final verification
    if ! run_smoke_tests "80"; then
        error "Final verification failed, rolling back"
        rollback
        exit 1
    fi

    # Cleanup old environment
    cleanup_old

    success "Blue-Green deployment completed successfully"
    log "New active environment: $(get_active_environment)"
}

# Handle script arguments
case "${1:-deploy}" in
    deploy)
        if [ -z "$2" ]; then
            error "Usage: $0 deploy <version>"
            exit 1
        fi
        NEW_VERSION="$2"
        main
        ;;
    rollback)
        rollback
        ;;
    status)
        active=$(get_active_environment)
        inactive=$(get_inactive_environment)
        echo "Active environment: $active"
        echo "Inactive environment: $inactive"
        ;;
    cleanup)
        cleanup_old
        ;;
    test)
        if [ -z "$2" ]; then
            run_smoke_tests "80"
        else
            run_smoke_tests "$2"
        fi
        ;;
    *)
        echo "Usage: $0 {deploy <version>|rollback|status|cleanup|test [port]}"
        echo ""
        echo "Commands:"
        echo "  deploy <version> - Deploy specified version using blue-green strategy"
        echo "  rollback         - Rollback to previous environment"
        echo "  status          - Show current environment status"
        echo "  cleanup         - Clean up old environment"
        echo "  test [port]     - Run smoke tests (default port: 80)"
        exit 1
        ;;
esac