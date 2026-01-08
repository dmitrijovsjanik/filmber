#!/bin/bash

# Filmber - Stop all services
# Usage: ./scripts/stop.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Stopping Filmber services..."

# Stop Node.js server
echo "Stopping Node.js server..."
pkill -f "tsx server/index.ts" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Stop PostgreSQL
echo "Stopping PostgreSQL..."
docker-compose down

echo "All services stopped."
