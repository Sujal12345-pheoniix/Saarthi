# Saarthi CV service
#   docker build -t saarthi-ai-service .                 # runtime image
#   docker build --target test -t saarthi-ai-test .      # runs the test suite during the build
FROM python:3.10-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

# ── Test stage: same runtime, plus test dependencies ──
FROM base AS test
COPY requirements-dev.txt .
RUN pip install -r requirements-dev.txt
COPY app ./app
COPY tests ./tests
RUN python -m pytest -q tests

# ── Runtime stage ──
FROM base AS runtime
COPY app ./app
RUN useradd --create-home --uid 10001 saarthi
USER saarthi
EXPOSE 8000
# Render and most platforms inject PORT.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
