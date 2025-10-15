#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install system dependencies
apt-get update
apt-get install -y \
  tesseract-ocr \
  tesseract-ocr-eng \
  libtesseract-dev \
  poppler-utils \
  libmagic1 \
  libxml2 \
  libxslt1-dev \
  libpq-dev \
  pandoc

# Install Python dependencies
pip install -r requirements.txt
