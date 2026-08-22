#!/bin/bash
# Design guardrail: fails when banned styling creeps back in.
# The shared primitives in src/components/ui/ are the only place allowed to
# define raw appearance.
set -u
fail=0

check() {
  local label="$1"; shift
  local hits
  hits=$(grep -rnE "$1" src/ --include="*.tsx" 2>/dev/null | grep -v "src/components/ui/" | grep -v "app/icon.tsx" || true)
  if [ -n "$hits" ]; then
    echo "✗ $label"
    echo "$hits" | head -8 | sed 's/^/    /'
    local n; n=$(echo "$hits" | wc -l | tr -d ' ')
    [ "$n" -gt 8 ] && echo "    … $((n - 8)) more"
    fail=1
  else
    echo "✓ $label"
  fi
}

check "no inline border-radius"        "style=\{\{ *borderRadius"
check "no drop shadows"                "shadow-(sm|md|lg|xl|2xl)"
check "no gradients"                   "bg-gradient"
check "no decorative ping"             "animate-ping"
check "no raw tailwind palette"        "(text|bg|border)-(red|green|blue|amber|purple|cyan|yellow|orange|zinc|slate|gray)-[0-9]"

exit $fail
