#!/usr/bin/env bash
set -euo pipefail

# check-pmtiles: Static hosting validation utility for PMTiles
# Verifies CORS, Byte-Range headers (HTTP 206), and preflight headers

usage() {
  cat <<EOF
Usage: $(basename "$0") <PMTILES_URL>

Validates that a remote static storage endpoint properly supports PMTiles HTTP range requests.

Checks performed:
  1. HEAD request: Checks for 'Accept-Ranges: bytes'.
  2. GET byte-range: Checks for 'HTTP 206 Partial Content' and 'Content-Range'.
  3. OPTIONS preflight: Checks CORS headers ('Access-Control-Allow-Origin', 'Access-Control-Allow-Headers').

Example:
  $(basename "$0") https://r2.example.com/ethiopia.pmtiles
EOF
  exit 1
}

if [ "$#" -lt 1 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  usage
fi

URL="$1"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  Ethiopian Maps SDK — PMTiles Endpoint Validator     ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo "Target URL: ${URL}"
echo ""

FAILURES=0
WARNINGS=0

# 1. HEAD request
echo -n "[1/3] Testing HEAD request (Accept-Ranges header)... "
HEAD_OUTPUT=$(curl -sI -L --max-time 10 "${URL}" || true)

if echo "${HEAD_OUTPUT}" | grep -iq "Accept-Ranges:.*bytes"; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  echo -e "      ${YELLOW}Missing 'Accept-Ranges: bytes' response header.${NC}"
  FAILURES=$((FAILURES + 1))
fi

# 2. GET Byte-Range request (bytes 0-1023)
echo -n "[2/3] Testing GET byte-range request (Range: bytes=0-1023)... "
RANGE_HEADERS=$(curl -s -o /dev/null -D - -H "Range: bytes=0-1023" --max-time 10 "${URL}" || true)

HTTP_STATUS=$(echo "${RANGE_HEADERS}" | grep -E "HTTP/[123\.]+ [0-9]{3}" | tail -n 1 | awk '{print $2}')

if [ "${HTTP_STATUS}" = "206" ]; then
  if echo "${RANGE_HEADERS}" | grep -iq "Content-Range:"; then
    echo -e "${GREEN}PASS (HTTP 206 Partial Content)${NC}"
  else
    echo -e "${YELLOW}WARN (HTTP 206 returned, but Content-Range header missing)${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${RED}FAIL (HTTP status: ${HTTP_STATUS:-unknown}, expected 206)${NC}"
  echo -e "      ${YELLOW}Server did not return HTTP 206 Partial Content for byte-range request.${NC}"
  FAILURES=$((FAILURES + 1))
fi

# 3. OPTIONS CORS Preflight request
echo -n "[3/3] Testing CORS preflight request (OPTIONS + Access-Control headers)... "
OPTIONS_HEADERS=$(curl -s -X OPTIONS -D - -o /dev/null \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: range" \
  --max-time 10 "${URL}" || true)

CORS_ORIGIN=false
CORS_HEADERS=false

if echo "${OPTIONS_HEADERS}" | grep -iq "Access-Control-Allow-Origin:"; then
  CORS_ORIGIN=true
fi

if echo "${OPTIONS_HEADERS}" | grep -iq "Access-Control-Allow-Headers:.*range"; then
  CORS_HEADERS=true
fi

if [ "${CORS_ORIGIN}" = true ] && [ "${CORS_HEADERS}" = true ]; then
  echo -e "${GREEN}PASS${NC}"
elif [ "${CORS_ORIGIN}" = true ]; then
  echo -e "${YELLOW}WARN (Access-Control-Allow-Origin is set, but Access-Control-Allow-Headers: Range is missing)${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${RED}FAIL${NC}"
  echo -e "      ${YELLOW}Missing CORS response headers on OPTIONS request.${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Summary
echo ""
echo -e "${BLUE}======================================================${NC}"
if [ "${FAILURES}" -eq 0 ] && [ "${WARNINGS}" -eq 0 ]; then
  echo -e "${GREEN}All checks passed! This endpoint is ready for PMTiles client streaming.${NC}"
elif [ "${FAILURES}" -eq 0 ]; then
  echo -e "${YELLOW}Checks passed with ${WARNINGS} warning(s). Map may work on web but experience latency.${NC}"
else
  echo -e "${RED}Validation failed with ${FAILURES} error(s). MapLibre will fail to load tiles.${NC}"
  echo ""
  echo "Remediation Guide:"
  echo "  - Cloudflare R2 / AWS S3: Update Bucket CORS JSON policy to include:"
  echo '    "AllowedHeaders": ["Range", "*"], "ExposeHeaders": ["Content-Range", "Accept-Ranges"]'
  echo "  - Nginx: Add directives:"
  echo '    add_header Accept-Ranges bytes;'
  echo '    add_header Access-Control-Allow-Origin *;'
  echo '    add_header Access-Control-Allow-Headers "Range, Origin, Content-Type";'
  echo '    add_header Access-Control-Expose-Headers "Content-Range, Content-Length, Accept-Ranges";'
  exit 1
fi
