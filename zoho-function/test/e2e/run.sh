#!/usr/bin/env bash
# TEST PATH ONLY. Starts the fake Zoho on :8790 and a second copy of the REAL
# bridge on :8788 whose Zoho URLs point at it. The onboarding page then runs
# unmodified against it:  http://localhost:8017/?fbapi=http://localhost:8788&fbmock=off#/onboarding
# (?fbapi= is remembered by the page; point it back at :8787 afterwards.)
cd "$(dirname "$0")/../.."
node test/e2e/fake-zoho-server.js &
PORT=8788 FB_API_KEY= FB_SEAL_KEY=e2e-seal-key \
ZOHO_CLIENT_ID=fake-client ZOHO_CLIENT_SECRET=fake-secret \
ZOHO_ACCOUNTS_URL=http://localhost:8790 ZOHO_API_BASE_URL=http://localhost:8790/books/v3 \
ZOHO_REDIRECT_URI=http://localhost:8788/api/callback \
ALLOWED_ORIGINS=http://localhost:8017,http://127.0.0.1:8017 ZOHO_TIMEOUT_MS=3000 \
node dev-server.js &
wait
