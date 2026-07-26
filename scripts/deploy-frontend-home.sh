#!/bin/bash

set -euo pipefail

############################################################
# PWMS Frontend Deployment
############################################################

SERVER="pwms-server"
REMOTE_DIR="/data/apps/pwms/frontend/www"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
DIST_DIR="$FRONTEND_DIR/dist/pwms/browser"

echo ""
echo "=============================================="
echo " PWMS Frontend Deployment"
echo "=============================================="

############################################################
# Build Angular
############################################################

echo ""
echo "▶ Building Angular Production..."

cd "$FRONTEND_DIR"

npm run build -- --configuration production

if [ ! -d "$DIST_DIR" ]; then
    echo ""
    echo "❌ Angular build failed."
    exit 1
fi

echo "✅ Angular build completed."

############################################################
# Deploy
############################################################

echo ""
echo "▶ Syncing frontend to Ubuntu..."

rsync -av --delete \
    "$DIST_DIR/" \
    "$SERVER:$REMOTE_DIR/"

echo "✅ Frontend deployed successfully."

echo ""
echo "=============================================="
echo " Frontend Deployment Completed"
echo "=============================================="
