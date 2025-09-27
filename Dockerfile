FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libgl1 \
    ffmpeg \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p static/uploads

# Set environment variables for headless operation
ENV DISPLAY=:99
ENV QT_QPA_PLATFORM=offscreen
ENV OPENCV_IO_ENABLE_OPENEXR=1

EXPOSE 10000

CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:app"]