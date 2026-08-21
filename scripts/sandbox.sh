#!/bin/bash
# Lance la NOUVELLE Dorothy en bac à sable, à côté de l'app de prod.
#
# Isolation :
#   - HOME pointé sur ~/Dorothy-sandbox  → ~/.dorothy (agents, settings, token),
#     ~/.claude (mémoire, MCP, hooks) et ~/Library/Application Support/Dorothy
#     (localStorage, fenêtres) sont des copies de test, jamais les vrais.
#   - API sur le port 31499              → aucun conflit avec la prod (31415).
#
# La prod qui tourne n'est ni vue, ni touchée. Le bac à sable est PERSISTANT
# entre les lancements (settings/agents de test conservés) :
#   rm -rf ~/Dorothy-sandbox   pour repartir de zéro.
#
# Note agents réels : l'auth du claude CLI vit dans le trousseau macOS (pas
# dans HOME), donc les agents spawnés depuis le bac à sable sont généralement
# déjà authentifiés. Si un agent demande un login, c'est que tes credentials
# sont en fichier : claude /login une fois depuis le bac à sable suffit.

set -e

SANDBOX="$HOME/Dorothy-sandbox"
APP="${1:-$(dirname "$0")/../release/mac-arm64/Dorothy.app}"
BIN="$APP/Contents/MacOS/Dorothy"

if [ ! -x "$BIN" ]; then
  echo "App introuvable: $APP"
  echo "Construis-la d'abord (next build + npm run electron:pack) ou passe le chemin: scripts/sandbox.sh /chemin/Dorothy.app"
  exit 1
fi

mkdir -p "$SANDBOX"
echo "Sandbox HOME : $SANDBOX"
echo "API port     : 31499 (prod intacte sur 31415)"
echo "App          : $APP"

LOG="$SANDBOX/dorothy.log"
HOME="$SANDBOX" DOROTHY_API_PORT=31499 nohup "$BIN" "$@" > "$LOG" 2>&1 &
disown
echo "PID $! — les deux Dorothy tournent en parallèle. Logs: $LOG"
