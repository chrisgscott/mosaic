#!/bin/bash

# Stop the Mosaic ingestion worker
echo "Stopping worker..."
docker stop mosaic-ingest-worker 2>/dev/null || echo "Worker not running"

echo "Removing container..."
docker rm mosaic-ingest-worker 2>/dev/null || echo "Container already removed"

echo "Worker stopped"
