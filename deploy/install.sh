#!/usr/bin/env bash
# نصب یک‌مرحله‌ای سامانه پشتیبانی میلیونر روی اوبونتو (۲۰.۰۴ به بالا)
# اجرا:  curl -fsSL https://raw.githubusercontent.com/RaminOmrani/TicketOnline/claude/ticketing-system-softmiliac-2k9y92/deploy/install.sh | sudo bash
set -euo pipefail

DOMAIN="${DOMAIN:-support.softmiliac.com}"
APP_DIR="${APP_DIR:-/var/www/millionaire-support}"
BRANCH="${BRANCH:-claude/ticketing-system-softmiliac-2k9y92}"
REPO="${REPO:-https://github.com/RaminOmrani/TicketOnline.git}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@softmiliac.com}"

if [[ $EUID -ne 0 ]]; then echo "این اسکریپت باید با sudo اجرا شود."; exit 1; fi

echo "==> [1/6] نصب پیش‌نیازها"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx openssl cron
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin || apt-get install -y docker-compose-v2
fi
systemctl enable --now docker

echo "==> [2/6] دریافت کد"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch origin "$BRANCH" && git -C "$APP_DIR" checkout -q "$BRANCH" && git -C "$APP_DIR" pull -q origin "$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> [3/6] فایل تنظیمات .env"
if [[ ! -f .env ]]; then
  ADMIN_PASSWORD="$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-14)"
  cat > .env <<EOF
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
APP_URL=https://$DOMAIN
CORS_ORIGINS=https://$DOMAIN
JWT_SECRET=$(openssl rand -hex 48)
JWT_DAYS=14
DATA_DIR=/data
TRUST_PROXY=true
ADMIN_NAME=مدیر سیستم
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=پشتیبانی میلیونر <info@softmiliac.com>
SMS_PROVIDER=
SMS_API_KEY=
SMS_SENDER=
EOF
  chmod 600 .env
  echo "    رمز مدیر اولیه ساخته شد (در پایان نمایش داده می‌شود)."
else
  ADMIN_PASSWORD="(بدون تغییر — فایل .env از قبل وجود داشت)"
fi
mkdir -p data && chown -R 1000:1000 data   # کاربر node داخل کانتینر

echo "==> [4/6] ساخت و اجرای سرویس (چند دقیقه طول می‌کشد)"
docker compose up -d --build

echo "==> [5/6] تنظیم Nginx"
sed "s/support.softmiliac.com/$DOMAIN/g" deploy/nginx/support.softmiliac.com.conf > /etc/nginx/sites-available/"$DOMAIN"
# قبل از گرفتن گواهی، بلوک SSL را موقتاً غیرفعال کن (certbot خودش اضافه می‌کند)
cat > /etc/nginx/sites-available/"$DOMAIN" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    client_max_body_size 512m;
    client_body_timeout 300s;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
    }
}
EOF
ln -sf /etc/nginx/sites-available/"$DOMAIN" /etc/nginx/sites-enabled/"$DOMAIN"
nginx -t && systemctl reload nginx

echo "==> [6/6] گواهی SSL رایگان (Let's Encrypt)"
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect; then
  echo "    SSL فعال شد."
else
  echo "    ⚠ گرفتن گواهی SSL ناموفق بود (احتمالاً DNS هنوز به این سرور اشاره نمی‌کند). بعداً این دستور را اجرا کنید:"
  echo "      sudo certbot --nginx -d $DOMAIN --redirect"
fi

# پشتیبان‌گیری روزانه
if command -v crontab >/dev/null; then
  ( crontab -l 2>/dev/null | grep -v "deploy/backup.sh" ; echo "0 3 * * * $APP_DIR/deploy/backup.sh >/dev/null 2>&1" ) | crontab - || true
fi

sleep 3
if curl -fsS http://127.0.0.1:4000/api/public/health >/dev/null; then STATUS="در حال اجرا ✅"; else STATUS="اجرا نشد ❌ (docker compose logs را ببینید)"; fi

cat <<EOF

=====================================================
  نصب تمام شد.  وضعیت سرویس: $STATUS
  آدرس:          https://$DOMAIN
  ایمیل مدیر:     $ADMIN_EMAIL
  رمز مدیر:       $ADMIN_PASSWORD
  مسیر نصب:       $APP_DIR   (داده‌ها در $APP_DIR/data)

  دستورهای مفید:
    cd $APP_DIR && docker compose logs -f        # لاگ
    cd $APP_DIR && git pull && docker compose up -d --build   # به‌روزرسانی
    nano $APP_DIR/.env && docker compose restart # تغییر تنظیمات
=====================================================
EOF
