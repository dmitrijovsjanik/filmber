#!/bin/bash
#
# Filmber VPS Setup Script
# Автоматическая настройка Ubuntu VPS для деплоя Next.js + Socket.io + PostgreSQL
#
# Использование: bash setup-vps.sh
# Запускать от root на свежем Ubuntu 22.04/24.04 VPS
#

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
DOMAIN="filmber.online"
APP_USER="filmber"
APP_DIR="/var/www/filmber"
NODE_VERSION="20"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Filmber VPS Setup Script                               ║${NC}"
echo -e "${BLUE}║     Настройка сервера для Next.js + Socket.io + PostgreSQL ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Ошибка: Запустите скрипт от root (sudo bash setup-vps.sh)${NC}"
    exit 1
fi

# Запрос данных
echo -e "${YELLOW}=== Настройка параметров ===${NC}"
echo ""

# PostgreSQL пароль
echo -e "${BLUE}Введите пароль для PostgreSQL (будет использоваться для базы данных):${NC}"
read -s DB_PASSWORD
echo ""
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Ошибка: Пароль не может быть пустым${NC}"
    exit 1
fi

# TMDB API
echo -e "${BLUE}Введите TMDB API Key (https://www.themoviedb.org/settings/api):${NC}"
read TMDB_API_KEY
if [ -z "$TMDB_API_KEY" ]; then
    echo -e "${YELLOW}Предупреждение: TMDB API Key не указан, можно добавить позже${NC}"
    TMDB_API_KEY="your_tmdb_api_key"
fi

echo -e "${BLUE}Введите TMDB Access Token (Bearer token):${NC}"
read TMDB_ACCESS_TOKEN
if [ -z "$TMDB_ACCESS_TOKEN" ]; then
    TMDB_ACCESS_TOKEN="your_tmdb_access_token"
fi

# OMDB API
echo -e "${BLUE}Введите OMDB API Key (https://www.omdbapi.com/apikey.aspx):${NC}"
read OMDB_API_KEY
if [ -z "$OMDB_API_KEY" ]; then
    echo -e "${YELLOW}Предупреждение: OMDB API Key не указан, можно добавить позже${NC}"
    OMDB_API_KEY="your_omdb_api_key"
fi

echo ""
echo -e "${GREEN}Конфигурация:${NC}"
echo -e "  Домен: ${DOMAIN}"
echo -e "  Пользователь: ${APP_USER}"
echo -e "  Директория: ${APP_DIR}"
echo -e "  Node.js: v${NODE_VERSION}"
echo ""
echo -e "${YELLOW}Начинаем установку через 5 секунд... (Ctrl+C для отмены)${NC}"
sleep 5

# ============================================
# 1. Обновление системы
# ============================================
echo -e "\n${BLUE}[1/10] Обновление системы...${NC}"
apt update
apt upgrade -y
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# ============================================
# 2. Создание пользователя
# ============================================
echo -e "\n${BLUE}[2/10] Создание пользователя ${APP_USER}...${NC}"
if id "$APP_USER" &>/dev/null; then
    echo -e "${YELLOW}Пользователь ${APP_USER} уже существует${NC}"
else
    useradd -m -s /bin/bash "$APP_USER"
    usermod -aG sudo "$APP_USER"
    echo -e "${GREEN}Пользователь ${APP_USER} создан${NC}"
fi

# ============================================
# 3. Установка Node.js
# ============================================
echo -e "\n${BLUE}[3/10] Установка Node.js ${NODE_VERSION}...${NC}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs
echo -e "${GREEN}Node.js $(node -v) установлен${NC}"
echo -e "${GREEN}npm $(npm -v) установлен${NC}"

# ============================================
# 4. Установка PM2
# ============================================
echo -e "\n${BLUE}[4/10] Установка PM2...${NC}"
npm install -g pm2
pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
echo -e "${GREEN}PM2 установлен и настроен для автозапуска${NC}"

# ============================================
# 5. Установка PostgreSQL
# ============================================
echo -e "\n${BLUE}[5/10] Установка PostgreSQL 16...${NC}"
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt update
apt install -y postgresql-16 postgresql-contrib-16

# Настройка PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Создание базы данных и пользователя
sudo -u postgres psql <<EOF
CREATE USER filmber_user WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE filmber OWNER filmber_user;
GRANT ALL PRIVILEGES ON DATABASE filmber TO filmber_user;
\c filmber
GRANT ALL ON SCHEMA public TO filmber_user;
EOF

echo -e "${GREEN}PostgreSQL установлен, база данных filmber создана${NC}"

# ============================================
# 6. Установка Nginx
# ============================================
echo -e "\n${BLUE}[6/10] Установка Nginx...${NC}"
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# Создание конфигурации Nginx для Filmber
cat > /etc/nginx/sites-available/filmber <<EOF
upstream filmber_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Логирование
    access_log /var/log/nginx/filmber_access.log;
    error_log /var/log/nginx/filmber_error.log;

    # Max upload size
    client_max_body_size 10M;

    # Socket.io WebSocket endpoint
    location /api/socket {
        proxy_pass http://filmber_backend;
        proxy_http_version 1.1;

        # WebSocket headers - ОБЯЗАТЕЛЬНЫ
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts для long-lived connections
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 3600s;

        # Disable buffering для real-time
        proxy_buffering off;
        proxy_cache off;
    }

    # Все остальные запросы к Next.js
    location / {
        proxy_pass http://filmber_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
}
EOF

# Активация сайта
ln -sf /etc/nginx/sites-available/filmber /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверка конфигурации
nginx -t
systemctl reload nginx

echo -e "${GREEN}Nginx установлен и настроен${NC}"

# ============================================
# 7. Настройка Firewall (UFW)
# ============================================
echo -e "\n${BLUE}[7/10] Настройка Firewall (UFW)...${NC}"
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

echo -e "${GREEN}Firewall настроен (SSH, HTTP, HTTPS разрешены)${NC}"

# ============================================
# 8. Установка Certbot (SSL)
# ============================================
echo -e "\n${BLUE}[8/10] Установка Certbot для SSL...${NC}"
apt install -y certbot python3-certbot-nginx

echo -e "${GREEN}Certbot установлен${NC}"
echo -e "${YELLOW}SSL сертификат нужно получить отдельно командой:${NC}"
echo -e "${YELLOW}  sudo certbot --nginx -d ${DOMAIN}${NC}"

# ============================================
# 9. Создание структуры директорий
# ============================================
echo -e "\n${BLUE}[9/10] Создание структуры директорий...${NC}"
mkdir -p ${APP_DIR}/{current,releases,shared,backups,logs}
mkdir -p ${APP_DIR}/deployment/{scripts,config}

# Создание .env файла
cat > ${APP_DIR}/shared/.env <<EOF
# Database Configuration
DATABASE_URL=postgresql://filmber_user:${DB_PASSWORD}@localhost:5432/filmber

# TMDB API Configuration
TMDB_API_KEY=${TMDB_API_KEY}
TMDB_ACCESS_TOKEN=${TMDB_ACCESS_TOKEN}

# OMDB API Configuration
OMDB_API_KEY=${OMDB_API_KEY}

# Application Configuration
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
EOF

chmod 600 ${APP_DIR}/shared/.env

# Установка прав доступа
chown -R ${APP_USER}:${APP_USER} ${APP_DIR}

echo -e "${GREEN}Структура директорий создана${NC}"

# ============================================
# 10. Создание SSH ключа для GitHub Actions
# ============================================
echo -e "\n${BLUE}[10/10] Создание SSH ключа для деплоя...${NC}"
sudo -u ${APP_USER} ssh-keygen -t ed25519 -f /home/${APP_USER}/.ssh/deploy_key -N "" -C "github-actions-deploy"

# Добавление публичного ключа в authorized_keys
cat /home/${APP_USER}/.ssh/deploy_key.pub >> /home/${APP_USER}/.ssh/authorized_keys
chmod 600 /home/${APP_USER}/.ssh/authorized_keys
chown ${APP_USER}:${APP_USER} /home/${APP_USER}/.ssh/authorized_keys

echo -e "${GREEN}SSH ключ для деплоя создан${NC}"

# ============================================
# Создание PM2 ecosystem файла
# ============================================
cat > ${APP_DIR}/ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'filmber',
    cwd: '${APP_DIR}/current',
    script: 'node_modules/.bin/tsx',
    args: 'server/index.ts',
    instances: 1,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '0.0.0.0'
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '${APP_DIR}/logs/pm2-error.log',
    out_file: '${APP_DIR}/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    source_map_support: true,
    restart_delay: 4000
  }]
};
EOF

chown ${APP_USER}:${APP_USER} ${APP_DIR}/ecosystem.config.js

# ============================================
# Финальный вывод
# ============================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Настройка VPS завершена успешно!                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}=== Следующие шаги ===${NC}"
echo ""
echo -e "${YELLOW}1. Получите SSL сертификат:${NC}"
echo -e "   sudo certbot --nginx -d ${DOMAIN}"
echo ""
echo -e "${YELLOW}2. Скопируйте приватный SSH ключ для GitHub Actions:${NC}"
echo -e "   cat /home/${APP_USER}/.ssh/deploy_key"
echo -e "   (Добавьте его в GitHub Secrets как VPS_SSH_KEY)"
echo ""
echo -e "${YELLOW}3. Добавьте GitHub Secrets:${NC}"
echo -e "   VPS_HOST = $(curl -s ifconfig.me)"
echo -e "   VPS_USER = ${APP_USER}"
echo -e "   VPS_SSH_KEY = (содержимое deploy_key)"
echo -e "   VPS_PORT = 22"
echo ""
echo -e "${YELLOW}4. Запушьте код в GitHub для автодеплоя${NC}"
echo ""
echo -e "${BLUE}=== Информация о сервере ===${NC}"
echo -e "  IP адрес: $(curl -s ifconfig.me)"
echo -e "  Домен: ${DOMAIN}"
echo -e "  Пользователь приложения: ${APP_USER}"
echo -e "  Директория приложения: ${APP_DIR}"
echo -e "  PostgreSQL: filmber_user@localhost/filmber"
echo -e "  Логи PM2: ${APP_DIR}/logs/"
echo -e "  Логи Nginx: /var/log/nginx/filmber_*.log"
echo ""
echo -e "${GREEN}Готово к деплою!${NC}"
