#!/bin/bash
#
# VPN Failover Script for Filmber
# Проверяет доступность VPN и переключается на резервный при необходимости
#
# Использование: Запускается через systemd timer каждые 5 минут
#

set -e

LOG_FILE="/var/log/vpn-failover.log"
PRIMARY_INTERFACE="wg0"
BACKUP_INTERFACE="wg1"
TEST_URL="https://api.themoviedb.org/3/configuration"
TMDB_API_KEY="${TMDB_API_KEY:-}"  # Берём из переменной окружения

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

get_active_interface() {
    if wg show "$PRIMARY_INTERFACE" &>/dev/null && \
       ip link show "$PRIMARY_INTERFACE" up &>/dev/null; then
        echo "$PRIMARY_INTERFACE"
    elif wg show "$BACKUP_INTERFACE" &>/dev/null && \
         ip link show "$BACKUP_INTERFACE" up &>/dev/null; then
        echo "$BACKUP_INTERFACE"
    else
        echo "none"
    fi
}

test_vpn_connection() {
    local interface=$1

    # Проверяем handshake WireGuard (должен быть менее 3 минут назад)
    local last_handshake=$(wg show "$interface" latest-handshakes 2>/dev/null | awk '{print $2}')

    if [ -z "$last_handshake" ] || [ "$last_handshake" -eq 0 ]; then
        log "[$interface] Нет handshake"
        return 1
    fi

    local now=$(date +%s)
    local diff=$((now - last_handshake))

    if [ "$diff" -gt 180 ]; then
        log "[$interface] Handshake устарел: ${diff}s назад"
        return 1
    fi

    # Проверяем доступность TMDB API через VPN
    # Используем curl с таймаутом
    if [ -n "$TMDB_API_KEY" ]; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" \
            --connect-timeout 10 \
            --max-time 15 \
            "${TEST_URL}?api_key=${TMDB_API_KEY}" 2>/dev/null)

        if [ "$response" != "200" ]; then
            log "[$interface] TMDB API вернул код: $response"
            return 1
        fi
    fi

    return 0
}

switch_to_interface() {
    local from=$1
    local to=$2

    log "Переключение с $from на $to"

    # Останавливаем текущий интерфейс
    if [ "$from" != "none" ]; then
        systemctl stop "wg-quick@$from" 2>/dev/null || true
        # Обновляем routing table
        ip rule del fwmark 0x1 table 200 priority 100 2>/dev/null || true
        ip rule del fwmark 0x1 table 201 priority 100 2>/dev/null || true
    fi

    # Запускаем новый интерфейс
    systemctl start "wg-quick@$to"

    # Ждём поднятия интерфейса
    sleep 3

    # Обновляем IP адреса доменов
    /usr/local/bin/update-vpn-domains.sh

    log "Переключено на $to"
}

# Основная логика
main() {
    local active=$(get_active_interface)

    log "Проверка VPN. Активный интерфейс: $active"

    if [ "$active" == "none" ]; then
        log "VPN не активен, запускаем primary"
        switch_to_interface "none" "$PRIMARY_INTERFACE"
        exit 0
    fi

    # Проверяем текущее соединение
    if test_vpn_connection "$active"; then
        log "[$active] OK"
        exit 0
    fi

    # Соединение упало, переключаемся
    if [ "$active" == "$PRIMARY_INTERFACE" ]; then
        log "Primary VPN недоступен, переключаемся на backup"
        switch_to_interface "$PRIMARY_INTERFACE" "$BACKUP_INTERFACE"

        # Проверяем backup
        sleep 5
        if ! test_vpn_connection "$BACKUP_INTERFACE"; then
            log "Backup тоже недоступен! Возвращаемся на primary"
            switch_to_interface "$BACKUP_INTERFACE" "$PRIMARY_INTERFACE"
        fi
    else
        log "Backup VPN недоступен, переключаемся на primary"
        switch_to_interface "$BACKUP_INTERFACE" "$PRIMARY_INTERFACE"
    fi
}

main "$@"
