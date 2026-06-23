FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Whisper (ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# CPU-only torch wheel: openai-whisper pulls in full CUDA torch by default,
# which is ~2GB heavier and unnecessary on Spaces' free CPU tier.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

# Hugging Face Spaces runs containers as uid 1000; match ownership so the
# app can write uploads/, the SQLite db, and the Whisper model cache.
RUN useradd -m -u 1000 user && chown -R user:user /app
USER user
ENV HOME=/home/user

# Bake the default Whisper model into the image so cold starts after the
# Space wakes from sleep don't also have to download it over the network.
RUN python -c "import whisper; whisper.load_model('base')"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
