FROM python:3.11-slim

WORKDIR /app

# Install build dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

EXPOSE 8000

ENV PORT=8000
CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port ${PORT} --app-dir backend"]
