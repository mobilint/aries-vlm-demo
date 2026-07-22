#!/bin/bash
set -euo pipefail

DEMO_NAME="ARIES VLM Demo"
DEMO_DIR_NAME="aries-vlm-demo"

if [ "${SUDO_USER-}" ] && [ "$SUDO_USER" != "root" ]; then
  USER_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
else
  USER_HOME="$HOME"
fi

if [ "$EUID" -eq 0 ] && [ "${SUDO_USER-}" ] && [ "$SUDO_USER" != "root" ]; then
  RUN_AS_USER="$SUDO_USER"
else
  RUN_AS_USER="$USER"
fi

run_as_user() {
  if [ "$EUID" -eq 0 ] && [ "${SUDO_USER-}" ] && [ "$RUN_AS_USER" != "root" ]; then
    sudo -H -u "$RUN_AS_USER" "$@"
  else
    "$@"
  fi
}

APP_DIR="$USER_HOME/$DEMO_DIR_NAME"

cd "$APP_DIR"

# Green banner text
printf '\033[1;32m=========== %s ============\033[0m\n' "$DEMO_NAME"

sudo rm -rf frontend/.next  # clean up old build files
sudo rm -rf frontend/node_modules  # clean up old dependencies
sudo rm -rf frontend/next-env.d.ts  # clean up old env file
sudo rm -rf backend/src/*.jpg # clean up old temp images
sudo rm -rf ~/.mblt_model_zoo # clean up old cache folder

sudo apt install -y linux-headers-$(uname -r) build-essential

# Add Mobilint's official GPG key:
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://dl.mobilint.com/apt/gpg.pub -o /etc/apt/keyrings/mblt.asc
sudo chmod a+r /etc/apt/keyrings/mblt.asc

# Add the repository to apt sources:
printf "%s\n" \
    "deb [signed-by=/etc/apt/keyrings/mblt.asc] https://dl.mobilint.com/apt \
    stable multiverse" | \
    sudo tee /etc/apt/sources.list.d/mobilint.list > /dev/null

# Update available packages
sudo apt update

# Install driver & utilities
sudo apt install -y mobilint-aries-driver mobilint-cli

run_as_user git pull

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv..."
  run_as_user bash -c "curl -LsSf https://astral.sh/uv/install.sh | sh"
fi

if [ -d "$USER_HOME/.local/bin" ]; then
  export PATH="$USER_HOME/.local/bin:$PATH"
fi

# Pre-download every model selectable in the UI so switching works offline
# (the backend runs with HF_HUB_OFFLINE=1). Keep in sync with the available
# model list in backend/src/ImageTextToTextPipeline.py.
MODELS=(
  "Qwen3-VL-2B-Instruct"
  "Qwen2-VL-2B-Instruct"
  "Qwen3-VL-4B-Instruct"
  "Qwen3-VL-8B-Instruct"
)

echo "Preparing backend venv and downloading model..."

CACHE_DIR="$USER_HOME/.cache/"
mkdir -p "$CACHE_DIR"
sudo chown -R "$RUN_AS_USER:$RUN_AS_USER" "$CACHE_DIR"

pushd backend >/dev/null
  if [ ! -d ".venv" ]; then
    run_as_user uv venv
  fi
  run_as_user uv pip install -r pyproject.toml
  for model in "${MODELS[@]}"; do
    run_as_user uv run python -c "from huggingface_hub import snapshot_download; snapshot_download('mobilint/${model}')"
  done
popd >/dev/null

if ! command -v docker >/dev/null 2>&1; then
  echo "Cannot find docker. Installing..."

  # Add Docker's official GPG key:
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc

  # Add the repository to Apt sources:
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update

  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  echo "Docker installed successfully."
fi

echo "Starting Docker build..."
if sudo docker compose build; then
  echo "Docker build completed successfully."
else
  echo "Docker build failed."
  exit 1
fi

docker builder prune -f || true

NETWORK_NAME="mblt_int"

if sudo docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
  echo "Docker network '$NETWORK_NAME' already exists."
else
  echo "Docker network '$NETWORK_NAME' not found. Creating..."
  sudo docker network create "$NETWORK_NAME"
  echo "Docker network '$NETWORK_NAME' created."
fi

if ! docker ps >/dev/null 2>&1; then
  echo "Cannot run docker command without sudo. Adding user \`$USER\` to docker group..."

  if sudo usermod -aG docker "$USER"; then
    echo "Docker group updated successfully."
    printf '\033[1;31m!!!!! [WARNING] YOU SHOULD REBOOT MACHINE TO USE DEMO APPROPRIATELY !!!!!\033[0m\n' "$DEMO_NAME"
    echo "Please log out and log back in (or reboot) so the new docker group membership takes effect."
  else
    echo "Failed to update docker group membership for $USER."
    exit 1
  fi
fi

echo "Updating desktop shortcut..."
# delete old desktop file
if [ -f /usr/share/applications/vlm-demo.desktop ]; then
  sudo rm /usr/share/applications/vlm-demo.desktop
fi
sudo mkdir -p "$USER_HOME/.local/share/applications/" || { echo "Failed to create desktop directory at $USER_HOME/.local/share/applications/."; exit 1; }
sudo cp *.desktop "$USER_HOME/.local/share/applications/"
if [ $? -eq 0 ]; then
    echo "Updating desktop shortcut completed successfully."
else
    echo "Updating desktop shortcut failed."
    exit 1
fi

echo "Updating desktop icon..."
sudo mkdir -p "$USER_HOME/.icons/" || { echo "Failed to create icon directory at $USER_HOME/.icons/."; exit 1; }
sudo cp *.png "$USER_HOME/.icons/"
if [ $? -eq 0 ]; then
    echo "Updating desktop icon completed successfully."
else
    echo "Updating desktop icon failed."
    exit 1
fi

exit 0
