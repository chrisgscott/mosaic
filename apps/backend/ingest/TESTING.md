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

## Next Steps

Once testing works:
1. ✅ Apply database migration
2. ✅ Set up `.env` file
3. ✅ Test full worker with `python main.py`
4. ✅ Deploy to Render.com

See `SETUP.md` for deployment instructions.
