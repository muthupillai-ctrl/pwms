#!/bin/bash
# Deploy Angular frontend to EC2.
# Usage: bash scripts/deploy-frontend.sh

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────────
EC2_HOST="ubuntu@3.25.186.29"
EC2_KEY="$HOME/.ssh/montessori3.pem"
REMOTE_DIR="/var/www/pwms"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
DIST_DIR="$FRONTEND_DIR/dist/pwms/browser"

# Fallback for older Angular output structure (no /browser subfolder)
if [ ! -d "$DIST_DIR" ]; then
  DIST_DIR="$FRONTEND_DIR/dist/pwms"
fi

# ── Build ───────────────────────────────────────────────────────────────────────
echo "▶  Building Angular (production)…"
cd "$FRONTEND_DIR"
npm run build -- --configuration production

if [ ! -d "$DIST_DIR" ]; then
  echo "✗  Build output not found at $DIST_DIR"
  exit 1
fi
echo "✔  Build complete → $DIST_DIR"

# ── Deploy ──────────────────────────────────────────────────────────────────────
echo "▶  Deploying to $EC2_HOST:$REMOTE_DIR …"
ssh -i "$EC2_KEY" "$EC2_HOST" "sudo chown -R ubuntu:ubuntu $REMOTE_DIR && rm -rf $REMOTE_DIR/* $REMOTE_DIR/.[!.]* 2>/dev/null; mkdir -p $REMOTE_DIR"
rsync -avz \
  -e "ssh -i $EC2_KEY" \
  "$DIST_DIR/" \
  "$EC2_HOST:$REMOTE_DIR/"

echo "✔  Deploy complete."

# ── Reload nginx ────────────────────────────────────────────────────────────────
echo "▶  Reloading nginx…"
ssh -i "$EC2_KEY" "$EC2_HOST" "sudo nginx -t && sudo systemctl reload nginx"
echo "✔  nginx reloaded."

echo ""
echo "✅  Frontend is live at https://pwms.ahamsys.com"
