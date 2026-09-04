#!/usr/bin/env bash
# پشتیبان‌گیری از دیتابیس و فایل‌های پیوست — مثال کرون: 0 3 * * * /var/www/miliac-support/deploy/backup.sh
set -euo pipefail
DATA_DIR="${DATA_DIR:-$(dirname "$0")/../data}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/miliac-support}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
# پشتیبان سازگار از SQLite (بدون توقف سرویس)
if command -v sqlite3 >/dev/null; then
  sqlite3 "$DATA_DIR/support.db" ".backup '$BACKUP_DIR/support-$STAMP.db'"
else
  cp "$DATA_DIR/support.db" "$BACKUP_DIR/support-$STAMP.db"
fi
tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$DATA_DIR" uploads branding 2>/dev/null || true
# نگه‌داری ۳۰ نسخه آخر
ls -1t "$BACKUP_DIR"/support-*.db | tail -n +31 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/uploads-*.tar.gz | tail -n +31 | xargs -r rm -f
echo "backup done: $BACKUP_DIR ($STAMP)"
