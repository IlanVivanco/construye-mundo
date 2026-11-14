#!/usr/bin/env bash
# Refreshes the local DDEV clone from production: files (rsync), database (WP-CLI dump), URLs, and the local safety
# settings (Stripe in test mode without live keys, outbound plugins off, search engines blocked).
# Read-only on production. First-time setup of the DDEV project: docs/local-dev.md.
#
# Usage: scripts/clone-refresh.sh [--skip-files]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLONE="${CLONE_DIR:-$HOME/ddev/construye-mundo}"
PROD_URL="https://construyemundo.org"
LOCAL_URL="https://construye-mundo.ddev.site"
SKIP_FILES=false
[[ "${1:-}" == "--skip-files" ]] && SKIP_FILES=true

env_value() { grep -E "^$1=" "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d "\"'"; }
SSH_HOST="$(env_value SSH_HOST)"; SSH_USER="$(env_value SSH_USER)"; SSH_WP_PATH="$(env_value SSH_WP_PATH)"
SSH_PORT="$(env_value SSH_PORT)"; SSH_PORT="${SSH_PORT:-22}"
REMOTE="$SSH_USER@$SSH_HOST"
SSH=(ssh -p "$SSH_PORT" "$REMOTE")

[[ -d "$CLONE/.ddev" ]] || { echo "No DDEV project at $CLONE: see docs/local-dev.md" >&2; exit 1; }
cd "$CLONE"

if ! $SKIP_FILES; then
  echo "== Files"
  # Backups, caches, logs and the repo-mounted theme stay out. --chmod: the server's webroot permissions lock you out.
  rsync -az --info=stats1 --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r -e "ssh -p $SSH_PORT" \
    --exclude /wp-config.php --exclude /wp/ --exclude /.well-known/ \
    --exclude /wp-content/updraft/ --exclude /wp-content/cache/ --exclude '/wp-content/cache--/' \
    --exclude /wp-content/wpo-cache/ --exclude /wp-content/w3tc-config/ --exclude /wp-content/upgrade/ \
    --exclude /wp-content/upgrade-temp-backup/ --exclude /wp-content/novamira-sandbox/ \
    --exclude /wp-content/themes/construye-mundo/ --exclude '*.log' \
    "$REMOTE:$SSH_WP_PATH/" ./
fi

echo "== Database"
DUMP=".ddev/db-dumps/prod-$(date +%Y%m%d-%H%M).sql.gz"
mkdir -p .ddev/db-dumps
"${SSH[@]}" "cd $SSH_WP_PATH && php82 /usr/local/bin/wp db export - --single-transaction --quick 2>/dev/null | gzip -6" > "$DUMP"
zcat "$DUMP" | tail -1 | grep -q "Dump completed" || { echo "Incomplete dump: $DUMP" >&2; exit 1; }
ddev start >/dev/null
ddev import-db --file="$DUMP"

wp() { ddev wp "$@" 2>/dev/null; }

echo "== URLs"
# Plain and JSON-escaped (Elementor data) forms.
for host in "construyemundo.org" "www.construyemundo.org"; do
  for scheme in https http; do
    wp search-replace "$scheme://$host" "$LOCAL_URL" --all-tables --precise | tail -1
    wp search-replace "$scheme:\\/\\/$host" "${LOCAL_URL//\//\\/}" --all-tables --precise | tail -1
  done
done
# Generated CSS (Astra, Elementor fonts) keeps absolute URLs.
grep -rlZ "construyemundo\.org" wp-content/uploads wp-content/astra-local-fonts --include='*.css' 2>/dev/null \
  | xargs -0 -r sed -i -E "s#https?://(www\.)?construyemundo\.org#$LOCAL_URL#g"

echo "== Local safety"
wp eval '
$s = get_option("gravityformsaddon_gravityformsstripe_settings");
if ($s) { $s["api_mode"] = "test"; foreach ($s as $k => $v) if (str_starts_with($k, "live_")) $s[$k] = ""; update_option("gravityformsaddon_gravityformsstripe_settings", $s); }
update_option("blog_public", 0);
echo "Stripe: ", get_option("gravityformsaddon_gravityformsstripe_settings")["api_mode"] ?? "n/a", ", env: ", wp_get_environment_type(), "\n";'
# Gravity SMTP would send real mail (without it, mail goes to Mailpit); GTM and Site Kit would report local visits;
# UpdraftPlus would run backups.
wp plugin deactivate gravitysmtp duracelltomi-google-tag-manager google-site-kit updraftplus | tail -1

echo "== Caches"
wp eval '$GLOBALS["wp_fastest_cache"]->deleteCache(true); \Elementor\Plugin::$instance->files_manager->clear_cache(); echo "cleared\n";'

ls -t .ddev/db-dumps/prod-*.sql.gz | tail -n +4 | xargs -r rm --
echo "Done: $LOCAL_URL"
