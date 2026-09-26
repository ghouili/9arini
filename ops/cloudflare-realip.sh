#!/usr/bin/env bash
# Writes /etc/nginx/conf.d/cloudflare-realip.conf from Cloudflare's published ranges,
# so $remote_addr is the visitor's IP, not a Cloudflare edge (DEPLOY.md §6 ordering note).
# Without it the per-IP OTP limiter collapses into one bucket per Cloudflare node.
# Run as root; re-run occasionally (ranges change rarely).
set -euo pipefail
OUT=/etc/nginx/conf.d/cloudflare-realip.conf
TMP=$(mktemp)
{
  echo "# generated $(date -I) by cloudflare-realip.sh — do not edit by hand"
  for ip in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
    echo "set_real_ip_from $ip;"
  done
  echo "real_ip_header CF-Connecting-IP;"
} > "$TMP"
grep -q "set_real_ip_from" "$TMP" || { echo "Could not fetch Cloudflare ranges; nothing changed."; exit 1; }
install -m 644 "$TMP" "$OUT" && rm -f "$TMP"
nginx -t && systemctl reload nginx
echo "✓ $OUT written ($(grep -c set_real_ip_from "$OUT") ranges), nginx reloaded"
