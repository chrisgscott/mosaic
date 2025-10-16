# Use Python 3.11 slim image as base
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies required for document processing
RUN apt-get update && apt-get install -y \
    # OCR support (for Unstructured processor)
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    # PDF processing (for Unstructured processor)
    poppler-utils \
    # File type detection (both processors)
    libmagic1 \
    # Docling dependencies
    libgomp1 \
    # HTML/XML parsing
    libxml2 \
    libxslt1-dev \
    # PostgreSQL client
    libpq-dev \
    # Document conversion
    pandoc \
    # OpenCV dependencies (for image processing)
    libgl1 \
    libglib2.0-0 \
    # Cleanup to reduce image size
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run the worker (unbuffered for real-time logs)
CMD ["python", "-u", "main.py"]
