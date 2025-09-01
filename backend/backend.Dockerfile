FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    ca-certificates

ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh
ENV PATH="/root/.local/bin/:$PATH"

COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY src/ImageTextToTextPipeline.py ./
COPY src/server.py ./

CMD ["flask", "--app", "server.py", "run", "--host=0.0.0.0"]