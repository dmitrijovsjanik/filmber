# DevOps Configuration (VPS + PM2)

## Infrastructure Overview

```yaml
filmber_infrastructure:
  hosting: VPS (single server)
  process_manager: PM2
  web_server: Node.js (custom server)
  database: PostgreSQL (managed)
  ci_cd: GitHub Actions
  deployment: Rolling releases with rollback
```

---

## Parallel DevOps Operations

```
[BatchTool - Infrastructure]:
  // All operations in ONE message
  - Write(".github/workflows/deploy.yml", deployWorkflow)
  - Write(".github/workflows/ci.yml", ciWorkflow)
  - Write("ecosystem.config.js", pm2Config)
  - Write("scripts/deploy.sh", deployScript)
  - Write("scripts/backup.sh", backupScript)
```

---

## CI/CD Pipeline Configuration

### Build Stages (Parallel Execution)
```yaml
build_stages:
  lint_and_typecheck:
    - "npm run lint"
    - "npm run typecheck"

  test:
    - "npm run test:ci"

  build:
    - "npm run build"

  security:
    - "npm audit --audit-level=high"

  deploy:
    - "scp deploy.tar.gz to VPS"
    - "pm2 restart filmber"
```

### Environment Configuration
```bash
# Development
DATABASE_URL=postgresql://localhost:5432/filmber_dev
TMDB_ACCESS_TOKEN=dev_token
TELEGRAM_BOT_TOKEN=dev_bot_token
JWT_SECRET=dev_secret
NODE_ENV=development

# Production
DATABASE_URL=${DATABASE_URL}
TMDB_ACCESS_TOKEN=${TMDB_ACCESS_TOKEN}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
```

---

## PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'filmber',
    script: 'tsx',
    args: 'server/index.ts',
    cwd: '/var/www/filmber/current',
    instances: 1,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '500M',
    error_file: '/var/www/filmber/logs/error.log',
    out_file: '/var/www/filmber/logs/out.log',
    merge_logs: true,
    time: true
  }]
};
```

### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs filmber --lines 100

# Monitor resources
pm2 monit

# Restart with zero downtime
pm2 reload filmber

# Save process list
pm2 save

# Startup script
pm2 startup
```

---

## Deployment Script

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

APP_DIR="/var/www/filmber"
RELEASE_TIMESTAMP=$(date +%Y%m%d%H%M%S)
RELEASE_DIR="${APP_DIR}/releases/${RELEASE_TIMESTAMP}"

echo "Starting deployment ${RELEASE_TIMESTAMP}..."

# Create release directory
mkdir -p "${RELEASE_DIR}"

# Extract deployment package
tar -xzf /tmp/deploy.tar.gz -C "${RELEASE_DIR}"

# Link shared resources
ln -sf "${APP_DIR}/shared/.env" "${RELEASE_DIR}/.env"
ln -sf "${APP_DIR}/shared/uploads" "${RELEASE_DIR}/public/uploads"

# Run database migrations
cd "${RELEASE_DIR}"
source "${APP_DIR}/shared/.env"
npx drizzle-kit migrate || echo "No migrations"

# Switch release
ln -sfn "${RELEASE_DIR}" "${APP_DIR}/current"

# Restart PM2
cd "${APP_DIR}/current"
pm2 delete filmber 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# Cleanup old releases (keep 5)
cd "${APP_DIR}/releases"
ls -1t | tail -n +6 | xargs -r rm -rf

echo "Deployment completed!"
```

---

## Backup Configuration

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/var/www/filmber/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Database backup
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

# Uploads backup
tar -czf "$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz" /var/www/filmber/shared/uploads

# Cleanup old backups
find "$BACKUP_DIR" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: ${TIMESTAMP}"
```

---

## Monitoring & Health Checks

### Health Endpoint
```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Check database connection
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: (error as Error).message },
      { status: 503 }
    );
  }
}
```

### Alert Thresholds
```typescript
const alertThresholds = {
  error_rate: 0.05,        // 5% error rate
  response_time_p95: 500,  // 500ms
  memory_usage: 0.85,      // 85%
  cpu_usage: 0.80,         // 80%
  disk_usage: 0.90         // 90%
};
```

---

## Monitoring & Analytics

### Frontend Monitoring
```typescript
const monitoring = {
  performance: "Yandex Metrica + Core Web Vitals",
  errors: "Console logging + future Sentry integration",
  analytics: "Yandex Metrica custom events",
  user_experience: "Swipe success rate, match rate tracking"
};
```

### Backend Monitoring
```typescript
const backendMonitoring = {
  api_performance: "Response time logging in API routes",
  database: "Drizzle query performance",
  socket: "Connection count, event latency",
  health_checks: "/api/health endpoint"
};
```

---

## Security Hardening (VPS)

### Server Security Checklist
- [ ] SSH key-only authentication
- [ ] Firewall (UFW) enabled
- [ ] Fail2ban configured
- [ ] Automatic security updates
- [ ] HTTPS enforced (nginx/certbot)
- [ ] Database not exposed externally

### Nginx Configuration
```nginx
# /etc/nginx/sites-available/filmber
server {
    listen 80;
    server_name filmber.app;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name filmber.app;

    ssl_certificate /etc/letsencrypt/live/filmber.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/filmber.app/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

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

    # WebSocket support for Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Static files (posters)
    location /uploads/ {
        alias /var/www/filmber/shared/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Environment Security
```bash
# .env file permissions
chmod 600 /var/www/filmber/shared/.env

# Never commit secrets
# Use GitHub Secrets for CI/CD

# Required secrets in GitHub:
# - VPS_HOST
# - VPS_USER
# - VPS_SSH_KEY
# - VPS_PORT
```

---

## Disaster Recovery

### Recovery Procedures
```bash
# 1. Rollback to previous release
APP_DIR="/var/www/filmber"
PREV_RELEASE=$(ls -1t "${APP_DIR}/releases" | sed -n '2p')
ln -sfn "${APP_DIR}/releases/${PREV_RELEASE}" "${APP_DIR}/current"
pm2 restart filmber

# 2. Restore database from backup
gunzip < /path/to/backup.sql.gz | psql $DATABASE_URL

# 3. Restore uploads
tar -xzf /path/to/uploads_backup.tar.gz -C /var/www/filmber/shared/
```

### RTO/RPO Targets
```yaml
recovery_objectives:
  rto: 30 minutes  # Recovery Time Objective
  rpo: 24 hours    # Recovery Point Objective (daily backups)

backup_schedule:
  database: daily at 03:00 UTC
  uploads: daily at 03:30 UTC
  retention: 7 days
```

---

## Future Scaling Options

### When to Scale
```yaml
scaling_triggers:
  concurrent_users: "> 1000"
  response_time_p95: "> 500ms"
  cpu_usage: "> 80% sustained"
  memory_usage: "> 85% sustained"
```

### Scaling Path
```
Current (VPS + PM2)
       ↓
Option A: Vertical scaling (bigger VPS)
       ↓
Option B: Add Redis for session/cache
       ↓
Option C: Database managed service (Neon, Supabase)
       ↓
Option D: Container orchestration (Docker Compose → K8s)
```

### Performance Checklist
- [ ] Enable response compression (gzip)
- [ ] Implement CDN for static assets
- [ ] Add Redis for caching
- [ ] Enable connection pooling
- [ ] Optimize database indexes
- [ ] Implement rate limiting
