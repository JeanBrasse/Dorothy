#!/bin/bash
LOG="/tmp/dorothy-hooks-debug.log"
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi
API_URL="http://127.0.0.1:31415"
AGENT_ID="${CLAUDE_AGENT_ID:-$SESSION_ID}"
echo "========================================" >> "$LOG"
echo "[$(date)] STOP hook — AGENT=$AGENT_ID" >> "$LOG"
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // empty')
echo "  last_assistant_message length: ${#LAST_MSG}" >> "$LOG"
if [ -z "$LAST_MSG" ]; then
  TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
  if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
    # Portable last-assistant-message extraction (macOS has no GNU `tac`):
    # slurp the JSONL and take the last non-empty assistant text block.
    LAST_MSG=$(jq -rs '
      [ .[] | select(.type=="assistant")
            | (.message.content // [])
            | if type=="array" then map(select(type=="object" and .type=="text") | .text) | join("\n") else tostring end
            | select(length>0) ]
      | last // empty' "$TRANSCRIPT_PATH" 2>/dev/null | head -c 4000)
  fi
fi
if [ -n "$LAST_MSG" ]; then
  TRIMMED=$(echo "$LAST_MSG" | head -c 4000)
  curl -s --max-time 3 -X POST "$API_URL/api/hooks/output" -H "Content-Type: application/json" -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"output\": $(echo "$TRIMMED" | jq -Rs .)}" >> "$LOG" 2>&1
  echo "  Output sent (${#TRIMMED} chars)" >> "$LOG"
fi
curl -s --max-time 3 -X POST "$API_URL/api/hooks/status" -H "Content-Type: application/json" -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"status\": \"idle\"}" > /dev/null 2>&1
curl -s --max-time 3 -X POST "$API_URL/api/hooks/agent-stopped" -H "Content-Type: application/json" -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\"}" > /dev/null 2>&1
echo '{"continue":true,"suppressOutput":true}'
