#!/usr/bin/env bash
# Pre-tool hook: block dangerous Bash commands
# Reads tool input JSON from stdin. Exit 0 = allow, exit 2 = block.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('input',{}).get('command',''))" 2>/dev/null || echo "")

# Block force push to main/master
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*--force.*\b(main|master)\b|git\s+push\s+-f.*\b(main|master)\b'; then
  echo "BLOCKED: Force push to main/master is not allowed." >&2
  exit 2
fi

# Block DROP TABLE / DROP DATABASE without safeguards
if echo "$COMMAND" | grep -qiE 'DROP\s+(TABLE|DATABASE)'; then
  echo "BLOCKED: DROP TABLE/DATABASE detected. Use migrations instead." >&2
  exit 2
fi

# Block broad destructive rm -rf
if echo "$COMMAND" | grep -qE 'rm\s+-rf\s+(/|~|\.|\.\.|\*|/Users)$'; then
  echo "BLOCKED: Destructive rm -rf on broad path." >&2
  exit 2
fi

# Block git reset --hard on main/master
if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard' && git branch --show-current 2>/dev/null | grep -qE '^(main|master)$'; then
  echo "BLOCKED: git reset --hard on main/master branch." >&2
  exit 2
fi

exit 0
