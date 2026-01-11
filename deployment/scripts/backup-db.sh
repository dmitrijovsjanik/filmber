#!/bin/bash
#
# Filmber PostgreSQL Backup Script
# Автоматические бэкапы с ротацией по схеме GFS
#
# Использование: ./backup-db.sh
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
LOG_DIR="${APP_DIR}/logs"
ENV_FILE="${APP_DIR}/shared/.env"

# База данных
DB_NAME="filmber"
DB_USER="filmber_user"
DB_HOST="localhost"
DB_PORT="5432"

# Ротация (GFS схема)
KEEP_DAILY=7      # 7 дней
KEEP_WEEKLY=4     # 4 недели
KEEP_MONTHLY=3    # 3 месяца

# Лог-файл
LOG_FILE="${LOG_DIR}/backup_$(date '+%Y%m%d').log"

# ============================================
# ФУНКЦИИ
# ============================================

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

load_env() {
    if [ -f "${ENV_FILE}" ]; then
        # Извлекаем DATABASE_URL и парсим пароль
        DATABASE_URL=$(grep "^DATABASE_URL=" "${ENV_FILE}" | cut -d'=' -f2-)
        # Формат: postgresql://user:password@host:port/database
        DB_PASSWORD=$(echo "${DATABASE_URL}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    else
        log "ERROR" "Файл окружения не найден: ${ENV_FILE}"
        exit 1
    fi
}

get_backup_type() {
    local day_of_week=$(date '+%u')  # 1=Пн, 7=Вс
    local day_of_month=$(date '+%d')

    # 1-е число месяца = monthly
    if [ "${day_of_month}" = "01" ]; then
        echo "monthly"
    # Воскресенье = weekly
    elif [ "${day_of_week}" = "7" ]; then
        echo "weekly"
    # Остальные дни = daily
    else
        echo "daily"
    fi
}

create_backup() {
    local backup_type="$1"
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_filename="${DB_NAME}_${backup_type}_${timestamp}.sql.gz"
    local backup_path="${BACKUP_DIR}/${backup_filename}"

    log "INFO" "Создание ${backup_type} бэкапа: ${backup_filename}"

    # pg_dump с сжатием gzip
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --dbname="${DB_NAME}" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        2>> "${LOG_FILE}" | gzip -9 > "${backup_path}"

    # Проверка что файл создан и не пустой
    if [ ! -f "${backup_path}" ] || [ ! -s "${backup_path}" ]; then
        log "ERROR" "Бэкап пустой или не создан: ${backup_path}"
        return 1
    fi

    # Размер бэкапа
    local backup_size=$(du -h "${backup_path}" | cut -f1)
    log "INFO" "Бэкап завершен: ${backup_filename} (${backup_size})"

    # Симлинк на последний бэкап
    ln -sf "${backup_path}" "${BACKUP_DIR}/latest.sql.gz"

    echo "${backup_path}"
}

rotate_backups() {
    log "INFO" "Ротация старых бэкапов..."

    # Считаем бэкапы по типам
    local daily_count=$(ls -1 "${BACKUP_DIR}"/*_daily_*.sql.gz 2>/dev/null | wc -l || echo 0)
    local weekly_count=$(ls -1 "${BACKUP_DIR}"/*_weekly_*.sql.gz 2>/dev/null | wc -l || echo 0)
    local monthly_count=$(ls -1 "${BACKUP_DIR}"/*_monthly_*.sql.gz 2>/dev/null | wc -l || echo 0)

    # Удаляем старые daily
    if [ "${daily_count}" -gt "${KEEP_DAILY}" ]; then
        ls -1t "${BACKUP_DIR}"/*_daily_*.sql.gz 2>/dev/null | \
            tail -n +$((KEEP_DAILY + 1)) | \
            xargs -r rm -f
        log "INFO" "Удалены старые daily бэкапы, оставлено ${KEEP_DAILY}"
    fi

    # Удаляем старые weekly
    if [ "${weekly_count}" -gt "${KEEP_WEEKLY}" ]; then
        ls -1t "${BACKUP_DIR}"/*_weekly_*.sql.gz 2>/dev/null | \
            tail -n +$((KEEP_WEEKLY + 1)) | \
            xargs -r rm -f
        log "INFO" "Удалены старые weekly бэкапы, оставлено ${KEEP_WEEKLY}"
    fi

    # Удаляем старые monthly
    if [ "${monthly_count}" -gt "${KEEP_MONTHLY}" ]; then
        ls -1t "${BACKUP_DIR}"/*_monthly_*.sql.gz 2>/dev/null | \
            tail -n +$((KEEP_MONTHLY + 1)) | \
            xargs -r rm -f
        log "INFO" "Удалены старые monthly бэкапы, оставлено ${KEEP_MONTHLY}"
    fi

    # Итого
    local total_size=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo "0")
    local total_count=$(ls -1 "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | wc -l || echo 0)
    log "INFO" "Всего бэкапов: ${total_count}, размер: ${total_size}"
}

# ============================================
# ОСНОВНОЙ КОД
# ============================================

main() {
    local start_time=$(date +%s)

    # Создаем директории
    mkdir -p "${BACKUP_DIR}"
    mkdir -p "${LOG_DIR}"

    log "INFO" "========================================="
    log "INFO" "Запуск бэкапа базы данных Filmber"
    log "INFO" "========================================="

    # Загружаем переменные окружения
    load_env

    # Определяем тип бэкапа
    local backup_type=$(get_backup_type)
    log "INFO" "Тип бэкапа: ${backup_type}"

    # Создаем бэкап
    local backup_result=""
    local exit_code=0

    if backup_result=$(create_backup "${backup_type}"); then
        # Ротация
        rotate_backups

        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        log "INFO" "Бэкап успешно завершен за ${duration}с"
    else
        exit_code=1
        log "ERROR" "Бэкап не удался!"
    fi

    log "INFO" "========================================="
    log "INFO" "Процесс завершен"
    log "INFO" "========================================="

    exit ${exit_code}
}

main "$@"
