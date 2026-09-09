#!/usr/bin/env bash
# One-time setup for an Oracle Cloud "Always Free" Ampere (arm64) VM running
# Ubuntu 22.04/24.04. Run as the default 'ubuntu' user.
#
#   curl -fsSL https://raw.githubusercontent.com/zahrazamani/myRI-bkfn/main/deploy/setup-oracle.sh | bash
#
# or: git clone the repo, then bash deploy/setup-oracle.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/zahrazamani/myRI-bkfn.git}"
APP_DIR="${APP_DIR:-$HOME/myRI-bkfn}"

echo "==> Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
	curl -fsSL https://get.docker.com | sudo sh
	sudo usermod -aG docker "$USER"
fi

echo "==> Opening the firewall for HTTP/HTTPS"
sudo iptables -I INPUT 5 -p tcp --dport 80  -j ACCEPT || true
sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT || true
sudo netfilter-persistent save || true
# NB: you must ALSO add ingress rules for 80 and 443 in the Oracle Cloud
#     console (VCN > Security List / Network Security Group).

echo "==> Fetching the code"
if [ -d "$APP_DIR/.git" ]; then
	git -C "$APP_DIR" pull --ff-only
else
	git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

if [ ! -f backend/.env ]; then
	cp backend/.env.example backend/.env
	echo
	echo "  >>> Edit backend/.env now: set GEMINI_API_KEY, MYRI_DOMAIN,"
	echo "      MYRI_ALLOWED_ORIGINS, MYRI_ADMIN_TOKEN, VITE_API_BASE_URL,"
	echo "      and (optional) Turnstile / Google Sign-In keys. See the comments"
	echo "      in the file and DEPLOY.md. Then re-run this script."
	exit 0
fi

echo "==> Building and starting"
sudo docker compose --env-file backend/.env -f deploy/docker-compose.yml up -d --build

echo
echo "==> Up. Check:  sudo docker compose --env-file backend/.env -f deploy/docker-compose.yml logs -f"
echo "    Once DNS for \$MYRI_DOMAIN points here, Caddy will get a TLS cert automatically."
echo
echo "==> Next: ingest documents inside the container:"
echo "    sudo docker compose --env-file backend/.env -f deploy/docker-compose.yml exec app python ingest.py"
