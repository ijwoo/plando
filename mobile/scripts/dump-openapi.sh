#!/usr/bin/env bash
# Refresh openapi.json from the backend, then regenerate TS types.
#
# Prereq: run the backend on the feat/openapi-spec branch locally, e.g.
#   (in plando/todo)  ./gradlew bootRun --args='--spring.profiles.active=dev --server.port=8081'
#
# The springdoc dependency is ONLY on that branch and is never deployed to prod.
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8081}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ fetching ${BACKEND_URL}/v3/api-docs"
curl -sf "${BACKEND_URL}/v3/api-docs" -o "${HERE}/openapi.json"
echo "→ saved openapi.json ($(wc -c < "${HERE}/openapi.json") bytes)"

echo "→ generating types"
(cd "${HERE}" && npm run gen:api)
echo "✓ done"
