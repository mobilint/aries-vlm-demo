#!/bin/bash
set -euo pipefail

if [ "${SUDO_USER-}" ] && [ "$SUDO_USER" != "root" ]; then
  USER_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
else
  USER_HOME="$HOME"
fi

APP_DIR="$USER_HOME/aries-vlm-demo"

cd "$APP_DIR"

docker compose up --remove-orphans

wait