# Crawl4AI service. `crawl4ai-setup` installs Playwright + headless Chromium and
# its system libraries, so no extra apt wrangling is needed.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && crawl4ai-setup

COPY main.py .

# Cloud Run sends traffic to $PORT; single worker is plenty for scale-to-zero use.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
