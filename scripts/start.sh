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

# Skip automatic migrations - run manually if needed:
# DATABASE_URL="postgresql://user:password@localhost:5432/filmber" npx drizzle-kit push
echo "Database ready. Run migrations manually if needed."

# Start the dev server
echo "Starting Next.js + Socket.io server..."
npm run dev
