#!/bin/bash

# Verification script for AIVISSitemapCompiler
# Tests that the entity graph compiler is working correctly

set -e

echo "================================"
echo "AIVISSitemapCompiler Verification"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Test 1: Check if routes.json exists
echo "[TEST 1] Checking routes.json..."
if [ -f "routes.json" ]; then
    echo -e "${GREEN}✓${NC} routes.json found"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} routes.json not found"
    FAIL=$((FAIL + 1))
fi

# Test 2: Validate routes.json JSON
echo "[TEST 2] Validating routes.json JSON syntax..."
if jq . routes.json > /dev/null 2>&1; then
    ROUTE_COUNT=$(jq 'length' routes.json)
    echo -e "${GREEN}✓${NC} routes.json is valid JSON (${ROUTE_COUNT} routes)"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} routes.json has invalid JSON"
    FAIL=$((FAIL + 1))
fi

# Test 3: Check if compiler exists
echo "[TEST 3] Checking vite-aivis-sitemap-compiler.js..."
if [ -f "vite-aivis-sitemap-compiler.js" ]; then
    echo -e "${GREEN}✓${NC} Compiler plugin found"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} Compiler plugin not found"
    FAIL=$((FAIL + 1))
fi

# Test 4: Check if Vite static config exists
echo "[TEST 4] Checking vite.config.static.js..."
if [ -f "vite.config.static.js" ]; then
    echo -e "${GREEN}✓${NC} Vite static config found"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} Vite static config not found"
    FAIL=$((FAIL + 1))
fi

# Test 5: Check if public directory exists with generated pages
echo "[TEST 5] Checking generated pages in /public/..."
if [ -d "public" ]; then
    PAGE_COUNT=$(find public -name "*.html" 2>/dev/null | wc -l)
    if [ "$PAGE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} Found ${PAGE_COUNT} HTML pages in /public/"
        PASS=$((PASS + 1))
    else
        echo -e "${YELLOW}⚠${NC} /public/ directory exists but no HTML pages found (generate with: npm run generate:context)"
        FAIL=$((FAIL + 1))
    fi
else
    echo -e "${YELLOW}⚠${NC} /public/ directory not found (generate with: npm run generate:context)"
fi

# Test 6: Check if any page has schema injected
if [ -d "public" ] && [ "$(find public -name "*.html" | head -1)" != "" ]; then
    echo "[TEST 6] Checking if schema was injected into pages..."
    SAMPLE_PAGE=$(find public -name "*.html" | head -1)
    if grep -q "application/ld+json" "$SAMPLE_PAGE" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Schema found in pages"
        PASS=$((PASS + 1))
    else
        echo -e "${YELLOW}⚠${NC} No JSON-LD schema in pages (run: npm run build:static)"
    fi
fi

# Test 7: Check if url-schema.json exists
echo "[TEST 7] Checking url-schema.json..."
if [ -f "public/url-schema.json" ]; then
    if jq . public/url-schema.json > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} url-schema.json is valid"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} url-schema.json has invalid JSON"
        FAIL=$((FAIL + 1))
    fi
else
    echo -e "${YELLOW}⚠${NC} url-schema.json not found in /public/ (generate with: npm run generate:all)"
fi

# Test 8: Verify retrieval spine in routes
echo "[TEST 8] Verifying retrieval spine in compiler..."
if grep -q "AI visibility, entity resolution, and citation behavior" vite-aivis-sitemap-compiler.js; then
    echo -e "${GREEN}✓${NC} Retrieval spine defined in compiler"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} Retrieval spine not found in compiler"
    FAIL=$((FAIL + 1))
fi

# Summary
echo ""
echo "================================"
echo "Summary"
echo "================================"
echo -e "✓ Passed: ${GREEN}${PASS}${NC}"
echo -e "✗ Failed: ${RED}${FAIL}${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Generate pages: npm run generate:context"
    echo "  2. Build with schema: npm run build:static"
    echo "  3. Verify output: grep -l 'application/ld+json' public/*.html | wc -l"
    echo "  4. Deploy: wrangler pages publish public/"
    exit 0
else
    echo -e "${YELLOW}Some checks failed or incomplete.${NC}"
    echo ""
    echo "Setup steps:"
    echo "  1. npm install vite --save-dev"
    echo "  2. npm run generate:context"
    echo "  3. npm run build:static"
    echo "  4. Verify: npm run verify (this script)"
    exit 1
fi
