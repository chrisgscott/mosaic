#!/usr/bin/env python3
"""
Test script for Structured Outputs with Planner-Executor chunker.
Tests the implementation without processing a full document.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from openai import OpenAI
from chunkers.planner_executor_chunker import (
    ChunkPlan,
    ChunkSpec,
    ChunkSource,
    TOCEntry,
    GlossaryEntry
)

def test_structured_outputs():
    """Test that Structured Outputs work with a simple example."""
    
    client = OpenAI()
    
    # Simple test document
    test_content = """
    # Introduction to Python
    
    Python is a high-level programming language. It was created by Guido van Rossum.
    
    ## Features
    
    Python has many features:
    - Easy to learn
    - Readable syntax
    - Large standard library
    
    ## Use Cases
    
    Python is used for:
    - Web development
    - Data science
    - Machine learning
    """
    
    print("Testing Structured Outputs with Planner-Executor chunker...")
    print(f"Test document: {len(test_content)} characters\n")
    
    try:
        # Test the parse() method with Structured Outputs
        print("Calling client.beta.chat.completions.parse()...")
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",  # Use cheaper model for testing
            messages=[
                {
                    "role": "system",
                    "content": "You are a document chunking planner. Create a simple chunk plan."
                },
                {
                    "role": "user",
                    "content": f"""Create a chunk plan for this document. Make 2-3 chunks.

Document:
{test_content}

Return a ChunkPlan with:
- document_id: "test-doc-123"
- global_notes: Brief analysis
- chunks: Array of 2-3 chunks with byte offsets"""
                }
            ],
            response_format=ChunkPlan,
            temperature=0.1
        )
        
        print("✅ API call successful!\n")
        
        # Get parsed object
        if completion.choices[0].message.parsed:
            plan = completion.choices[0].message.parsed
            print("✅ Parsed ChunkPlan successfully!\n")
            
            print(f"Document ID: {plan.document_id}")
            print(f"Global Notes: {plan.global_notes}\n")
            print(f"Number of chunks: {len(plan.chunks)}\n")
            
            for i, chunk in enumerate(plan.chunks, 1):
                print(f"Chunk {i}:")
                print(f"  ID: {chunk.id}")
                print(f"  Type: {chunk.chunk_type}")
                print(f"  Role: {chunk.role}")
                print(f"  Title: {chunk.title}")
                print(f"  Byte range: {chunk.source.start_byte}-{chunk.source.end_byte}")
                print(f"  Verification snippet: {chunk.verification_snippet[:50]}...")
                print(f"  Salience terms: {', '.join(chunk.salience_terms[:3])}")
                print()
            
            # Validate byte offsets
            content_bytes = test_content.encode('utf-8')
            print(f"Document length: {len(content_bytes)} bytes")
            
            all_valid = True
            for chunk in plan.chunks:
                start = chunk.source.start_byte
                end = chunk.source.end_byte
                
                if start < 0 or end > len(content_bytes) or start >= end:
                    print(f"❌ Invalid byte range for {chunk.id}: {start}-{end}")
                    all_valid = False
                else:
                    # Extract actual content
                    chunk_bytes = content_bytes[start:end]
                    chunk_text = chunk_bytes.decode('utf-8', errors='replace')
                    print(f"✅ {chunk.id}: Valid byte range, {len(chunk_text)} chars")
            
            if all_valid:
                print("\n✅ All byte offsets are valid!")
            else:
                print("\n⚠️  Some byte offsets are invalid")
            
            print("\n✅ TEST PASSED: Structured Outputs working correctly!")
            return True
            
        else:
            print("❌ No parsed plan received")
            return False
            
    except Exception as e:
        print(f"❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_structured_outputs()
    sys.exit(0 if success else 1)
