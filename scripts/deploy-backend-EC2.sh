#!/bin/bash
# Deploy Node.js backend to EC2.
# Usage: bash scripts/deploy-backend.sh

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────────
EC2_HOST="ubuntu@3.25.186.29"
EC2_KEY="$HOME/.ssh/montessori3.pem"
REMOTE_DIR="/home/ubuntu/pwms/backend"
PM2_APP="pwms-api"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

# ── Build ───────────────────────────────────────────────────────────────────────
echo "▶  Building TypeScript…"
cd "$BACKEND_DIR"
npm run build

echo "✔  Build complete → $BACKEND_DIR/dist"

# ── Sync dist ──────────────────────────────────────────────────────────────────
echo "▶  Syncing dist/ to $EC2_HOST:$REMOTE_DIR …"
rsync -avz --delete \
  -e "ssh -i $EC2_KEY" \
  "$BACKEND_DIR/dist/" \
  "$EC2_HOST:$REMOTE_DIR/dist/"

# ── Sync package files (in case dependencies changed) ──────────────────────────
echo "▶  Syncing package files…"
rsync -avz \
  -e "ssh -i $EC2_KEY" \
  "$BACKEND_DIR/package.json" \
  "$BACKEND_DIR/package-lock.json" \
  "$EC2_HOST:$REMOTE_DIR/"

# ── Install production dependencies on EC2 ─────────────────────────────────────
echo "▶  Installing production dependencies on EC2…"
ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_DIR && npm install --omit=dev --silent"

# ── Restart PM2 ────────────────────────────────────────────────────────────────
echo "▶  Restarting PM2 app '$PM2_APP'…"
ssh -i "$EC2_KEY" "$EC2_HOST" "pm2 restart $PM2_APP && pm2 save"

echo ""
echo "✅  Backend deployed. API is live at https://pwms.ahamsys.com/api/v1"
