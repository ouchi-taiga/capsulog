#!/usr/bin/env bash
set -euo pipefail

echo "--- versions ---"
node --version
npm --version
rustc --version
cargo --version
uv --version

# Python 環境。Python 本体も uv が用意する
if [ -f pyproject.toml ]; then
  uv sync
  echo "python: $(python --version)"
fi

# フロントと wrangler
if [ -f package.json ]; then
  npm install
fi

echo "--- ready ---"
echo "wrangler login で Cloudflare の認証を行う"
