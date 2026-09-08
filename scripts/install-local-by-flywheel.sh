#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/local-site/app/public" >&2
  exit 1
fi

target_public="$1"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
source_public="$repo_root/lolipop-public"

if [ ! -d "$source_public" ]; then
  echo "Source folder not found: $source_public" >&2
  exit 1
fi

if [ ! -d "$target_public" ]; then
  echo "Target public folder not found: $target_public" >&2
  exit 1
fi

if [ -f "$target_public/wp-config.php" ] || [ -d "$target_public/wp-admin" ]; then
  backup_root="$(dirname "$target_public")/_wordpress-backups"
  backup_dir="$backup_root/wordpress-backup-$(date +%Y%m%d%H%M%S)"
  mkdir -p "$backup_dir"

  for item in index.php license.txt readme.html wp-activate.php wp-admin wp-blog-header.php wp-comments-post.php wp-config.php wp-config-sample.php wp-content wp-cron.php wp-includes wp-links-opml.php wp-load.php wp-login.php wp-mail.php wp-settings.php wp-signup.php wp-trackback.php xmlrpc.php; do
    if [ -e "$target_public/$item" ]; then
      mv "$target_public/$item" "$backup_dir/"
    fi
  done

  echo "WordPress files were moved to: $backup_dir"
fi

rsync -a \
  --exclude '.DS_Store' \
  --exclude 'private/config.php' \
  "$source_public/" \
  "$target_public/"

cp "$source_public/private/config.local.sample.php" "$target_public/private/config.php"
mkdir -p "$target_public/storage/photos"

echo "Installed dakoku-app files into: $target_public"
echo "Next: import $target_public/private/schema.sql from Local's Adminer."
