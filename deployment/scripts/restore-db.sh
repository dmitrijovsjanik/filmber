#!/bin/bash
#
# Filmber PostgreSQL Restore Script
# Восстановление базы данных из бэкапа
#
# Использование:
#   ./restore-db.sh --list      # Показать доступные бэкапы
#   ./restore-db.sh --latest    # Восстановить из последнего
#   ./restore-db.sh <файл>      # Восстановить из конкретного файла
#

set -euo pipefail

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Конфигурация
APP_DIR="/var/www/filmber"
BACKUP_DIR="${APP_DIR}/backups/database"
ENV_FILE="${APP_DIR}/shared/.env"

DB_NAME="filmber"
DB_USER="filmber_user"
DB_HOST="localhost"
DB_PORT="5432"

# ============================================
# ФУНКЦИИ
# ============================================

load_env() {
    if [ -f "${ENV_FILE}" ]; then
        DATABASE_URL=$(grep "^DATABASE_URL=" "${ENV_FILE}" | cut -d'=' -f2-)
        DB_PASSWORD=$(echo "${DATABASE_URL}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    else
        echo -e "${RED}Ошибка: Файл окружения не найден: ${ENV_FILE}${NC}"
        exit 1
    fi
}

list_backups() {
    echo -e "${BLUE}Доступные бэкапы:${NC}"
    echo ""

    if [ ! -d "${BACKUP_DIR}" ]; then
        echo -e "${YELLOW}Директория бэкапов не найдена${NC}"
        exit 0
    fi

    echo -e "${GREEN}Monthly бэкапы:${NC}"
    ls -lh "${BACKUP_DIR}"/*_monthly_*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}' || echo "  Нет"
    echo ""

    echo -e "${GREEN}Weekly бэкапы:${NC}"
    ls -lh "${BACKUP_DIR}"/*_weekly_*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}' || echo "  Нет"
    echo ""

    echo -e "${GREEN}Daily бэкапы:${NC}"
    ls -lh "${BACKUP_DIR}"/*_daily_*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}' || echo "  Нет"
    echo ""

    if [ -L "${BACKUP_DIR}/latest.sql.gz" ]; then
        local latest=$(readlink -f "${BACKUP_DIR}/latest.sql.gz")
        echo -e "${BLUE}Последний: ${latest}${NC}"
    fi
}

restore_backup() {
    local backup_file="$1"

    # Обработка --latest
    if [ "${backup_file}" = "--latest" ]; then
        if [ -L "${BACKUP_DIR}/latest.sql.gz" ]; then
            backup_file=$(readlink -f "${BACKUP_DIR}/latest.sql.gz")
        else
            echo -e "${RED}Ошибка: Симлинк latest.sql.gz не найден${NC}"
            exit 1
        fi
    fi

    # Проверка файла
    if [ ! -f "${backup_file}" ]; then
        # Пробуем добавить путь к директории бэкапов
        if [ -f "${BACKUP_DIR}/${backup_file}" ]; then
            backup_file="${BACKUP_DIR}/${backup_file}"
        else
            echo -e "${RED}Ошибка: Файл бэкапа не найден: ${backup_file}${NC}"
            exit 1
        fi
    fi

    local backup_size=$(du -h "${backup_file}" | cut -f1)

    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     Восстановление базы данных Filmber                     ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}ВНИМАНИЕ: Это ЗАМЕНИТ ВСЕ ДАННЫЕ в базе!${NC}"
    echo ""
    echo -e "Файл бэкапа: ${backup_file}"
    echo -e "Размер: ${backup_size}"
    echo -e "База данных: ${DB_NAME}"
    echo ""

    read -p "Вы уверены? (введите 'yes' для подтверждения): " confirm

    if [ "${confirm}" != "yes" ]; then
        echo -e "${YELLOW}Восстановление отменено${NC}"
        exit 0
    fi

    echo ""
    echo -e "${BLUE}[1/3] Остановка приложения...${NC}"
    pm2 stop filmber 2>/dev/null || true

    echo -e "${BLUE}[2/3] Восстановление базы данных...${NC}"

    # Завершаем активные соединения
    PGPASSWORD="${DB_PASSWORD}" psql \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --dbname="postgres" \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
        2>/dev/null || true

    # Восстанавливаем
    gunzip -c "${backup_file}" | PGPASSWORD="${DB_PASSWORD}" psql \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --dbname="${DB_NAME}" \
        --single-transaction \
        --set ON_ERROR_STOP=on

    echo -e "${BLUE}[3/3] Запуск приложения...${NC}"
    pm2 start filmber

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     Восстановление завершено успешно!                      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
}

show_help() {
    echo "Использование: $0 [ОПЦИИ] [файл_бэкапа]"
    echo ""
    echo "Опции:"
    echo "  --list, -l     Показать доступные бэкапы"
    echo "  --latest       Восстановить из последнего бэкапа"
    echo "  --help, -h     Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  $0 --list"
    echo "  $0 --latest"
    echo "  $0 filmber_daily_20240115_030000.sql.gz"
}

# ============================================
# ОСНОВНОЙ КОД
# ============================================

# Загружаем окружение
load_env

# Парсим аргументы
case "${1:-}" in
    --list|-l)
        list_backups
        ;;
    --latest)
        restore_backup "--latest"
        ;;
    --help|-h)
        show_help
        ;;
    "")
        echo -e "${YELLOW}Не указан файл бэкапа. Используйте --list для просмотра доступных.${NC}"
        echo ""
        list_backups
        ;;
    *)
        restore_backup "$1"
        ;;
esac
