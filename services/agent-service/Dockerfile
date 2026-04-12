FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching — only re-runs if requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent-service package + eval
COPY app ./app
COPY eval ./eval

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
