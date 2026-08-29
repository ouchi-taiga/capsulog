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
corepack enable pnpm
if [ -f package.json ]; then
  pnpm install
fi

# Cloudflare の API トークンを読む設定。トークン本体は volume の env に置く
MARK="# Cloudflare の API トークン"
if ! grep -qF "$MARK" "$HOME/.bashrc"; then
  cat >> "$HOME/.bashrc" <<'EOS'

# Cloudflare の API トークン。volume に置いて、コンテナを作り直しても残るようにしている
if [ -f "$HOME/.config/.wrangler/env" ]; then
  set -a
  . "$HOME/.config/.wrangler/env"
  set +a
fi
EOS
fi

echo "--- ready ---"
if [ ! -f "$HOME/.config/.wrangler/env" ]; then
  echo "Cloudflare のトークンが未設定。~/.config/.wrangler/env に CLOUDFLARE_API_TOKEN を置く"
fi
