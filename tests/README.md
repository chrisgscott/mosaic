# Test Scripts

This directory contains manual test scripts for various Mosaic features.

## Available Tests

### Graph Extraction
- **test-graph-extract.sh** - Test graph entity and relationship extraction from documents

### Search Tests
- **test-search.sh** - Test semantic search functionality
- **test-search-direct.sh** - Direct search API testing

### Model Tests
- **test_gpt5_nano.py** - Test GPT-5 nano model integration

## Running Tests

Each script can be run directly from this directory:

```bash
cd tests
./test-graph-extract.sh
./test-search.sh
./test-search-direct.sh
python test_gpt5_nano.py
```

## Note

These are manual integration tests. For automated unit tests, see:
- `apps/backend/ingest/tests/` - Python backend tests
- `apps/web/` - Frontend tests (if implemented)
