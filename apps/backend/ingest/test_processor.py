"""
Test script for document processing without the full queue setup.

This allows you to test text extraction and chunking independently.
"""

import os
import sys
from processors.unstructured_processor import UnstructuredProcessor
from processors.chunker import TextChunker


def test_extraction(file_path: str):
    """Test text extraction from a file."""
    print(f"\n{'='*60}")
    print(f"Testing extraction: {file_path}")
    print(f"{'='*60}\n")
    
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return None
    
    processor = UnstructuredProcessor()
    
    # Read file
    with open(file_path, "rb") as f:
        file_data = f.read()
    
    print(f"📄 File size: {len(file_data):,} bytes")
    
    # Extract text
    print("🔍 Extracting text with Unstructured...")
    text = processor.extract_text(file_data, file_path)
    
    if text:
        print(f"✅ Extracted {len(text):,} characters")
        print(f"\n--- First 500 characters ---")
        print(text[:500])
        print(f"\n--- Last 500 characters ---")
        print(text[-500:])
        return text
    else:
        print("❌ No text extracted")
        return None


def test_chunking(text: str, document_id: str = "test-doc-123"):
    """Test text chunking."""
    print(f"\n{'='*60}")
    print(f"Testing chunking")
    print(f"{'='*60}\n")
    
    chunker = TextChunker(chunk_size=512, chunk_overlap=50)
    
    print(f"📝 Input text: {len(text):,} characters")
    print("✂️  Chunking text...")
    
    chunks = chunker.chunk_text(text, document_id)
    
    print(f"✅ Created {len(chunks)} chunks\n")
    
    # Show stats
    total_tokens = sum(c['token_count'] for c in chunks)
    avg_tokens = total_tokens / len(chunks) if chunks else 0
    
    print(f"📊 Statistics:")
    print(f"   Total tokens: {total_tokens:,}")
    print(f"   Average tokens per chunk: {avg_tokens:.1f}")
    print(f"   Min tokens: {min(c['token_count'] for c in chunks)}")
    print(f"   Max tokens: {max(c['token_count'] for c in chunks)}")
    
    # Show first 3 chunks
    print(f"\n--- First 3 Chunks ---")
    for i, chunk in enumerate(chunks[:3]):
        print(f"\n📦 Chunk {i} ({chunk['token_count']} tokens):")
        print(chunk['content'][:300])
        if len(chunk['content']) > 300:
            print("...")
    
    return chunks


def test_with_metadata(file_path: str):
    """Test extraction with metadata preservation."""
    print(f"\n{'='*60}")
    print(f"Testing extraction with metadata: {file_path}")
    print(f"{'='*60}\n")
    
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return
    
    processor = UnstructuredProcessor()
    
    with open(file_path, "rb") as f:
        file_data = f.read()
    
    print("🔍 Extracting with metadata...")
    result = processor.extract_with_metadata(file_data, file_path)
    
    if result:
        print(f"✅ Extracted {len(result['text']):,} characters")
        print(f"📄 Found {len(result['elements'])} elements")
        
        # Show element types
        element_types = {}
        for elem in result['elements']:
            elem_type = elem['type']
            element_types[elem_type] = element_types.get(elem_type, 0) + 1
        
        print(f"\n📊 Element types:")
        for elem_type, count in sorted(element_types.items()):
            print(f"   {elem_type}: {count}")
        
        # Show first few elements
        print(f"\n--- First 3 Elements ---")
        for i, elem in enumerate(result['elements'][:3]):
            print(f"\n{i}. Type: {elem['type']}")
            if elem['metadata']:
                print(f"   Metadata: {elem['metadata']}")
            print(f"   Text: {elem['text'][:200]}")
            if len(elem['text']) > 200:
                print("   ...")
    else:
        print("❌ No content extracted")


def main():
    """Main test function."""
    print("\n🧪 Document Processing Test Suite")
    
    # Check if file path provided
    if len(sys.argv) < 2:
        print("\n❌ Usage: python test_processor.py <file_path>")
        print("\nExample:")
        print("  python test_processor.py ~/Downloads/sample.pdf")
        print("  python test_processor.py ~/Documents/report.docx")
        print("  python test_processor.py test.txt")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    # Test 1: Basic extraction
    text = test_extraction(file_path)
    
    if not text:
        print("\n❌ Extraction failed, cannot test chunking")
        sys.exit(1)
    
    # Test 2: Chunking
    chunks = test_chunking(text)
    
    # Test 3: Extraction with metadata (optional)
    if input("\n\n🔍 Test extraction with metadata? (y/n): ").lower() == 'y':
        test_with_metadata(file_path)
    
    print(f"\n{'='*60}")
    print("✅ All tests complete!")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
