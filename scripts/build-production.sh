#!/usr/bin/env bash
set -euo pipefail

npm install
npm run build
npm run prisma:migrate --workspace backend

echo "Build concluido. Publique frontend/dist e execute backend/dist/server.js."
