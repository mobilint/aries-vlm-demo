# Aries VLM Demo

## Getting started

### Install Docker

Follow the [official instruction](https://docs.docker.com/engine/install/ubuntu/)
Also, set your user as `docker` group by following the [Linux post-installation steps](https://docs.docker.com/engine/install/linux-postinstall/)

### Create Docker Network & Build Image

```shell
docker network create mblt_int
docker compose build
```

### Run

```shell
docker compose up
```

If you want to run it with GPU, you must install `nvidia-container-toolkit` by following [this guide](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html). Then, you can run it by following instruction.

```shell
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up
```

### Change images

You can change images in real time without any docker rebuild by editing `frontend/images.tsx` and adding new images in `frontend/public/images`. However, if the size of image is too large, inference will be broken (recommended width is 640).

### Run on background

```shell
docker compose up -d
```

### Shutdown background

```shell
docker compose down
```

## Setup Shortcut

Path to this repository should be `/home/mobilint/aries-vlm-demo`.

If needed, you can change the path in `vlm-demo.desktop` and `run.sh` file before copying.

```shell
sudo cp vlm-demo.desktop /usr/share/applications
```

Then, you can add `VLM` icon in apps to the favorites (left sidebar).