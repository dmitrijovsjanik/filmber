#!/bin/bash

# Filmber - Clean start (clear cache and restart)
# Usage: ./scripts/clean-start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Clean starting Filmber..."

# Stop services first
"$SCRIPT_DIR/stop.sh"

# Clear Next.js cache
echo "Clearing Next.js cache..."
rm -rf .next

# Clear node_modules cache if needed
if [ "$1" = "--full" ]; then
    echo "Clearing node_modules..."
    rm -rf node_modules
    npm install
fi

sleep 2

# Start services
"$SCRIPT_DIR/start.sh"
