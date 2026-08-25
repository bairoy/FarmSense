# Python 3.11 slim - smaller base image
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .

# Use CPU-only torch to avoid 6GB CUDA wheel
RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY *.py ./
COPY regions ./regions

# Create non-root user
RUN useradd -m -u 1001 farmsense
USER farmsense

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
