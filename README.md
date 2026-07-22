# ARIES VLM Demo

Offline vision-language chat demo for ARIES / Mobilint hardware.

The current implementation uses:

- `Flask-SocketIO` backend for image-aware generation
- `Next.js` frontend for image upload and chat UI
- frontend-owned locale resources, example questions, and prompt bundles
- backend-owned generation defaults in `backend/src/generation_config.json`

## Repository Structure

- [backend/src/server.py](./backend/src/server.py): websocket server, session orchestration, and prompt sync flow
- [backend/src/ImageTextToTextPipeline.py](./backend/src/ImageTextToTextPipeline.py): model loading, image preprocessing, and token streaming
- [backend/src/generation_config.json](./backend/src/generation_config.json): default generation parameters
- [backend/src/prompt.txt](./backend/src/prompt.txt): base prompt template used by the backend pipeline
- [frontend/app/i18n](./frontend/app/i18n): UI text resources by locale
- [frontend/app/questions/locales](./frontend/app/questions/locales): example question resources by locale
- [frontend/public/prompt-bundles](./frontend/public/prompt-bundles): locale-specific `system.txt` / `inter.txt`
- [frontend/public/images](./frontend/public/images): demo images referenced by frontend settings

## Supported Locales

Frontend locale resources are prepared for:

- `en`
- `ko`
- `ja`
- `zh`

The frontend loads the selected locale's prompt bundle and sends it to the backend through the `prompt_config` socket event.

When the language changes:

1. frontend reloads the selected locale resources and prompt bundle
2. backend aborts any in-flight generation for the session
3. backend applies the new `system_prompt` and `inter_prompt`
4. frontend resumes chat only after `prompt_config_saved`

## Installation & Usage (Windows)

Windows does not support the Docker PCIe/NPU binding flow used on Linux, so run the backend and frontend directly.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Backend

```powershell
cd backend
uv sync
uv run src/server.py
```

Open `http://localhost:3000`.

## Installation & Usage (Linux)

The helper script installs dependencies, prepares the Docker network, updates the repository, and downloads required assets.

```bash
./update.sh
```

## Manual Linux Setup

### Install Docker

Follow the official Docker Engine instructions:

- <https://docs.docker.com/engine/install/ubuntu/>
- <https://docs.docker.com/engine/install/linux-postinstall/>

### Create Docker Network

```bash
docker network create mblt_int
```

### Build

```bash
docker compose build
```

### Run (NPU mode)

```bash
docker compose up
```

### Run (GPU mode)

Install NVIDIA Container Toolkit first:

- <https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html>

Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up
```

`docker-compose.gpu.yml` sets `gpus: all`.

### Run in Background

```bash
docker compose up -d
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

### Stop

```bash
docker compose down
```

## Runtime Notes

### Hardware requirement

This demo is designed for hardware-accelerated inference only.
CPU-only execution is not supported.

### Prompt ownership

Prompt text is not stored on the backend as the active source of truth.

- frontend loads prompt bundle files from [frontend/public/prompt-bundles](./frontend/public/prompt-bundles)
- frontend sends `system_prompt` / `inter_prompt` to the backend session
- backend applies those prompts before handling `ask`

The backend rejects `ask` requests until the session prompt bundle has been synchronized.

### GPU torch backend

[backend/backend-gpu.Dockerfile](./backend/backend-gpu.Dockerfile) installs PyTorch with `uv --torch-backend`.

- default is `cu124` (`ARG TORCH_BACKEND=cu124`)
- you can override it at build time if needed:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml build --build-arg TORCH_BACKEND=cu121
```

- `auto` is not recommended for Docker GPU image builds because build-time environment detection may select CPU wheels

### Runtime mode note

- `docker compose up`: NPU mode
  uses [backend/backend.Dockerfile](./backend/backend.Dockerfile) and the NPU-backed runtime path.
- `docker compose -f docker-compose.yml -f docker-compose.gpu.yml up`: GPU mode
  uses [backend/backend-gpu.Dockerfile](./backend/backend-gpu.Dockerfile) and requests `gpus: all`.

## Configuration

### Change prompt text

Edit the locale files under [frontend/public/prompt-bundles](./frontend/public/prompt-bundles):

- `system.txt`
- `inter.txt`

The frontend reloads and sends the selected locale's prompt bundle to the backend session.

### Change generation config

Edit [backend/src/generation_config.json](./backend/src/generation_config.json).

### Change UI text

Edit the locale JSON files under [frontend/app/i18n](./frontend/app/i18n).

### Change example questions

Edit the locale JSON files under [frontend/app/questions/locales](./frontend/app/questions/locales) and [frontend/app/questions/catalog.ts](./frontend/app/questions/catalog.ts).

### Change demo images

Edit [frontend/app/settings.ts](./frontend/app/settings.ts) and add new image assets under [frontend/public/images](./frontend/public/images).

Large images can break inference; a width around `640` is recommended.

## Development Checks

Frontend production build:

```powershell
cd frontend
npm run build
```

Backend syntax check:

```powershell
python -m py_compile backend/src/server.py backend/src/ImageTextToTextPipeline.py
```

## Desktop Shortcut

If you use the provided desktop shortcut, this repository is expected at `~/aries-vlm-demo`.

If needed, update the path in:

- [vlm-demo.desktop](./vlm-demo.desktop)
- [run.sh](./run.sh)

Then install the desktop entry:

```bash
mkdir -p "$HOME/.local/share/applications"
cp vlm-demo.desktop "$HOME/.local/share/applications/"
```
