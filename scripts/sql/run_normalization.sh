#!/usr/bin/env bash
# Runs the six normalization migrations (migrations/20261219_01 … 06) in order, as the MySQL root user.
# Take a backup first. Every file stops on its own checks before changing anything it cannot finish, and
# each file is safe to run again.
#
#   bash scripts/sql/run_normalization.sh lams2_db
#
# It asks for the MySQL root password once per file (or set MYSQL_PWD in the environment for this shell only).
set -euo pipefail

DB="${1:-}"
if [[ -z "$DB" ]]; then echo "Usage: bash scripts/sql/run_normalization.sh <database>"; exit 2; fi
cd "$(dirname "$0")/../.."

FILES=(
  migrations/20261219_01_foundation.sql
  migrations/20261219_02_list_tables.sql
  migrations/20261219_03_master_columns.sql
  migrations/20261219_04_employee_profile.sql
  migrations/20261219_05_lists.sql
  migrations/20261219_06_foreign_keys.sql
)
for f in "${FILES[@]}"; do [[ -f "$f" ]] || { echo "Missing $f (run git pull first)"; exit 1; }; done

read -r -p "Backup of $DB taken and the app stopped? Type YES to continue: " ok
[[ "$ok" == "YES" ]] || { echo "Stopped. Nothing was changed."; exit 1; }

ASK=(-p); [[ -n "${MYSQL_PWD:-}" ]] && ASK=()
for f in "${FILES[@]}"; do
  echo "== $f"
  if ! mysql -u root "${ASK[@]}" "$DB" < "$f"; then
    echo "!! $f stopped. Read the message above, fix it, then run this script again (finished steps are skipped)."
    exit 1
  fi
done
echo "All six steps done. Now: git pull && npm run build, restart the app, then npm run db:check."
