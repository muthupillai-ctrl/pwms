#!/bin/bash

set -euo pipefail

############################################################
# PWMS Backend Deployment
############################################################

SERVER="pwms-server"
REMOTE_DIR="/data/apps/pwms/backend"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

echo ""
echo "=============================================="
echo " PWMS Backend Deployment"
echo "=============================================="

############################################################
# Sync Backend
############################################################

echo ""
echo "▶ Syncing backend source..."

rsync -av --delete \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=.git \
    --exclude=.env.production \
    --exclude=ca.pem \
    "$BACKEND_DIR/" \
    "$SERVER:$REMOTE_DIR/"

echo "✅ Backend source synced."

############################################################
# Build Docker Image
############################################################

echo ""
echo "▶ Building Docker image..."

ssh "$SERVER" << 'EOF'
cd /data/apps/pwms

docker compose build backend
EOF

echo "✅ Docker image built."

############################################################
# Restart Backend
############################################################

echo ""
echo "▶ Restarting backend..."

ssh "$SERVER" << 'EOF'
cd /data/apps/pwms

docker compose up -d backend
EOF

echo "✅ Backend restarted."

############################################################
# Health Check
############################################################

echo ""
echo "▶ Checking backend health..."

ssh "$SERVER" << 'EOF'
sleep 3

curl --fail http://localhost:3005/health
EOF

echo ""
echo "✅ Backend is healthy."

echo ""
echo "=============================================="
echo " Backend Deployment Completed"
echo "=============================================="
