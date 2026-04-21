# Deploying cheatsheet-app

Runbook for deploying to the shared VPS that already hosts `agentic-trading-system`.

- **Server:** `root@5.223.57.12` (Ubuntu 22.04, 1 core, 2 GB RAM)
- **Public URL:** http://cheatsheet.norafeng.duckdns.org/
- **Co-tenant:** `agentic-trading-system` at `http://5.223.57.12/` on backend port `:8000`. Cheatsheet uses `:8001` and its own nginx server block.

## One-time setup

### 1. DNS (do this first, ~5 min)

Sign up at <https://www.duckdns.org> and claim `norafeng` (or whatever root you want; update every path below accordingly). Add the IP `5.223.57.12`. Enable wildcard — DuckDNS supports `*.norafeng.duckdns.org` pointing to the same host.

Verify once propagated:

```bash
dig +short cheatsheet.norafeng.duckdns.org
# → 5.223.57.12
```

### 2. Add swap (critical — 2 GB RAM + Playwright without swap will OOM)

```bash
ssh root@5.223.57.12
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h   # should show 2G swap now
```

### 3. Clone the repo

```bash
git clone https://github.com/fengyaontu-creator/Cheatsheet-Generator.git /opt/cheatsheet
cd /opt/cheatsheet
```

### 4. Python env + Playwright

```bash
cd /opt/cheatsheet/cheatsheet-app/backend
apt update && apt install -y python3.10-venv   # if not already available
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
playwright install-deps chromium    # installs libnss3 etc. — one-time, needs root
deactivate
```

### 5. Node for frontend build

```bash
# nodesource install, once:
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
cd /opt/cheatsheet/cheatsheet-app/frontend
npm ci
```

### 6. `.env` at `/opt/cheatsheet/.env`

Copy your local `cheatsheet-app/backend/.env` over, then **edit for production**:

```bash
scp cheatsheet-app/backend/.env root@5.223.57.12:/opt/cheatsheet/.env
ssh root@5.223.57.12
chmod 600 /opt/cheatsheet/.env
nano /opt/cheatsheet/.env
```

Make sure these are set:

```
CORS_ORIGINS=http://cheatsheet.norafeng.duckdns.org
OPENROUTER_API_KEY=<cheatsheet-scoped key, recommended>
LLM_PROVIDER=openrouter
LLM_MODEL=<whichever model you picked>
```

Keep `.env` out of git — already covered by the root `.gitignore`.

### 7. nginx server block

```bash
cp /opt/cheatsheet/deploy/nginx-cheatsheet.conf /etc/nginx/sites-available/cheatsheet
ln -s /etc/nginx/sites-available/cheatsheet /etc/nginx/sites-enabled/cheatsheet
nginx -t
systemctl reload nginx
```

The trading-app server block is untouched; the two coexist because they match different `server_name` values.

### 8. First boot

```bash
cd /opt/cheatsheet
./deploy.sh all
```

This builds the frontend, starts the backend on `127.0.0.1:8001` via `nohup`, and writes logs to `/opt/cheatsheet/logs/backend.log`. Verify:

```bash
curl -s http://127.0.0.1:8001/          # {"status":"ok"}
curl -s http://cheatsheet.norafeng.duckdns.org/api/
# then open http://cheatsheet.norafeng.duckdns.org/ in a browser
```

## Standard release flow

Mirrors the trading-app workflow.

**Local:**

```bash
git push origin main
```

**Server:**

```bash
ssh root@5.223.57.12
cd /opt/cheatsheet
./deploy.sh         # pulls + rebuilds everything (safe default)
# or narrow:
./deploy.sh frontend    # only static files changed
./deploy.sh backend     # only Python / .env changed
```

`./deploy.sh` always pulls first, then runs the stages you asked for. No argument = all.

## Operational notes

- **Logs:** `tail -f /opt/cheatsheet/logs/backend.log` — uvicorn writes access + errors here. nginx logs under `/var/log/nginx/`.
- **Backend PID:** `cat /opt/cheatsheet/backend.pid`. `ps -p $(cat ...)` confirms it's alive.
- **Restart without pulling:** `kill $(cat /opt/cheatsheet/backend.pid)` then rerun the `nohup uvicorn ...` line from `deploy.sh`. Or just `./deploy.sh backend`.
- **Stage cache:** `/opt/cheatsheet/cheatsheet-app/backend/app/.cache/extractor/` — safe to delete if an old prompt version is stuck cached. The next generation re-populates.
- **Playwright concurrency cap:** keep PDF exports to one at a time while running on this box; the backend's in-memory job registry already serializes generation, but PDF export is a separate endpoint. If you see OOMs, hardcode a semaphore around it.

## Upgrading to systemd (future)

`nohup` has no auto-restart, no resource limits, no boot integration. When those bite, swap to the systemd unit at [deploy/cheatsheet-backend.service.example](deploy/cheatsheet-backend.service.example) — instructions are in the file header. Takes ~5 minutes. `deploy.sh` then calls `systemctl restart` instead of kill-and-nohup.

## Getting HTTPS (future)

DuckDNS + Let's Encrypt works via `certbot --nginx`. Install when you're ready:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d cheatsheet.norafeng.duckdns.org
```

Certbot edits the server block to add TLS + auto-renew. No code changes needed; `CORS_ORIGINS` just needs an extra `https://` entry.
