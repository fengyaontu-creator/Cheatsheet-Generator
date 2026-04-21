#!/usr/bin/env bash
# Cheatsheet deploy helper — run on the server from /opt/cheatsheet.
# Usage: ./deploy.sh [backend|frontend|all]   (default: all)

set -euo pipefail

ROOT="/opt/cheatsheet"
APP="$ROOT/cheatsheet-app"
PID_FILE="$ROOT/backend.pid"
LOG_FILE="$ROOT/logs/backend.log"

if [ "$(pwd)" != "$ROOT" ]; then
    echo "Run this from $ROOT (not $(pwd))" >&2
    exit 1
fi

mkdir -p "$(dirname "$LOG_FILE")"

echo "==> git pull"
git pull origin main

deploy_backend() {
    echo "==> backend: install deps + restart"
    cd "$APP/backend"
    # shellcheck source=/dev/null
    source .venv/bin/activate
    pip install -q -r requirements.txt
    if [ -f "$PID_FILE" ]; then
        kill "$(cat "$PID_FILE")" 2>/dev/null || true
        rm -f "$PID_FILE"
        sleep 1
    fi
    nohup .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001 \
        > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "    started pid=$(cat "$PID_FILE")   logs: $LOG_FILE"
    deactivate
    cd "$ROOT"
}

deploy_frontend() {
    echo "==> frontend: build"
    cd "$APP/frontend"
    npm ci
    npm run build
    echo "    dist: $APP/frontend/dist/"
    cd "$ROOT"
}

case "${1:-all}" in
    backend)  deploy_backend ;;
    frontend) deploy_frontend ;;
    all)      deploy_backend; deploy_frontend ;;
    *)        echo "Usage: $0 [backend|frontend|all]" >&2; exit 1 ;;
esac

echo "==> done"
