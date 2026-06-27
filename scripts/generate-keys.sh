#!/bin/bash
# Generate RS256 key pair for JWT signing
# Run once: bash scripts/generate-keys.sh

set -e

mkdir -p backend/keys
cd backend/keys

echo "Generating RSA-2048 private key..."
openssl genrsa -out private.pem 2048

echo "Extracting public key..."
openssl rsa -in private.pem -pubout -out public.pem

chmod 600 private.pem
chmod 644 public.pem

echo ""
echo "✅ Keys generated at backend/keys/"
echo "   private.pem — keep secret, never commit to git"
echo "   public.pem  — safe to share"
echo ""
echo "Update your .env:"
echo "  JWT_PRIVATE_KEY_PATH=./keys/private.pem"
echo "  JWT_PUBLIC_KEY_PATH=./keys/public.pem"
