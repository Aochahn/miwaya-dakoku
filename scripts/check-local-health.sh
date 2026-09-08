#!/usr/bin/env bash
set -euo pipefail

base_url="${LOCAL_BY_FLYWHEEL_URL:-http://127.0.0.1:10003}"
host_header="${LOCAL_BY_FLYWHEEL_HOST_HEADER:-Host: dakoku-app.local}"

echo "Checking health.php..."
if ! curl -sS -H "$host_header" "$base_url/health.php"; then
  echo
  echo "Local site is not reachable. Start dakoku-app in Local by Flywheel, then run this task again." >&2
  exit 1
fi
echo

echo "Checking public users API..."
curl -sS -H "$host_header" "$base_url/api/users.php"
echo

echo "Checking protected admin API..."
curl -sS -i -H "$host_header" "$base_url/api/attendance.php"
