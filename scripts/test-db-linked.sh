#!/usr/bin/env bash
# Runs supabase/tests/database/*.sql against the LINKED (hosted) project without Docker,
# via `supabase db query --linked` (Management API).
#
# Safety: each file runs in one session inside `begin`, and the script ends by RAISING an
# exception that carries the results, so the whole transaction (fixtures, test rows, even the
# pgtap extension) is always rolled back. Nothing is committed to the hosted database.
#
# Usage: bash scripts/test-db-linked.sh [name ...]   (default: every test file)
set -euo pipefail

cd "$(dirname "$0")/.."
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

files=("$@")
if [ ${#files[@]} -eq 0 ]; then
  for f in supabase/tests/database/*.sql; do files+=("$(basename "$f" .sql)"); done
fi

total_fail=0
for t in "${files[@]}"; do
  src="supabase/tests/database/$t.sql"
  plan="$(grep -oE 'plan\([0-9]+\)' "$src" | grep -oE '[0-9]+')"
  # Capture every assertion's TAP line in a temp table; drop finish()/rollback; end with RAISE.
  grep -v -E '^select \* from finish\(\);$|^rollback;$' "$src" \
    | sed -E 's/^(select plan\([0-9]+\);)$/\1\ncreate temp table tap_out (n serial, line text);\ngrant all on pg_temp.tap_out to public;\ngrant all on sequence pg_temp.tap_out_n_seq to public;/' \
    | sed -E 's/^select (is|isnt|ok|throws_ok|lives_ok)\(/insert into pg_temp.tap_out (line) select \1(/' \
    > "$work/$t.sql"
  cat >> "$work/$t.sql" <<'EOF'
reset role;
do $$
declare r text;
begin
  select string_agg(line, E'\n' order by n) into r from pg_temp.tap_out;
  raise exception E'TAPSTART\n%\nTAPEND', r;
end $$;
EOF

  npx --no-install supabase db query --linked -f "$work/$t.sql" > "$work/$t.out" 2>&1 || true
  if ! grep -q TAPSTART "$work/$t.out"; then
    echo "=== $t: ERROR (script did not reach the end)"
    head -c 1500 "$work/$t.out"; echo
    total_fail=$((total_fail + 1))
    continue
  fi
  # Unescape the JSON error text into lines.
  tap="$(sed 's/\\\\n/\n/g; s/\\n/\n/g' "$work/$t.out" | sed -n '/TAPSTART/,/TAPEND/p')"
  pass="$(grep -cE '^ok [0-9]+' <<<"$tap" || true)"
  fail="$(grep -cE '^not ok [0-9]+' <<<"$tap" || true)"
  ran=$((pass + fail))
  echo "=== $t: $pass passed, $fail failed, $ran of $plan planned"
  if [ "$fail" -gt 0 ]; then grep -A4 -E '^not ok' <<<"$tap" | sed 's/\\$//'; fi
  if [ "$fail" -gt 0 ] || [ "$ran" -ne "$plan" ]; then total_fail=$((total_fail + 1)); fi
done

[ "$total_fail" -eq 0 ] && echo "ALL DB TESTS PASSED (rolled back)" || { echo "DB TESTS FAILED"; exit 1; }
