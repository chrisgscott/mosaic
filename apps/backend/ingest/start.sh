#!/bin/bash

# Build and start the Mosaic ingestion worker
echo "Building Docker image..."
docker build -t mosaic-ingest .

echo "Starting worker..."
docker run --name mosaic-ingest-worker --env-file .env mosaic-ingest
