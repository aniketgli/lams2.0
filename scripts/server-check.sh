#!/usr/bin/env bash
# Read-only check of the portal folder on the server (changes nothing).
#   cd /erp_wii/applications/lams2.0 && bash scripts/server-check.sh
#
# What belongs in the app folder:
#   the Git checkout (source, migrations, scripts), node_modules/ and dist/ (made by npm ci / npm run build),
#   and .env (secrets, readable only by the app user: chmod 600).
# What does NOT belong there: uploaded files (UPLOAD_DIR on the RAID disk), database dumps / backups,
#   logs, editor or tool folders, copies of files (*.bak, *.old, "copy of ..."), or local changes to tracked files.
set -u
cd "$(dirname "$0")/.." || exit 1
APP_DIR="$(pwd)"
fail=0; warn=0
ok()   { printf 'PASS  %s\n' "$1"; }
bad()  { printf 'FAIL  %s\n' "$1"; fail=$((fail + 1)); }
note() { printf 'WARN  %s\n' "$1"; warn=$((warn + 1)); }

echo "Checking $APP_DIR"

# 1. Git working tree
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  changed=$(git status --porcelain --untracked-files=no)
  if [ -z "$changed" ]; then ok "No local changes to tracked files (git pull will work)"; else bad "Tracked files changed on the server (git pull will fail):"; echo "$changed" | sed 's/^/        /'; fi
  untracked=$(git status --porcelain --untracked-files=all | grep '^??' | cut -c4-)
  if [ -z "$untracked" ]; then ok "No stray files in the app folder"; else note "Files in the app folder that are not part of the app (move or delete them):"; echo "$untracked" | head -40 | sed 's/^/        /'; fi
  remote=$(git remote get-url origin 2>/dev/null || true)
  case "$remote" in *@github.com*|*://*:*@*) bad "The Git remote URL contains a login or token: $(echo "$remote" | sed -E 's#//[^@]*@#//***@#')";; *) ok "Git remote has no token in its URL";; esac
  [ -f "$HOME/.git-credentials" ] && note "$HOME/.git-credentials stores a GitHub login in plain text: prefer a read-only deploy key"
else
  bad "This folder is not a Git checkout"
fi

# 2. Secrets
if [ -f .env ]; then
  perm=$(stat -c '%a' .env)
  if [ "$perm" = "600" ] || [ "$perm" = "400" ]; then ok ".env is readable only by its owner ($perm)"; else bad ".env permissions are $perm: run  chmod 600 .env"; fi
  grep -qE '^SESSION_SECRET=.{32,}' .env && ! grep -qE '^SESSION_SECRET=a_very_secure' .env && ok "SESSION_SECRET is set and long" || bad "SESSION_SECRET is missing, short or the example value: set a new random one (openssl rand -base64 48)"
  grep -qE '^SETTINGS_ENCRYPTION_KEY=.{32,}' .env && ok "SETTINGS_ENCRYPTION_KEY is set" || bad "SETTINGS_ENCRYPTION_KEY is missing or short: Aadhaar / bank account numbers cannot be saved, and the SMTP password is then encrypted with SESSION_SECRET, so changing SESSION_SECRET would make it unreadable. Set one (openssl rand -base64 48), the same on the PC"
  grep -qE '^(DATABASE_URL|LAMS_PROD_DB_URL)=mysql://lams2_admin' .env && bad "The app connects as lams2_admin: use the limited lams2_app user in .env"
  grep -qE '^NODE_ENV=production' .env && ok "NODE_ENV=production" || note "NODE_ENV=production is not set in .env (check the service file)"
else
  bad ".env is missing"
fi
for f in .env.local .env.production .env.backup .env.old; do [ -f "$f" ] && note "Extra secrets file $f: delete it once its values are in .env"; done

# 3. Uploads
upload=$(grep -E '^UPLOAD_DIR=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
if [ -z "$upload" ]; then
  note "UPLOAD_DIR is not set: uploads are kept inside the database, not on the RAID disk"
else
  case "$upload" in "$APP_DIR"*) bad "UPLOAD_DIR ($upload) is inside the app folder: put it on the RAID data disk";; esac
  if [ -d "$upload" ] && [ -w "$upload" ]; then ok "UPLOAD_DIR $upload exists and is writable ($(df -h "$upload" | awk 'NR==2 {print $6 ", " $4 " free"}'))"; else bad "UPLOAD_DIR $upload is missing or not writable by $(whoami)"; fi
  [ -d "$upload" ] && [ "$(stat -c '%a' "$upload")" -gt 750 ] && note "UPLOAD_DIR permissions are $(stat -c '%a' "$upload"): 750 is enough"
fi

# 4. Things that should not live in the app folder
dumps=$(find . \( -path ./node_modules -o -path ./.git -o -path '*/migrations' -o -path ./scripts \) -prune -o -type f \( -name '*.sql' -o -name '*.sql.gz' -o -name '*.dump' -o -name '*.bak' -o -name '*.backup' -o -name '*.old' -o -name '*.zip' -o -name '*.tar*' \) -print 2>/dev/null | head -20)
[ -n "$dumps" ] && { bad "Backups / dumps inside the app folder (move them to the backup disk):"; echo "$dumps" | sed 's/^/        /'; } || ok "No database dumps or backup copies in the app folder"
for d in uploads backups logs .vscode .idea .claude .aistudio; do [ -e "$d" ] && note "$d/ is in the app folder: it does not belong here"; done

# 5. Build present
[ -d node_modules ] && ok "node_modules present" || bad "node_modules missing: run  npm ci"
[ -f dist/index.html ] && ok "dist/ built" || bad "dist/ missing: run  npm run build"

echo
echo "$fail failure(s), $warn warning(s)."
[ "$fail" -eq 0 ]
