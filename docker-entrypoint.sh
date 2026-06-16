#!/bin/sh
set -e

echo "[entrypoint] waiting for postgres..."
until pg_isready -h db -U "$POSTGRES_USER" 2>/dev/null; do
  sleep 0.5
done

echo "[entrypoint] applying drizzle migrations..."
# We use drizzle-orm migrator directly to avoid binary juggling
node --experimental-strip-types /app/scripts/migrate.ts

echo "[entrypoint] starting app..."
exec "$@"
