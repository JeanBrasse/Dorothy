#!/bin/bash
# TaskCompleted hook for dorothy
# Fires when Claude finishes a task — captures output THEN sets agent to "completed"
# ORDER MATTERS: output must be captured BEFORE task-completed notification,
# because wait_for_agent resolves on status change and reads lastCleanOutput.

# Read JSON input from stdin
INPUT=$(cat)

# Extract info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')

echo "[$(date)] TASK_COMPLETED hook. AGENT_ID=${CLAUDE_AGENT_ID:-unset} SESSION_ID=$SESSION_ID" >> /tmp/dorothy-hooks.log

# API endpoint
API_URL="http://127.0.0.1:31415"

# Get agent ID from environment or use session ID
AGENT_ID="${CLAUDE_AGENT_ID:-$SESSION_ID}"

# Check if API is available
if ! curl -s --connect-timeout 1 "$API_URL/api/health" > /dev/null 2>&1; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# STEP 1: Capture clean output from transcript FIRST (before status change)
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  LAST_ASSISTANT_MSG=$(tail -100 "$TRANSCRIPT_PATH" 2>/dev/null | \
    grep '"type":"assistant"' | \
    tail -1 | \
    jq -r '.message.content[] | select(.type=="text") | .text // empty' 2>/dev/null | \
    head -c 4000)

  if [ -n "$LAST_ASSISTANT_MSG" ]; then
    curl -s --max-time 3 -X POST "$API_URL/api/hooks/output" \
      -H "Content-Type: application/json" \
      -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"output\": $(echo "$LAST_ASSISTANT_MSG" | jq -Rs .)}" \
      > /dev/null 2>&1
  fi
fi

# STEP 2: NOW notify Dorothy that task is completed (triggers wait_for_agent)
curl -s --max-time 3 -X POST "$API_URL/api/hooks/task-completed" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\"}" \
  > /dev/null 2>&1

echo '{"continue":true,"suppressOutput":true}'
exit 0
