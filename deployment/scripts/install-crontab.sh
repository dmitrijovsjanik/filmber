#!/bin/bash
#
# Install crontab from deployment/crontab.txt
# This script is run during GitHub Actions deployment
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/var/www/filmber"
CRONTAB_TEMPLATE="${APP_DIR}/current/deployment/crontab.txt"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Installing crontab from deployment/crontab.txt...${NC}"

# Check if template exists
if [ ! -f "$CRONTAB_TEMPLATE" ]; then
    echo -e "${RED}Error: $CRONTAB_TEMPLATE not found${NC}"
    exit 1
fi

# Get CRON_SECRET from .env
if [ -f "${APP_DIR}/shared/.env" ]; then
    CRON_SECRET=$(grep -E "^CRON_SECRET=" "${APP_DIR}/shared/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "$CRON_SECRET" ]; then
    echo -e "${RED}Error: CRON_SECRET not found in ${APP_DIR}/shared/.env${NC}"
    exit 1
fi

# Create temp file with replaced secrets
TEMP_CRONTAB=$(mktemp)
sed "s/__CRON_SECRET__/${CRON_SECRET}/g" "$CRONTAB_TEMPLATE" > "$TEMP_CRONTAB"

# Backup current crontab
BACKUP_FILE="${APP_DIR}/logs/crontab_backup_$(date +%Y%m%d%H%M%S).txt"
crontab -l > "$BACKUP_FILE" 2>/dev/null || echo "# No previous crontab" > "$BACKUP_FILE"
echo -e "${YELLOW}Backed up current crontab to: $BACKUP_FILE${NC}"

# Install new crontab
crontab "$TEMP_CRONTAB"
rm -f "$TEMP_CRONTAB"

echo -e "${GREEN}Crontab installed successfully!${NC}"
echo ""
echo "Current crontab:"
crontab -l | head -30
echo "..."
