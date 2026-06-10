#!/usr/bin/env bash
# Security smoke test for Guileo Pages Functions.
# Usage: ./scripts/security-smoke.sh https://<preview>.guileoai.pages.dev
# Run against a PREVIEW deployment — never against prod during business hours.
# Each check curls an endpoint and asserts the guard fires. Exit code = number of failures.
set -u

BASE="${1:?Usage: $0 <preview-base-url> (e.g. https://abc123.guileoai.pages.dev)}"
BASE="${BASE%/}"
ORIGIN="https://guileoai.com"
FAILS=0

check() { # name expected_desc condition(0=pass)
  local name="$1"; shift
  if "$@"; then echo "PASS  $name"; else echo "FAIL  $name"; FAILS=$((FAILS + 1)); fi
}

status_of() { # method path extra-curl-args... -> http status
  local method="$1" path="$2"; shift 2
  curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE$path" "$@"
}

body_of() {
  local method="$1" path="$2"; shift 2
  curl -s -X "$method" "$BASE$path" "$@"
}

echo "Target: $BASE"
echo

# 1) /api/lead without Origin/Referer -> 403 (sameOrigin guard)
s=$(status_of POST /api/lead -H "Content-Type: application/json" -d '{"name":"smoke","email":"smoke@test.dev"}')
check "lead: no Origin -> 403 (got $s)" test "$s" = "403"

# 2) /api/lead with honeypot filled (valid Origin) -> 200 with stored:false, nothing persisted
b=$(body_of POST /api/lead -H "Content-Type: application/json" -H "Origin: $ORIGIN" \
  -d '{"name":"smoke-bot","email":"bot@test.dev","website":"http://spam.example"}')
check "lead: honeypot -> ok:true + stored:false (got $b)" \
  bash -c "echo '$b' | grep -q '\"ok\":true' && echo '$b' | grep -q '\"stored\":false'"

# 3) /api/lead from a hostile Origin -> 403
s=$(status_of POST /api/lead -H "Content-Type: application/json" -H "Origin: https://evil.example" -d '{"email":"x@y.z"}')
check "lead: evil Origin -> 403 (got $s)" test "$s" = "403"

# 4) /api/email to a NON-owner recipient (valid Origin) -> 403 (recipient allowlist)
s=$(status_of POST /api/email -H "Content-Type: application/json" -H "Origin: $ORIGIN" \
  -d '{"to":"victim@attacker.example","subject":"x","html":"<b>x</b>"}')
check "email: non-owner recipient -> 403 (got $s)" test "$s" = "403"

# 5) /api/email without Origin -> 403 (sameOrigin guard added in pre-launch pass)
s=$(status_of POST /api/email -H "Content-Type: application/json" \
  -d '{"to":"smart@guileoai.com","subject":"x","html":"x"}')
check "email: no Origin -> 403 (got $s)" test "$s" = "403"

# 6) /api/daily-digest to a non-owner -> blocked (401 = token gate fires first when
#    DIGEST_TOKEN is set — even stronger; 403 = recipient lock fires)
s=$(status_of GET "/api/daily-digest?to=victim@attacker.example&token=guileo2026")
check "digest: non-owner recipient -> 401/403 (got $s)" bash -c "test '$s' = '401' -o '$s' = '403'"

# 7) /api/daily-digest with wrong token -> 401 (only when DIGEST_TOKEN is set in env)
s=$(status_of GET "/api/daily-digest?to=smart@guileoai.com&token=definitely-wrong-token")
if [ "$s" = "401" ]; then
  echo "PASS  digest: wrong token -> 401"
else
  echo "WARN  digest: wrong token -> $s (401 expected; if 200, DIGEST_TOKEN is NOT set in Cloudflare env — set it)"
fi

# 8) /api/call with an invalid phone (valid Origin) -> 400, and never reaches the provider
s=$(status_of POST /api/call -H "Content-Type: application/json" -H "Origin: $ORIGIN" -d '{"phone":"not-a-phone"}')
check "call: invalid phone -> 400 (got $s)" test "$s" = "400"

# 9) /api/call without Origin -> 403
s=$(status_of POST /api/call -H "Content-Type: application/json" -d '{"phone":"+15551234567"}')
check "call: no Origin -> 403 (got $s)" test "$s" = "403"

# 10) /api/agent-action without the shared secret -> 401
s=$(status_of POST /api/agent-action -H "Content-Type: application/json" -d '{"action":"lead","name":"smoke"}')
check "agent-action: no secret -> 401 (got $s)" test "$s" = "401"

# 11) API responses carry their own security headers (_headers does not cover functions)
h=$(curl -s -D - -o /dev/null -X POST "$BASE/api/lead" -H "Content-Type: application/json" -d '{}')
check "api headers: nosniff present" bash -c "echo '$h' | grep -qi 'x-content-type-options: nosniff'"
check "api headers: no-store present" bash -c "echo '$h' | grep -qi 'cache-control: no-store'"

# 12) Static route still serves the _headers security set
h=$(curl -s -D - -o /dev/null "$BASE/")
check "static headers: CSP present" bash -c "echo '$h' | grep -qi 'content-security-policy:'"
check "static headers: XFO DENY" bash -c "echo '$h' | grep -qi 'x-frame-options: deny'"

echo
if [ "$FAILS" -eq 0 ]; then echo "ALL CHECKS PASSED"; else echo "$FAILS CHECK(S) FAILED"; fi
exit "$FAILS"
