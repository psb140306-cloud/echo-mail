#!/bin/bash

# =============================================================================
# Echo Mail Deployment Script
# =============================================================================

set -e  # 에러 발생 시 스크립트 중단

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="echomail"
BACKUP_DIR="/opt/backups"
DEPLOY_DIR="/opt/echomail"
IMAGE_NAME="echomail-app"
HEALTH_CHECK_URL="http://localhost:3000/api/health"
MAX_WAIT_TIME=300  # 5 minutes

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if service is healthy
check_health() {
    local url=$1
    local max_attempts=30
    local attempt=1

    log "Checking service health at $url"

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            success "Service is healthy!"
            return 0
        fi

        log "Health check attempt $attempt/$max_attempts failed, waiting 10 seconds..."
        sleep 10
        ((attempt++))
    done

    error "Service failed health check after $max_attempts attempts"
    return 1
}

# Function to create database backup
backup_database() {
    log "Creating database backup..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/echomail_backup_$timestamp.sql"

    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"

    # Create database backup
    docker exec echomail-postgres pg_dump -U postgres echomail > "$backup_file"

    if [ $? -eq 0 ]; then
        success "Database backup created: $backup_file"

        # Keep only last 10 backups
        ls -t "$BACKUP_DIR"/echomail_backup_*.sql | tail -n +11 | xargs -r rm
        log "Old backups cleaned up"
    else
        error "Failed to create database backup"
        return 1
    fi
}

# Function to pull latest images
pull_images() {
    log "Pulling latest Docker images..."

    if ! docker-compose pull; then
        error "Failed to pull Docker images"
        return 1
    fi

    success "Docker images pulled successfully"
}

# Function to run database migrations
run_migrations() {
    log "Running database migrations..."

    if ! docker-compose exec -T app npx prisma migrate deploy; then
        error "Database migration failed"
        return 1
    fi

    success "Database migrations completed"
}

# Function to deploy application
deploy_app() {
    log "Starting application deployment..."

    # Build and start services
    if ! docker-compose up -d --build; then
        error "Failed to start application"
        return 1
    fi

    success "Application containers started"
}

# Function to verify deployment
verify_deployment() {
    log "Verifying deployment..."

    # Check if all containers are running
    local failed_containers=$(docker-compose ps --services --filter "status=exited")

    if [ ! -z "$failed_containers" ]; then
        error "Some containers failed to start: $failed_containers"
        return 1
    fi

    # Check application health
    if ! check_health "$HEALTH_CHECK_URL"; then
        return 1
    fi

    success "Deployment verification completed"
}

# Function to rollback deployment
rollback() {
    warning "Rolling back deployment..."

    # Stop current containers
    docker-compose down

    # Restore from backup (if needed)
    local latest_backup=$(ls -t "$BACKUP_DIR"/echomail_backup_*.sql | head -n 1)

    if [ ! -z "$latest_backup" ]; then
        log "Restoring database from backup: $latest_backup"
        docker exec -i echomail-postgres psql -U postgres -d echomail < "$latest_backup"
    fi

    # Start with previous version
    docker-compose up -d

    warning "Rollback completed"
}

# Function to cleanup old images
cleanup() {
    log "Cleaning up old Docker images..."

    # Remove dangling images
    docker image prune -f

    # Remove old images (keep last 3 versions)
    docker images "$IMAGE_NAME" --format "table {{.Repository}}:{{.Tag}} {{.CreatedAt}}" | \
    tail -n +4 | awk '{print $1}' | xargs -r docker rmi

    success "Cleanup completed"
}

# Function to send deployment notification
send_notification() {
    local status=$1
    local message=$2

    if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚀 Echo Mail Deployment: $status\\n$message\"}" \
        "$SLACK_WEBHOOK_URL"
    fi

    if [ ! -z "$TEAMS_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚀 Echo Mail Deployment: $status\\n$message\"}" \
        "$TEAMS_WEBHOOK_URL"
    fi
}

# Main deployment function
main() {
    local deployment_start_time=$(date +%s)

    log "Starting Echo Mail deployment..."

    # Change to project directory
    cd "$DEPLOY_DIR" || {
        error "Failed to change to deployment directory: $DEPLOY_DIR"
        exit 1
    }

    # Create database backup
    if ! backup_database; then
        error "Backup failed, aborting deployment"
        exit 1
    fi

    # Pull latest images
    if ! pull_images; then
        error "Failed to pull images"
        exit 1
    fi

    # Run database migrations
    if ! run_migrations; then
        error "Database migration failed"
        rollback
        send_notification "FAILED" "Database migration failed, rolled back"
        exit 1
    fi

    # Deploy application
    if ! deploy_app; then
        error "Application deployment failed"
        rollback
        send_notification "FAILED" "Application deployment failed, rolled back"
        exit 1
    fi

    # Verify deployment
    if ! verify_deployment; then
        error "Deployment verification failed"
        rollback
        send_notification "FAILED" "Deployment verification failed, rolled back"
        exit 1
    fi

    # Cleanup old images
    cleanup

    local deployment_end_time=$(date +%s)
    local deployment_duration=$((deployment_end_time - deployment_start_time))

    success "Deployment completed successfully in ${deployment_duration} seconds"
    send_notification "SUCCESS" "Deployment completed in ${deployment_duration} seconds"
}

# Handle script arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    rollback)
        rollback
        ;;
    health)
        check_health "$HEALTH_CHECK_URL"
        ;;
    backup)
        backup_database
        ;;
    cleanup)
        cleanup
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|health|backup|cleanup}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Run full deployment (default)"
        echo "  rollback - Rollback to previous version"
        echo "  health   - Check application health"
        echo "  backup   - Create database backup"
        echo "  cleanup  - Clean up old Docker images"
        exit 1
        ;;
esac