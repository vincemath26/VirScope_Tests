# -----------------------------
# 1. Base image
# -----------------------------
FROM python:3.10-slim

# -----------------------------
# 2. Environment variables
# -----------------------------
ENV PYTHONUNBUFFERED=1 \
    PATH="/usr/local/diamond:$PATH"

# -----------------------------
# 3. Install system dependencies
# -----------------------------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        wget \
        unzip \
        curl \
        git && \
    rm -rf /var/lib/apt/lists/*

# -----------------------------
# 4. Install DIAMOND
# -----------------------------
RUN wget https://github.com/bbuchfink/diamond/releases/download/v3.9.9/diamond-linux64.tar.gz -O /tmp/diamond.tar.gz && \
    mkdir -p /usr/local/diamond && \
    tar -xzf /tmp/diamond.tar.gz -C /usr/local/diamond && \
    rm /tmp/diamond.tar.gz

# -----------------------------
# 5. Set working directory
# -----------------------------
WORKDIR /app

# -----------------------------
# 6. Copy and install Python dependencies
# -----------------------------
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# -----------------------------
# 7. Copy backend code
# -----------------------------
COPY backend/ /app/

# -----------------------------
# 8. Expose port and default command
# -----------------------------
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
