FROM python:3.10-slim
ARG TORCH_BACKEND=cu124

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    ca-certificates

ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh
ENV PATH="/root/.local/bin/:$PATH"

COPY pyproject.toml ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system --torch-backend=${TORCH_BACKEND} torch torchaudio torchvision torchcodec && \
    uv pip install --system -r pyproject.toml

CMD ["python", "src/server.py"]
