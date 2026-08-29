FROM mcr.microsoft.com/devcontainers/base:bookworm

# uv は公式イメージからバイナリを取る。Python 自体も uv が管理する
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# .venv を使わず、コンテナ内の固定パスに環境を作る
ENV UV_PROJECT_ENVIRONMENT=/home/vscode/.venv \
    PATH=/home/vscode/.venv/bin:$PATH

# volume をマウントする先を先に作る。イメージ側の所有者が volume に引き継がれるため、
# ここで用意しないと root 所有になって書き込めない
RUN mkdir -p /home/vscode/.venv \
             /home/vscode/.claude \
             /home/vscode/.config/.wrangler \
    && chown -R vscode:vscode /home/vscode/.venv /home/vscode/.claude /home/vscode/.config
