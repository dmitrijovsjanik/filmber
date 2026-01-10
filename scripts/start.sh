#!/bin/bash

# Filmber - Start all services
# Usage: ./scripts/start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Starting Filmber services..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Start PostgreSQL
echo "Starting PostgreSQL..."
docker-compose up -d postgres
sleep 2

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker exec filmber-postgres pg_isready -U user -d filmber > /dev/null 2>&1; do
    sleep 1
done
echo "PostgreSQL is ready."

# Check if migrations need to be run
echo "Checking database schema..."
TABLE_COUNT=$(docker exec filmber-postgres psql -U user -d filmber -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
if [ "$TABLE_COUNT" -lt 8 ]; then
    echo "Running database migrations..."
    DATABASE_URL="postgresql://user:password@localhost:5432/filmber" npm run db:push
fi

# Start the dev server
echo "Starting Next.js + Socket.io server..."
npm run dev
