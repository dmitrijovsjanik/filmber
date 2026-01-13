#!/bin/bash
#
# VPN Setup Script for Filmber
# Устанавливает WireGuard с split tunneling для TMDB API
#
# Использование: sudo ./setup-vpn.sh
#

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Проверка root
if [ "$EUID" -ne 0 ]; then
    error "Запустите скрипт с sudo: sudo ./setup-vpn.sh"
fi

# Проверка наличия конфигов
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/../config/vpn"

if [ ! -f "$CONFIG_DIR/wireguard/wg-primary.conf" ]; then
    error "Не найден файл $CONFIG_DIR/wireguard/wg-primary.conf"
fi

log "=== Установка VPN для Filmber ==="

# 1. Установка пакетов
log "Установка WireGuard и dnsmasq..."
apt update
apt install -y wireguard dnsmasq resolvconf

# 2. Копирование конфигов WireGuard
log "Копирование конфигов WireGuard..."
cp "$CONFIG_DIR/wireguard/wg-primary.conf" /etc/wireguard/wg0.conf
cp "$CONFIG_DIR/wireguard/wg-backup.conf" /etc/wireguard/wg1.conf

# 3. Модификация конфигов для split tunneling
log "Настройка split tunneling..."

# Функция для модификации конфига WireGuard
modify_wg_config() {
    local config_file=$1
    local interface=$2
    local table_num=$3

    # Удаляем AllowedIPs = 0.0.0.0/0 и заменяем на VPN сеть
    # Добавляем Table = off и PostUp/PostDown правила

    # Читаем текущий конфиг
    local private_key=$(grep "PrivateKey" "$config_file" | cut -d'=' -f2 | tr -d ' ')
    local address=$(grep "Address" "$config_file" | cut -d'=' -f2 | tr -d ' ')
    local public_key=$(grep "PublicKey" "$config_file" | cut -d'=' -f2 | tr -d ' ')
    local endpoint=$(grep "Endpoint" "$config_file" | cut -d'=' -f2 | tr -d ' ')

    # Создаём новый конфиг
    cat > "$config_file" << EOF
[Interface]
PrivateKey = $private_key
Address = $address
Table = off

# При поднятии интерфейса добавляем маршрут в отдельную таблицу
PostUp = ip route add default dev %i table $table_num
PostUp = ip rule add fwmark 0x1 table $table_num priority 100
PostDown = ip route del default dev %i table $table_num
PostDown = ip rule del fwmark 0x1 table $table_num priority 100

[Peer]
PublicKey = $public_key
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = $endpoint
PersistentKeepalive = 25
EOF

    chmod 600 "$config_file"
}

modify_wg_config /etc/wireguard/wg0.conf wg0 200
modify_wg_config /etc/wireguard/wg1.conf wg1 201

# 4. Настройка dnsmasq для перехвата DNS
log "Настройка dnsmasq..."

# Создаём ipset конфигурацию для dnsmasq
cat > /etc/dnsmasq.d/vpn-domains.conf << 'EOF'
# VPN domains for TMDB API
# Резолвим через Google DNS и добавляем IP в nftables set

server=/api.themoviedb.org/8.8.8.8
server=/api.tmdb.org/8.8.8.8
server=/image.tmdb.org/8.8.8.8
server=/themoviedb.org/8.8.8.8

# Логирование DNS запросов (можно отключить)
log-queries
log-facility=/var/log/dnsmasq-vpn.log
EOF

# 5. Создаём скрипт для управления nftables
log "Создание nftables правил..."

cat > /etc/nftables-vpn.conf << 'EOF'
#!/usr/sbin/nft -f

table inet vpn_routing {
    set vpn_domains {
        type ipv4_addr
        flags timeout
        timeout 1h
    }

    chain prerouting {
        type filter hook prerouting priority -150; policy accept;
        ip daddr @vpn_domains meta mark set 0x1
    }

    chain output {
        type route hook output priority -150; policy accept;
        ip daddr @vpn_domains meta mark set 0x1
    }
}
EOF

# 6. Создаём скрипт обновления IP адресов для VPN доменов
cat > /usr/local/bin/update-vpn-domains.sh << 'EOF'
#!/bin/bash
# Обновляет nftables set с IP адресами VPN доменов

DOMAINS="api.themoviedb.org api.tmdb.org image.tmdb.org themoviedb.org"

for domain in $DOMAINS; do
    # Получаем все IP адреса для домена
    ips=$(dig +short "$domain" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$')

    for ip in $ips; do
        # Добавляем IP в nftables set с таймаутом 1 час
        nft add element inet vpn_routing vpn_domains { $ip timeout 1h } 2>/dev/null || true
    done
done
EOF

chmod +x /usr/local/bin/update-vpn-domains.sh

# 7. Создаём systemd сервис для VPN
log "Создание systemd сервисов..."

cat > /etc/systemd/system/vpn-routing.service << 'EOF'
[Unit]
Description=VPN Routing for TMDB API
After=network.target nftables.service
Wants=nftables.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/nft -f /etc/nftables-vpn.conf
ExecStart=/usr/local/bin/update-vpn-domains.sh
ExecStop=/usr/sbin/nft delete table inet vpn_routing

[Install]
WantedBy=multi-user.target
EOF

# 8. Создаём таймер для периодического обновления IP
cat > /etc/systemd/system/update-vpn-domains.timer << 'EOF'
[Unit]
Description=Update VPN domains IP addresses every 30 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=30min

[Install]
WantedBy=timers.target
EOF

cat > /etc/systemd/system/update-vpn-domains.service << 'EOF'
[Unit]
Description=Update VPN domains IP addresses

[Service]
Type=oneshot
ExecStart=/usr/local/bin/update-vpn-domains.sh
EOF

# 9. Копируем и настраиваем failover скрипт
log "Настройка VPN failover..."
cp "$SCRIPT_DIR/vpn-failover.sh" /usr/local/bin/vpn-failover.sh
chmod +x /usr/local/bin/vpn-failover.sh

cat > /etc/systemd/system/vpn-failover.service << 'EOF'
[Unit]
Description=VPN Failover Check
After=network.target wg-quick@wg0.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/vpn-failover.sh
EnvironmentFile=-/etc/filmber/env
EOF

cat > /etc/systemd/system/vpn-failover.timer << 'EOF'
[Unit]
Description=Check VPN connection every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF

# 10. Включаем IP forwarding
log "Включение IP forwarding..."
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-vpn.conf
sysctl -p /etc/sysctl.d/99-vpn.conf

# 10. Включаем и запускаем сервисы
log "Запуск сервисов..."
systemctl daemon-reload
systemctl enable --now vpn-routing.service
systemctl enable --now update-vpn-domains.timer
systemctl enable --now vpn-failover.timer
systemctl enable --now wg-quick@wg0

# Перезапускаем dnsmasq
systemctl restart dnsmasq

# 11. Проверка
log "=== Проверка установки ==="
echo ""

# Проверяем WireGuard
if wg show wg0 &>/dev/null; then
    echo -e "${GREEN}✓${NC} WireGuard wg0 активен"
    wg show wg0
else
    echo -e "${RED}✗${NC} WireGuard wg0 не запущен"
fi

echo ""

# Проверяем nftables
if nft list table inet vpn_routing &>/dev/null; then
    echo -e "${GREEN}✓${NC} nftables правила загружены"
else
    echo -e "${RED}✗${NC} nftables правила не загружены"
fi

echo ""
log "=== Установка завершена ==="
echo ""
echo "Команды для управления:"
echo "  sudo wg show                    - статус WireGuard"
echo "  sudo nft list set inet vpn_routing vpn_domains  - IP в VPN"
echo "  sudo systemctl status wg-quick@wg0  - статус VPN"
echo "  sudo journalctl -u wg-quick@wg0     - логи VPN"
echo ""
echo "Для проверки работы:"
echo "  curl -v https://api.themoviedb.org/3/movie/550"
