#!/usr/bin/env bash
# Установка и обновление сайта на сервере (Debian/Ubuntu), одной командой:
#   bash <(curl -fsSL https://raw.githubusercontent.com/onemoredayy/silchenkodrop/main/scripts/deploy.sh) drop.anikomed.online
# Повторный запуск = обновление сайта до свежей версии с GitHub. База и настройки сохраняются.
set -euo pipefail

DOMAIN="${1:-drop.anikomed.online}"
DIR=/opt/silchenkodrop
REPO=https://github.com/onemoredayy/silchenkodrop.git
say() { echo -e "\n\033[1;33m==> $*\033[0m"; }

[ "$(id -u)" = 0 ] || { echo "Запусти от root"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

say "1/7 Файл подкачки (чтобы сборке хватило памяти)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Подкачка 2 ГБ включена"
else
  echo "Уже есть"
fi

say "2/7 Программы: git, Node.js 20, Caddy"
apt-get update -qq
apt-get install -y -qq git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https openssl >/dev/null
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi
echo "node $(node -v), $(caddy version | cut -d' ' -f1)"

say "3/7 Код сайта"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin main && git -C "$DIR" reset -q --hard origin/main
else
  git clone -q "$REPO" "$DIR"
fi
cd "$DIR"

say "4/7 Порты: смотрю, что занято (ВПН не трогаю)"
busy() { ss -Hltn "sport = :$1" | grep -q .; }
caddy_on() { ss -Hltnp "sport = :$1" | grep -q caddy; }
if busy 443 && ! caddy_on 443; then
  HTTPS_PORT=8443
  echo "443 занят ВПН — сайт будет на порту 8443"
else
  HTTPS_PORT=443
  echo "443 свободен — сайт будет на обычном адресе"
fi
if busy 80 && ! caddy_on 80; then
  echo "!! Порт 80 занят другой программой — сертификат может не выпуститься:"
  ss -Hltnp "sport = :80"
fi
URL="https://$DOMAIN"; [ "$HTTPS_PORT" = 443 ] || URL="$URL:$HTTPS_PORT"

say "5/7 Настройки (.env)"
if [ ! -f .env ]; then
  cat > .env <<EOF
DATABASE_URL="file:./dev.db"
SESSION_SECRET="$(openssl rand -hex 32)"
APP_URL="$URL"
ALLOWED_ORIGINS="$DOMAIN,$DOMAIN:$HTTPS_PORT"
EOF
else
  sed -i "s|^APP_URL=.*|APP_URL=\"$URL\"|" .env
  grep -q '^APP_URL=' .env || echo "APP_URL=\"$URL\"" >> .env
  sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=\"$DOMAIN,$DOMAIN:$HTTPS_PORT\"|" .env
  grep -q '^ALLOWED_ORIGINS=' .env || echo "ALLOWED_ORIGINS=\"$DOMAIN,$DOMAIN:$HTTPS_PORT\"" >> .env
fi

say "6/7 Установка и сборка (5–10 минут, это нормально)"
FIRST=0; [ -f prisma/dev.db ] || FIRST=1
npm ci --no-audit --no-fund --loglevel=error
npx prisma db push --skip-generate >/dev/null
[ "$FIRST" = 1 ] && npm run db:seed
# Собираем в .next-new: если сборка упадёт, работающий сайт не сломается
rm -rf .next-new
NEXT_DIST_DIR=.next-new npx prisma generate >/dev/null
if ! NEXT_DIST_DIR=.next-new npx next build; then
  echo "Сборка не удалась — сайт остался на прошлой версии."
  exit 1
fi

cat > /etc/systemd/system/silchenkodrop.service <<EOF
[Unit]
Description=SilchenkoDrop
After=network.target

[Service]
WorkingDirectory=$DIR
ExecStart=$(command -v npm) start -- -p 3000 -H 127.0.0.1
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable -q silchenkodrop
systemctl stop silchenkodrop || true
rm -rf .next && mv .next-new .next
systemctl start silchenkodrop

say "7/7 HTTPS через Caddy"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN:$HTTPS_PORT {
    reverse_proxy 127.0.0.1:3000
}
EOF
systemctl enable -q caddy
systemctl restart caddy
command -v ufw >/dev/null && ufw status | grep -q active && ufw allow 80/tcp >/dev/null && ufw allow "$HTTPS_PORT"/tcp >/dev/null || true

sleep 5
echo
if systemctl is-active -q silchenkodrop; then
  echo -e "\033[1;32mГОТОВО. Сайт: $URL\033[0m"
  echo "Если сразу не открылся — подожди пару минут: выпускается сертификат."
else
  echo "Сайт не запустился. Логи: journalctl -u silchenkodrop -n 50"
fi
