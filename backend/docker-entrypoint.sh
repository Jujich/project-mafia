#!/bin/sh
set -e

echo "Applying committed database migrations..."

# Fail closed: a migration error must not bypass history or destroy existing data.
# With set -e, the API starts only after all committed migrations succeed.
npx prisma migrate deploy
echo "Prisma migrations applied."

echo "Starting backend on port ${PORT:-3000}..."
exec node dist/main.js
