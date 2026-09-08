#!/usr/bin/env bash
set -euo pipefail

php_bin="/Users/aoki_mac-mini/Library/Application Support/Local/lightning-services/php-8.2.29+0/bin/darwin-arm64/bin/php"

if [ ! -x "$php_bin" ]; then
  echo "PHP executable not found: $php_bin" >&2
  exit 1
fi

find lolipop-public -name '*.php' -print0 | while IFS= read -r -d '' file; do
  "$php_bin" -l "$file"
done
