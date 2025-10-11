#!/bin/bash

# =============================================================================
# Echo Mail Production Setup Script
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        error "Please do not run this script as root"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."

    # Check OS
    if ! command -v lsb_release &> /dev/null; then
        error "This script requires a Linux distribution with lsb_release"
        exit 1
    fi

    local os_version=$(lsb_release -rs)
    log "Operating System: $(lsb_release -ds)"

    # Check memory
    local memory_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local memory_gb=$((memory_kb / 1024 / 1024))

    if [ $memory_gb -lt 4 ]; then
        warning "System has ${memory_gb}GB RAM. Minimum 4GB recommended."
    else
        success "Memory check passed: ${memory_gb}GB RAM"
    fi

    # Check disk space
    local disk_space=$(df / | tail -1 | awk '{print $4}')
    local disk_space_gb=$((disk_space / 1024 / 1024))

    if [ $disk_space_gb -lt 20 ]; then
        error "Insufficient disk space. Need at least 20GB, available: ${disk_space_gb}GB"
        exit 1
    else
        success "Disk space check passed: ${disk_space_gb}GB available"
    fi
}

# Install Docker and Docker Compose
install_docker() {
    log "Installing Docker and Docker Compose..."

    if command -v docker &> /dev/null; then
        success "Docker is already installed"
    else
        log "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        success "Docker installed successfully"
    fi

    if command -v docker-compose &> /dev/null; then
        success "Docker Compose is already installed"
    else
        log "Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        success "Docker Compose installed successfully"
    fi
}

# Install Node.js and npm
install_nodejs() {
    log "Installing Node.js..."

    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        success "Node.js is already installed: $node_version"
    else
        # Install Node.js 18 LTS
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
        success "Node.js installed successfully"
    fi

    # Install global packages
    sudo npm install -g npm@latest
    sudo npm install -g vercel@latest
}

# Setup application directories
setup_directories() {
    log "Setting up application directories..."

    sudo mkdir -p /opt/echomail/{data/{postgres,redis},logs,backups,uploads}
    sudo chown -R $USER:$USER /opt/echomail
    chmod 755 /opt/echomail

    # Create log directories
    mkdir -p /opt/echomail/logs/{app,nginx,postgres,redis}

    success "Application directories created"
}

# Setup firewall
setup_firewall() {
    log "Configuring firewall..."

    if command -v ufw &> /dev/null; then
        sudo ufw --force reset
        sudo ufw default deny incoming
        sudo ufw default allow outgoing

        # Allow SSH (change port if needed)
        sudo ufw allow ssh

        # Allow HTTP and HTTPS
        sudo ufw allow 80
        sudo ufw allow 443

        # Enable firewall
        sudo ufw --force enable

        success "Firewall configured successfully"
    else
        warning "UFW firewall not found. Please configure firewall manually."
    fi
}

# Install SSL certificate
setup_ssl() {
    local domain=$1

    if [ -z "$domain" ]; then
        warning "No domain provided. SSL setup skipped."
        return 0
    fi

    log "Setting up SSL certificate for $domain..."

    # Install certbot
    if ! command -v certbot &> /dev/null; then
        sudo apt update
        sudo apt install -y certbot python3-certbot-nginx
    fi

    # Get certificate
    sudo certbot certonly --standalone -d $domain --non-interactive --agree-tos --email admin@$domain

    if [ $? -eq 0 ]; then
        success "SSL certificate obtained for $domain"
    else
        error "Failed to obtain SSL certificate"
        return 1
    fi
}

# Setup environment file
setup_environment() {
    log "Setting up environment configuration..."

    if [ ! -f .env ]; then
        if [ -f .env.production ]; then
            cp .env.production .env
            log "Copied .env.production to .env"
        else
            error ".env.production template not found"
            exit 1
        fi
    fi

    warning "Please edit .env file with your production configuration:"
    echo "  - Database URLs"
    echo "  - API keys and secrets"
    echo "  - Domain settings"
    echo "  - Email credentials"

    read -p "Press Enter after editing .env file..."
}

# Initialize database
setup_database() {
    log "Setting up database..."

    # Install PostgreSQL client
    if ! command -v psql &> /dev/null; then
        sudo apt update
        sudo apt install -y postgresql-client
    fi

    # Generate Prisma client
    npm install
    npx prisma generate

    log "Database setup completed"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."

    # Install monitoring tools
    sudo apt update
    sudo apt install -y htop iotop nethogs

    # Setup log rotation
    sudo tee /etc/logrotate.d/echomail > /dev/null <<EOF
/opt/echomail/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        docker-compose -f /opt/echomail/docker-compose.prod.yml restart app
    endscript
}
EOF

    success "Monitoring and log rotation configured"
}

# Setup backup cron jobs
setup_backups() {
    log "Setting up backup cron jobs..."

    # Create backup script
    sudo tee /opt/echomail/scripts/backup.sh > /dev/null <<'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/echomail/backups"

# Database backup
docker exec echomail-postgres-prod pg_dump -U postgres echomail > $BACKUP_DIR/db_backup_$DATE.sql

# Compress and cleanup old backups
gzip $BACKUP_DIR/db_backup_$DATE.sql
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
EOF

    chmod +x /opt/echomail/scripts/backup.sh

    # Add to crontab
    (crontab -l 2>/dev/null; echo "0 2 * * * /opt/echomail/scripts/backup.sh") | crontab -

    success "Backup cron jobs configured"
}

# Main setup function
main() {
    local domain=${1:-""}

    log "Starting Echo Mail production setup..."

    check_root
    check_requirements
    install_docker
    install_nodejs
    setup_directories
    setup_firewall

    if [ ! -z "$domain" ]; then
        setup_ssl "$domain"
    fi

    setup_environment
    setup_database
    setup_monitoring
    setup_backups

    success "Production setup completed!"

    echo ""
    warning "Next steps:"
    echo "1. Copy your project files to /opt/echomail/"
    echo "2. Edit /opt/echomail/.env with your configuration"
    echo "3. Run deployment: cd /opt/echomail && ./scripts/deploy.sh"
    echo "4. Setup monitoring and alerting"
    echo "5. Configure backup verification"
}

# Help function
show_help() {
    echo "Usage: $0 [DOMAIN]"
    echo ""
    echo "Setup Echo Mail for production deployment"
    echo ""
    echo "Arguments:"
    echo "  DOMAIN    Optional domain name for SSL certificate setup"
    echo ""
    echo "Examples:"
    echo "  $0                           # Setup without SSL"
    echo "  $0 echomail.yourdomain.com   # Setup with SSL for domain"
}

# Handle command line arguments
case "${1:-setup}" in
    help|--help|-h)
        show_help
        ;;
    setup|"")
        main "${2:-}"
        ;;
    *)
        main "$1"
        ;;
esac