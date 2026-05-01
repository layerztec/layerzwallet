#!/usr/bin/env bash
#
# MCP Streamable HTTP smoke test against your tunnel URL.
# Safe to run repeatedly: each run starts with a headerless `initialize`, which
# must mint a fresh session on the app (see mobile `mcp.ts` bare + init path).
#
# Usage:
#   ./smoke-mcp.sh https://layerz.me:4433/mcp/…    # paste from app / agent config
#   # …or rely on MCP_URL export:
#   MCP_URL=https://layerz.me:4433/mcp/… ./smoke-mcp.sh
#

set -euo pipefail

URL="${MCP_URL:-${1:-}}"
if [[ -z "$URL" ]]; then
  echo "Usage: $0 https://layerz.me:4433/mcp/…" >&2
  echo "       MCP_URL=https://layerz.me:4433/mcp/… $0" >&2
  exit 1
fi

HDR=$(mktemp)
BODY=$(mktemp)
trap 'rm -f "$HDR" "$BODY"' EXIT

echo "→ initialize …"
curl -sk -D "$HDR" -o "$BODY" -X POST "$URL" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  --data-binary @- <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke-mcp.sh","version":"0"}}}
EOF

# Prefer the server's negotiated protocol version from the initialize result.
PROTO=$(sed -nE 's/.*"protocolVersion":"([^"]+)".*/\1/p' "$BODY" | head -1 || true)
if [[ -z "$PROTO" ]]; then
  PROTO="2025-06-18"
fi

# Bun's fetch lower-cases outbound header names → server echoes lowercase.
SID=$(grep -Fi 'mcp-session-id:' "$HDR" | awk '{print $2}' | tr -d '\r')

if [[ -z "$SID" ]]; then
  echo "❌ Failed to capture mcp-session-id from response headers."
  echo "   HTTP trace saved (headers→$HDR body→$BODY)."
  echo "   Raw body:"
  cat "$BODY"
  echo
  exit 1
fi

echo "  Mcp-Session-Id: $SID"
echo "  MCP-Protocol-Version: $PROTO"

echo "→ notifications/initialized …"
curl -sk -X POST "$URL" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H "mcp-session-id: $SID" \
  -H "mcp-protocol-version: $PROTO" \
  --data-binary '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  -w '%{http_code}\n'

echo ""
echo "→ tools/list …"
curl -sk -X POST "$URL" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H "mcp-session-id: $SID" \
  -H "mcp-protocol-version: $PROTO" \
  --data-binary '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
echo ""

echo ""
echo "→ tools/call list_networks …"
curl -sk -X POST "$URL" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H "mcp-session-id: $SID" \
  -H "mcp-protocol-version: $PROTO" \
  --data-binary '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_networks","arguments":{}}}'
echo ""

echo ""
echo "✓ Smoke done"
