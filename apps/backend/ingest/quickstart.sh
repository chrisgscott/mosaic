#!/bin/bash

# Quick start script for testing the document processor
# No database or Supabase setup required!

echo "🚀 Document Processor Quick Start"
echo "=================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo ""
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
pip install -q -r requirements.txt
echo "✅ Dependencies installed"

# Run test
echo ""
echo "🧪 Running test with sample.txt..."
echo "=================================="
echo ""
python test_processor.py sample.txt

echo ""
echo "=================================="
echo "✅ Test complete!"
echo ""
echo "Next steps:"
echo "  1. Try with your own files: python test_processor.py /path/to/file.pdf"
echo "  2. See SETUP.md for deployment instructions"
echo "  3. See TESTING.md for more testing options"
