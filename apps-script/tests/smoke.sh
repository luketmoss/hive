#!/bin/bash
# Smoke tests for the Apps Script web app API.
# Usage: ./smoke.sh <DEPLOYMENT_URL>
#
# Example:
#   ./smoke.sh "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
#
# All operations use GET since Apps Script redirects break POST for anonymous callers.
# Write operations pass data via a URL-encoded `payload` query parameter.

set -e

URL="${1:?Usage: $0 <DEPLOYMENT_URL>}"
PASS=0
FAIL=0

check() {
  local test_name="$1"
  local expected="$2"
  local response="$3"
  echo "$response" | grep -q "$expected"
  if [ $? -eq 0 ]; then
    echo "   PASS"
    PASS=$((PASS + 1))
  else
    echo "   FAIL"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Hive API Smoke Tests ==="
echo "Endpoint: $URL"
echo ""

# --- Read tests ---

echo "1. getOwners"
RESPONSE=$(curl -sL "$URL?action=getOwners")
echo "   $RESPONSE"
check "getOwners" '"success":true' "$RESPONSE"
echo ""

echo "2. getLabels"
RESPONSE=$(curl -sL "$URL?action=getLabels")
echo "   $RESPONSE"
check "getLabels" '"success":true' "$RESPONSE"
echo ""

echo "3. getItems (empty)"
RESPONSE=$(curl -sL "$URL?action=getItems")
echo "   $RESPONSE"
check "getItems" '"success":true' "$RESPONSE"
echo ""

# --- Write tests via payload param ---

echo "4. createItem"
PAYLOAD='{"data":{"title":"Smoke Test Item","owner":"Luke"},"actor":"smoke-test"}'
RESPONSE=$(curl -sL --get "$URL" --data-urlencode "action=createItem" --data-urlencode "payload=$PAYLOAD")
echo "   $RESPONSE"
check "createItem" '"success":true' "$RESPONSE"

ITEM_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "   Created item ID: $ITEM_ID"
echo ""

if [ -n "$ITEM_ID" ]; then
  echo "5. getItem by ID"
  RESPONSE=$(curl -sL "$URL?action=getItem&id=$ITEM_ID")
  echo "   $RESPONSE"
  check "getItem" '"success":true' "$RESPONSE"
  echo ""

  echo "6. updateItem (move to In Progress)"
  PAYLOAD="{\"id\":\"$ITEM_ID\",\"changes\":{\"status\":\"In Progress\"},\"actor\":\"smoke-test\"}"
  RESPONSE=$(curl -sL --get "$URL" --data-urlencode "action=updateItem" --data-urlencode "payload=$PAYLOAD")
  echo "   $RESPONSE"
  check "updateItem→InProgress" '"success":true' "$RESPONSE"
  echo ""

  echo "7. updateItem (move to Done)"
  PAYLOAD="{\"id\":\"$ITEM_ID\",\"changes\":{\"status\":\"Done\"},\"actor\":\"smoke-test\"}"
  RESPONSE=$(curl -sL --get "$URL" --data-urlencode "action=updateItem" --data-urlencode "payload=$PAYLOAD")
  echo "   $RESPONSE"
  check "updateItem→Done" '"success":true' "$RESPONSE"
  echo ""

  echo "8. deleteItem (cleanup)"
  PAYLOAD="{\"id\":\"$ITEM_ID\",\"actor\":\"smoke-test\"}"
  RESPONSE=$(curl -sL --get "$URL" --data-urlencode "action=deleteItem" --data-urlencode "payload=$PAYLOAD")
  echo "   $RESPONSE"
  check "deleteItem" '"success":true' "$RESPONSE"
  echo ""
fi

# --- Business rule violation tests ---

echo "9. createItem without title (should fail)"
PAYLOAD='{"data":{},"actor":"smoke-test"}'
RESPONSE=$(curl -sL --get "$URL" --data-urlencode "action=createItem" --data-urlencode "payload=$PAYLOAD")
echo "   $RESPONSE"
check "noTitle" '"success":false' "$RESPONSE"
echo ""

echo "10. createItem in In Progress without owner (should fail)"
PAYLOAD='{"data":{"title":"No Owner","status":"In Progress"},"actor":"smoke-test"}'
RESPONSE=$(curl -sL --get "$URL" --data-urlencode "action=createItem" --data-urlencode "payload=$PAYLOAD")
echo "   $RESPONSE"
check "noOwner" '"success":false' "$RESPONSE"
echo ""

echo "=== Results: $PASS passed, $FAIL failed ==="
