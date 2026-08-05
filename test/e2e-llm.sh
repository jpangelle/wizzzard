#!/usr/bin/env bash
# Manual live test of the AI phases. Run from a real terminal; costs tokens.
set -euo pipefail
cd "$(dirname "$0")/.."

cat <<'EOF'
── wizzzard live LLM test ─────────────────────────────
1. Suggested app name:  Time Peek
2. Suggested description: menu bar app that shows the current unix timestamp,
   click to copy it
3. Answer the brainstorm questions, approve the design,
   accept both gates (plan + implement).
4. PASS criteria: docs/DESIGN.md and docs/PLAN.md written in the
   generated app's docs/, `make build` green, app runs. No git repo created.
───────────────────────────────────────────────────────
EOF

scratch=$(mktemp -d)
echo "Scratch dir: $scratch"
cd "$scratch"
exec node "$OLDPWD/src/index.ts"
