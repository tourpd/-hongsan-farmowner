#!/usr/bin/env bash
set -euo pipefail

echo "== civic-watchboard metrics build =="

DB="data/civicwatch.db"
SQL_MONTH="sql/card_month.sql"
SQL_YEAR="sql/card_year.sql"
SQL_YEAR_PIVOT="sql/card_year_pivot.sql"
SQL_BUDGET="sql/card_budget.sql"

OUT_MONTH="data/out_card_month.csv"
OUT_YEAR="data/out_card_year.csv"
OUT_YEAR_PIVOT="data/out_card_year_pivot.csv"
OUT_BUDGET="data/out_card_budget.csv"

PUB_DIR="public/data"

test -f "$DB" || { echo "❌ DB not found: $DB"; exit 1; }
test -f "$SQL_MONTH" || { echo "❌ SQL not found: $SQL_MONTH"; exit 1; }
test -f "$SQL_YEAR" || { echo "❌ SQL not found: $SQL_YEAR"; exit 1; }
test -f "$SQL_YEAR_PIVOT" || { echo "❌ SQL not found: $SQL_YEAR_PIVOT"; exit 1; }
test -f "$SQL_BUDGET" || { echo "❌ SQL not found: $SQL_BUDGET"; exit 1; }

echo "✅ DB: $DB"
echo "✅ SQL: $SQL_MONTH, $SQL_YEAR, $SQL_YEAR_PIVOT, $SQL_BUDGET"
echo

echo "-- card_month (preview) --"
sqlite3 -header -column "$DB" < "$SQL_MONTH" || true
echo

echo "-- card_year (preview) --"
sqlite3 -header -column "$DB" < "$SQL_YEAR" || true
echo

echo "-- card_year_pivot (preview) --"
sqlite3 -header -column "$DB" < "$SQL_YEAR_PIVOT" || true
echo

echo "-- card_budget (preview) --"
sqlite3 -header -column "$DB" < "$SQL_BUDGET" || true
echo

echo "-- export csv --"
sqlite3 -header -csv "$DB" < "$SQL_MONTH" > "$OUT_MONTH"
sqlite3 -header -csv "$DB" < "$SQL_YEAR" > "$OUT_YEAR"
sqlite3 -header -csv "$DB" < "$SQL_YEAR_PIVOT" > "$OUT_YEAR_PIVOT"
sqlite3 -header -csv "$DB" < "$SQL_BUDGET" > "$OUT_BUDGET"

mkdir -p "$PUB_DIR"
cp -v "$OUT_MONTH" "$OUT_YEAR" "$OUT_YEAR_PIVOT" "$OUT_BUDGET" "$PUB_DIR/" >/dev/null

echo "✅ wrote:"
echo " - $OUT_MONTH"
echo " - $OUT_YEAR"
echo " - $OUT_YEAR_PIVOT"
echo " - $OUT_BUDGET"
echo " - $PUB_DIR/out_card_month.csv"
echo " - $PUB_DIR/out_card_year.csv"
echo " - $PUB_DIR/out_card_year_pivot.csv"
echo " - $PUB_DIR/out_card_budget.csv"
echo

echo "-- csv row counts (including header) --"
wc -l "$OUT_MONTH" "$OUT_YEAR" "$OUT_YEAR_PIVOT" "$OUT_BUDGET" | tail -n 1 || true