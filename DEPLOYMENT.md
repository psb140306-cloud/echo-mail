# Echo Mail Production Deployment Guide

## Prerequisites

### System Requirements
- **Server**: Ubuntu 20.04+ or similar Linux distribution
- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: Minimum 50GB SSD
- **Network**: Stable internet connection with static IP

### Required Services
- **Docker & Docker Compose**: Latest stable versions
- **PostgreSQL**: Version 15+ (managed service recommended)
- **Redis**: Version 7+ (managed service recommended)
- **Domain & SSL**: Valid domain with SSL certificate

## Pre-deployment Setup

### 1. Environment Configuration

1. Copy the production environment template:
   ```bash
   cp .env.production .env
   ```

2. Update all configuration values in `.env`:
   - Database URLs (PostgreSQL & Redis)
   - Authentication secrets
   - Email credentials (IMAP & SMTP)
   - SMS & KakaoTalk API keys
   - Payment gateway credentials

### 2. Database Setup

1. **Create PostgreSQL Database**:
   ```sql
   CREATE DATABASE echomail;
   CREATE USER echomail_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE echomail TO echomail_user;
   ```

2. **Configure Row Level Security** (for multi-tenancy):
   ```sql
   -- Enable RLS on tenant-specific tables
   ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
   ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
   ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
   -- ... (other tenant tables)
   ```

3. **Run Database Migrations**:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

### 3. Redis Configuration

1. **Configure Redis** with persistence and security:
   ```redis
   # /etc/redis/redis.conf
   requirepass your_secure_redis_password
   save 900 1
   save 300 10
   save 60 10000
   maxmemory 2gb
   maxmemory-policy allkeys-lru
   ```

### 4. Domain & SSL Setup

1. **Configure DNS**:
   ```
   A     echomail.your-domain.com    -> YOUR_SERVER_IP
   CNAME mail.echomail.your-domain.com -> echomail.your-domain.com
   ```

2. **SSL Certificate** (using Let's Encrypt):
   ```bash
   sudo certbot --nginx -d echomail.your-domain.com
   ```

## Deployment Methods

### Option 1: Vercel Deployment (Recommended for SaaS)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Configure Vercel Project**:
   ```bash
   vercel login
   vercel --prod
   ```

3. **Set Environment Variables**:
   ```bash
   vercel env add PRODUCTION
   # Add all variables from .env.production
   ```

4. **Deploy**:
   ```bash
   vercel --prod
   ```

5. **Configure Domains & SSL**:
   - Add custom domain in Vercel dashboard
   - SSL certificates are automatically managed

### Option 2: Docker Deployment (Self-hosted)

1. **Server Preparation**:
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Deploy Application**:
   ```bash
   # Clone repository
   git clone https://github.com/your-org/echo-mail.git
   cd echo-mail

   # Copy production environment
   cp .env.production .env

   # Edit environment variables
   nano .env

   # Deploy using deployment script
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

3. **Configure Nginx Reverse Proxy**:
   ```nginx
   # /etc/nginx/sites-available/echomail
   server {
       listen 80;
       server_name echomail.your-domain.com;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name echomail.your-domain.com;

       ssl_certificate /etc/letsencrypt/live/echomail.your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/echomail.your-domain.com/privkey.pem;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }

       location /api/health {
           proxy_pass http://localhost:3000;
           access_log off;
       }
   }
   ```

## Post-deployment Configuration

### 1. Cron Jobs Setup

For Vercel deployment, cron jobs are configured in `vercel.json`. For self-hosted:

```bash
# Add to crontab
crontab -e

# Check emails every 5 minutes
*/5 * * * * curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://echomail.your-domain.com/api/cron/check-emails

# Cleanup logs daily at 2 AM
0 2 * * * curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://echomail.your-domain.com/api/cron/cleanup-logs
```

### 2. Monitoring Setup

1. **Health Check Monitoring**:
   ```bash
   # Setup monitoring service (e.g., UptimeRobot, Pingdom)
   # Monitor: https://echomail.your-domain.com/api/health
   ```

2. **Log Monitoring** (Optional - Sentry):
   ```bash
   # Configure Sentry DSN in environment variables
   # Error tracking will be automatically enabled
   ```

3. **Performance Monitoring**:
   ```bash
   # Setup application performance monitoring
   # Monitor API response times, database queries, etc.
   ```

### 3. Backup Configuration

1. **Database Backups**:
   ```bash
   # Daily automated backups
   0 3 * * * /opt/scripts/backup-database.sh
   ```

2. **File Backups**:
   ```bash
   # Backup uploaded files and logs
   0 4 * * * /opt/scripts/backup-files.sh
   ```

### 4. Security Hardening

1. **Firewall Configuration**:
   ```bash
   sudo ufw allow ssh
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

2. **Fail2Ban Setup**:
   ```bash
   sudo apt install fail2ban
   # Configure fail2ban for nginx and ssh
   ```

3. **Security Headers** (Already configured in application):
   - CSP (Content Security Policy)
   - HSTS (HTTP Strict Transport Security)
   - X-Frame-Options
   - X-Content-Type-Options

## Verification

### 1. Application Health Check
```bash
curl https://echomail.your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" },
    "queue": { "status": "healthy" }
  }
}
```

### 2. Feature Testing
1. **Email Processing**: Send test email to configured address
2. **Notifications**: Verify SMS and KakaoTalk delivery
3. **Authentication**: Test login/logout functionality
4. **Team Management**: Test user invitations
5. **Billing**: Test invoice generation and payment methods

### 3. Performance Testing
```bash
# Load testing (using artillery or similar)
artillery quick --duration 60 --rate 10 https://echomail.your-domain.com
```

## Scaling Considerations

### Horizontal Scaling
- **Load Balancer**: Use Nginx or cloud load balancer
- **Multiple App Instances**: Scale web application horizontally
- **Database Read Replicas**: For read-heavy workloads
- **Redis Cluster**: For high-availability caching

### Vertical Scaling
- **Memory**: Increase RAM for better caching
- **CPU**: More cores for better concurrent processing
- **Storage**: SSD for faster I/O operations

## Maintenance

### Regular Tasks
- **Security Updates**: Monthly OS and dependency updates
- **Database Maintenance**: Weekly VACUUM and ANALYZE
- **Log Rotation**: Automated log cleanup via cron jobs
- **SSL Certificate Renewal**: Automated via Let's Encrypt
- **Backup Verification**: Monthly backup restore tests

### Monitoring Alerts
- **Application Errors**: >1% error rate
- **Response Time**: >2s average response time
- **Database**: Connection pool exhaustion
- **Memory**: >85% memory usage
- **Disk**: >80% disk usage

## Troubleshooting

### Common Issues
1. **Email Not Processing**: Check IMAP credentials and firewall
2. **Notifications Failing**: Verify SMS/KakaoTalk API credentials
3. **Database Connections**: Check connection pool settings
4. **High Memory Usage**: Enable garbage collection monitoring

### Log Locations
- **Application Logs**: `/var/log/echomail/app.log`
- **Nginx Logs**: `/var/log/nginx/access.log`
- **Database Logs**: PostgreSQL log directory
- **System Logs**: `/var/log/syslog`

## Support

For deployment assistance or issues:
- **Documentation**: Check project README.md
- **Health Status**: Monitor `/api/health` endpoint
- **Logs**: Review application and system logs
- **Community**: GitHub Issues for bug reports

---

**Important**: Always test deployments in a staging environment before production deployment.