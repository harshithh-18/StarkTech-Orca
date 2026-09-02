#!/usr/bin/env sh
#
# ORCA container entrypoint.
#
# Fetches missing data, then starts the API. The bootstrap always exits 0 — a source
# being unreachable must leave the app running and degrading honestly, not crash-looping.

set -eu

echo "─────────────────────────────────────────────────────────────"
echo " ORCA backend starting"
echo "─────────────────────────────────────────────────────────────"

if [ "${ORCA_SKIP_BOOTSTRAP:-false}" = "true" ]; then
    echo "ORCA_SKIP_BOOTSTRAP=true — not fetching data"
else
    # Backgrounded on purpose: a 60 MB Copernicus download can outlast a platform's
    # start-up health-check window, and the app is fully functional while it runs —
    # marine queries simply report a visible skipped step until the files land.
    (
        python scripts/bootstrap_data.py --days-back "${ORCA_BOOTSTRAP_DAYS:-45}" \
            || echo "bootstrap: finished with errors — continuing"
    ) &
fi

echo "Starting uvicorn on port ${PORT:-8000}"
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --app-dir backend \
    --proxy-headers \
    --forwarded-allow-ips '*'
