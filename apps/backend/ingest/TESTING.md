# Testing the Document Processor

## Quick Start (No Setup Required!)

Test the processor immediately with the included sample file:

```bash
cd apps/backend/ingest

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run test with sample file
python test_processor.py sample.txt
```

You'll see:
1. ✅ Text extraction results
2. ✅ Chunking statistics
3. ✅ Sample chunks with token counts
4. ✅ Option to test metadata extraction

**No database, no queue, no Supabase needed!**

## Test with Your Own Files

```bash
# Test with a PDF
python test_processor.py ~/Downloads/report.pdf

# Test with a DOCX
python test_processor.py ~/Documents/paper.docx

# Test with any supported file
python test_processor.py /path/to/your/file.ext
```

## What Gets Tested

### 1. Text Extraction
- ✅ File reading and parsing
- ✅ Text extraction quality
- ✅ Character count
- ✅ Preview of extracted content

### 2. Text Chunking
- ✅ Chunk creation
- ✅ Token counting
- ✅ Chunk size distribution
- ✅ Preview of chunks

### 3. Metadata Extraction (Optional)
- ✅ Document structure preservation
- ✅ Element type detection
- ✅ Page numbers (for PDFs)
- ✅ Section headers

## Supported File Types

The test script works with:
- ✅ PDF (`.pdf`)
- ✅ Word (`.docx`, `.doc`)
- ✅ Text (`.txt`, `.md`)
- ✅ HTML (`.html`)
- ✅ CSV (`.csv`)
- ✅ Excel (`.xlsx`)
- ✅ PowerPoint (`.pptx`)

## Example Output

```
🧪 Document Processing Test Suite

============================================================
Testing extraction: sample.txt
============================================================

📄 File size: 3,456 bytes
🔍 Extracting text with Unstructured...
✅ Extracted 3,234 characters

--- First 500 characters ---
Sample Document for Testing

Introduction

This is a sample document to test the document processing...

============================================================
Testing chunking
============================================================

📝 Input text: 3,234 characters
✂️  Chunking text...
✅ Created 8 chunks

📊 Statistics:
   Total tokens: 812
   Average tokens per chunk: 101.5
   Min tokens: 87
   Max tokens: 156

--- First 3 Chunks ---

📦 Chunk 0 (156 tokens):
Sample Document for Testing

Introduction

This is a sample document...

✅ All tests complete!
```

## Troubleshooting

### "ModuleNotFoundError: No module named 'unstructured'"
```bash
# Make sure you activated the virtual environment
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### "No text extracted"
- Check file type is supported
- Try with `sample.txt` first
- Check file isn't corrupted

### "ImportError" or other errors
```bash
# Clean install
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Settings Integration Tests

### Automated Testing

We have comprehensive automated tests for the settings system:

```bash
# Run all tests
./run_tests.sh

# Run only unit tests (fast)
./run_tests.sh --unit

# Run only integration tests
./run_tests.sh --integration

# Generate coverage report
./run_tests.sh --coverage
```

### What Gets Tested

#### Unit Tests (`test_settings_service.py`)
- ✅ Settings cache initialization
- ✅ Type conversion (int, bool, float, string)
- ✅ Default value fallbacks
- ✅ Environment variable fallbacks
- ✅ Cache TTL and refresh behavior
- ✅ Error handling (database failures)
- ✅ Cache invalidation

#### Integration Tests (`test_settings_integration.py`)
- ✅ DoclingProcessor reads VLM model from settings
- ✅ HybridChunker reads summary model from settings
- ✅ GraphExtractor reads graph model from settings
- ✅ EmbeddingsGenerator reads embedding model from settings
- ✅ Settings changes detected after cache refresh
- ✅ Fallback to defaults when settings service not provided

### Manual End-to-End Test

To verify settings work end-to-end:

1. **Start the backend:**
   ```bash
   ./start.sh
   ```

2. **Check initial settings in logs:**
   ```
   INFO - Using Docling processor with HybridChunker (API VLM: True, max_workers: 10, ...)
   INFO - Configured Docling with API VLM (gpt-4o-mini)
   ```

3. **Change a setting in the UI:**
   - Go to Settings → General
   - Change "VLM Model" from `gpt-4o-mini` to `gpt-4o`
   - Click "Save Settings"

4. **Wait 60 seconds** (cache TTL)

5. **Upload a document** and watch logs:
   ```
   INFO - Configured Docling with API VLM (gpt-4o)  # ← Should show new model
   ```

6. **Verify the change took effect!**

### Test Coverage

Current test coverage includes:
- **SettingsService**: 100% coverage
- **Processor Integration**: All major code paths
- **Cache Behavior**: TTL, refresh, invalidation
- **Type Safety**: All getter methods
- **Error Handling**: Database failures, invalid types

### Running Tests in CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Backend Tests
  run: |
    cd apps/backend/ingest
    pip install -r requirements.txt
    pip install -r requirements-test.txt
    ./run_tests.sh --coverage
```

## Next Steps

Once testing works:
1. ✅ Apply database migration
2. ✅ Set up `.env` file
3. ✅ Test full worker with `python main.py`
4. ✅ Run automated tests with `./run_tests.sh`
5. ✅ Deploy to Render.com

See `SETUP.md` for deployment instructions.
