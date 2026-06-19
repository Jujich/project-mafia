#!/bin/sh
set -e

echo "Waiting for database and applying schema..."

# Prefer committed migrations; fall back to db push for a fresh MVP database.
if npx prisma migrate deploy; then
  echo "Prisma migrations applied."
else
  echo "No migrations to deploy — syncing schema with db push."
  npx prisma db push --accept-data-loss
fi

echo "Starting backend on port ${PORT:-3000}..."
exec node dist/main.js
