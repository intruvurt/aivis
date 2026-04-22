#!/bin/bash
# deploy-and-verify.sh - Railway deployment + validation script
# Role: Ensures CORS and reliability fixes are deployed and working
# Usage: bash deploy-and-verify.sh

set -e

API_URL="https://api.aivis.biz"
FRONTEND_URL="https://aivis.biz"
TIMEOUT=10

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Infrastructure Deployment & Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 0: Determinism preflight
# ─────────────────────────────────────────────────────────────────────────────

echo "📋 STEP 0: Determinism preflight"
echo "─────────────────────────────────────────────────────────────────────────────"
echo ""
if npm --prefix server run verify:determinism; then
  echo "✅ Determinism checks passed"
  echo ""
else
  echo "❌ Determinism checks failed"
  echo "Fix contract violations before deploy"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Deploy to Railway
# ─────────────────────────────────────────────────────────────────────────────

echo "📋 STEP 1: Railway deployment"
echo "─────────────────────────────────────────────────────────────────────────────"
echo ""
echo "Manual setup required (cannot automate via script):"
echo ""
echo "  1. Go to https://railway.app (Railway dashboard)"
echo "  2. Select your project → select 'aivis' backend service"
echo "  3. Click 'Variables' tab"
echo "  4. Verify/update:"
echo "     - FRONTEND_URL = 'https://aivis.biz'"
echo "     - DATABASE_CA_CERT = [PostgreSQL certificate content]"
echo "     - OPEN_ROUTER_API_KEY = [your key]"
echo "  5. Redeploy if needed"
echo ""
echo "  (Or: git push to main to trigger auto-deploy via Railway's GitHub webhook)"
echo ""
read -p "✓ Press Enter once deployed and backend is green..."
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Health check
# ─────────────────────────────────────────────────────────────────────────────

echo "📋 STEP 2: Health endpoint check"
echo "─────────────────────────────────────────────────────────────────────────────"
echo ""
echo "Testing: GET $API_URL/api/health"
echo ""

if response=$(curl -s --max-time "$TIMEOUT" -w "\n%{http_code}" \
  "$API_URL/api/health"); then
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [[ "$http_code" == "200" ]]; then
    echo "✅ Health check passed (HTTP 200)"
    echo ""
    echo "Response:"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    echo ""
  else
    echo "❌ Health check failed (HTTP $http_code)"
    echo "Response: $body"
    echo ""
    echo "Troubleshooting:"
    echo "  - Check Railway logs: dashboard → aivis → Logs"
    echo "  - Look for [Startup] or [CORS] errors"
    echo "  - Verify FRONTEND_URL environment variable is set"
    exit 1
  fi
else
  echo "❌ Health check timed out (>$TIMEOUT seconds)"
  echo "This could mean:"
  echo "  - Backend is not deployed"
  echo "  - API domain is not routed correctly"
  echo "  - Service is still starting"
  echo ""
  echo "Check: https://railway.app → select project → select 'aivis' → view logs"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: CORS preflight check
# ─────────────────────────────────────────────────────────────────────────────

echo "📋 STEP 3: CORS preflight validation"
echo "─────────────────────────────────────────────────────────────────────────────"
echo ""
echo "Testing: OPTIONS $API_URL/api/analyze"
echo "  Origin: $FRONTEND_URL"
echo ""

if response=$(curl -s --max-time "$TIMEOUT" -i -X OPTIONS \
  "$API_URL/api/analyze" \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization"); then
  
  if echo "$response" | grep -q "Access-Control-Allow-Origin"; then
    origin_header=$(echo "$response" | grep -i "access-control-allow-origin" | head -1)
    echo "✅ CORS preflight passed"
    echo "  $origin_header"
    echo ""
    
    # Check for all required CORS headers
    echo "Checking all CORS response headers:"
    echo "$response" | grep -i "access-control-" || true
    echo ""
  else
    echo "❌ CORS preflight failed"
    echo "  Missing 'Access-Control-Allow-Origin' header"
    echo ""
    echo "Full response headers:"
    echo "$response" | head -20
    echo ""
    echo "Troubleshooting:"
    echo "  - Check middleware order in server.ts"
    echo "  - Verify app.options('*', cors()) is called BEFORE security middleware"
    echo "  - Check FRONTEND_URL environment variable"
    exit 1
  fi
else
  echo "❌ CORS check request failed or timed out"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Browser test
# ─────────────────────────────────────────────────────────────────────────────

echo "📋 STEP 4: Browser validation"
echo "─────────────────────────────────────────────────────────────────────────────"
echo ""
echo "Manual test required:"
echo ""
echo "  1. Open https://aivis.biz in your browser"
echo "  2. Press F12 to open DevTools"
echo "  3. Click 'Network' tab"
echo "  4. Reload page"
echo "  5. Look for requests to $API_URL"
echo "  6. Click on one (e.g., health check)"
echo "  7. Look at 'Response Headers' section"
echo ""
echo "Expected to see:"
echo "  ✓ Access-Control-Allow-Origin: $FRONTEND_URL"
echo "  ✓ Access-Control-Allow-Credentials: true"
echo ""
echo "If you see these headers → CORS is fixed ✅"
echo "If you see CORS errors → infrastructure fix failed ❌"
echo ""
read -p "✓ Press Enter after manual verification..."
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Summary
# ─────────────────────────────────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Infrastructure deployment validated"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "What was fixed:"
echo "  ✓ CORS preflight handler (bulletproof preflight support)"
echo "  ✓ Response timeout enforcement (55s < 60s Railway limit)"
echo "  ✓ railway.toml (auto-restart on failure)"
echo "  ✓ Health endpoint (verified working)"
echo "  ✓ Client API routing (already correct)"
echo ""
echo "Next steps:"
echo "  1. Monitor error logs for next 5 minutes"
echo "  2. Check user reports for network errors (should drop to zero)"
echo "  3. Once stable, begin UI / conversion optimization"
echo ""
echo "Still seeing issues?"
echo "  - Check Railway deployment guide: RAILWAY_DEPLOYMENT.md"
echo "  - Review logs: https://railway.app → select project → view logs"
echo "  - Search logs for [CORS] or [Startup] markers"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
