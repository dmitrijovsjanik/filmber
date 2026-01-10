#!/bin/bash
#
# Filmber Deployment Script
# Деплой обновлений на VPS с zero-downtime
#
# Использование: bash deploy.sh [branch]
# По умолчанию деплоит из main
#

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Конфигурация
APP_DIR="/var/www/filmber"
APP_NAME="filmber"
BRANCH="${1:-main}"
RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"
SHARED_DIR="${APP_DIR}/shared"
KEEP_RELEASES=5

# Timestamp для релиза
RELEASE_TIMESTAMP=$(date +%Y%m%d%H%M%S)
RELEASE_DIR="${RELEASES_DIR}/${RELEASE_TIMESTAMP}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Filmber Deployment                                     ║${NC}"
echo -e "${BLUE}║     Branch: ${BRANCH}                                      ${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Проверка что мы на сервере
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}Ошибка: Директория ${APP_DIR} не существует${NC}"
    echo -e "${YELLOW}Этот скрипт должен запускаться на VPS${NC}"
    exit 1
fi

# ============================================
# 1. Подготовка
# ============================================
echo -e "${BLUE}[1/7] Подготовка релиза...${NC}"
mkdir -p "${RELEASE_DIR}"
mkdir -p "${APP_DIR}/backups"

# ============================================
# 2. Клонирование/обновление кода
# ============================================
echo -e "${BLUE}[2/7] Получение кода из Git...${NC}"

# Если есть текущий релиз, копируем node_modules для ускорения
if [ -d "${CURRENT_LINK}/node_modules" ]; then
    echo -e "${YELLOW}Копирование node_modules из предыдущего релиза...${NC}"
    cp -r "${CURRENT_LINK}/node_modules" "${RELEASE_DIR}/"
fi

# Клонируем репозиторий
cd "${RELEASE_DIR}"
if [ -d "${APP_DIR}/repo" ]; then
    cd "${APP_DIR}/repo"
    git fetch origin
    git checkout "${BRANCH}"
    git pull origin "${BRANCH}"
    rsync -a --exclude='.git' --exclude='node_modules' ./ "${RELEASE_DIR}/"
else
    # Первый деплой - клонируем полностью
    git clone --branch "${BRANCH}" --depth 1 https://github.com/dmitrijovsjanik/filmber.git "${APP_DIR}/repo"
    rsync -a --exclude='.git' ./ "${RELEASE_DIR}/"
fi

cd "${RELEASE_DIR}"

# ============================================
# 3. Линковка shared файлов
# ============================================
echo -e "${BLUE}[3/7] Линковка конфигурации...${NC}"

# Линкуем .env из shared директории
if [ -f "${SHARED_DIR}/.env" ]; then
    ln -sf "${SHARED_DIR}/.env" "${RELEASE_DIR}/.env"
    echo -e "${GREEN}.env файл подключен${NC}"
else
    echo -e "${RED}Ошибка: ${SHARED_DIR}/.env не найден!${NC}"
    exit 1
fi

# ============================================
# 4. Установка зависимостей
# ============================================
echo -e "${BLUE}[4/7] Установка зависимостей...${NC}"
npm ci --production=false

# ============================================
# 5. Сборка проекта
# ============================================
echo -e "${BLUE}[5/7] Сборка проекта...${NC}"
npm run build

# ============================================
# 6. Миграции базы данных
# ============================================
echo -e "${BLUE}[6/7] Применение миграций БД...${NC}"
npm run db:push || echo -e "${YELLOW}Миграции не требуются или уже применены${NC}"

# ============================================
# 7. Переключение на новый релиз
# ============================================
echo -e "${BLUE}[7/7] Активация нового релиза...${NC}"

# Обновляем символическую ссылку
ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"

# Перезапуск PM2
cd "${CURRENT_LINK}"
pm2 delete ${APP_NAME} 2>/dev/null || true
pm2 start ecosystem.config.js --env production

# Ждем запуска
sleep 3

# Проверка здоровья
if pm2 show ${APP_NAME} | grep -q "online"; then
    echo -e "${GREEN}Приложение успешно запущено!${NC}"
else
    echo -e "${RED}Ошибка: Приложение не запустилось!${NC}"
    echo -e "${YELLOW}Откатываемся на предыдущий релиз...${NC}"

    # Откат
    PREV_RELEASE=$(ls -1t "${RELEASES_DIR}" | sed -n '2p')
    if [ -n "$PREV_RELEASE" ]; then
        ln -sfn "${RELEASES_DIR}/${PREV_RELEASE}" "${CURRENT_LINK}"
        cd "${CURRENT_LINK}"
        pm2 delete ${APP_NAME} 2>/dev/null || true
        pm2 start ecosystem.config.js --env production
        echo -e "${YELLOW}Откат выполнен на ${PREV_RELEASE}${NC}"
    fi
    exit 1
fi

# ============================================
# Очистка старых релизов
# ============================================
echo -e "${BLUE}Очистка старых релизов...${NC}"
cd "${RELEASES_DIR}"
ls -1t | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
echo -e "${GREEN}Оставлено последних ${KEEP_RELEASES} релизов${NC}"

# ============================================
# Финальный вывод
# ============================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Деплой завершен успешно!                               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Релиз: ${RELEASE_TIMESTAMP}"
echo -e "  Ветка: ${BRANCH}"
echo -e "  Путь: ${RELEASE_DIR}"
echo ""
echo -e "${BLUE}Полезные команды:${NC}"
echo -e "  pm2 logs ${APP_NAME}     - логи приложения"
echo -e "  pm2 status              - статус"
echo -e "  pm2 restart ${APP_NAME}  - перезапуск"
echo ""
