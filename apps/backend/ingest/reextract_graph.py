#!/usr/bin/env python3
"""
Re-extract graph entities from existing chunks without re-processing documents.

Usage:
    python reextract_graph.py <document_id>
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client
from processors.graph_extractor import GraphExtractor
from settings_service import SettingsService

load_dotenv()

def reextract_graph(document_id: str):
    """Re-extract graph entities from all chunks of a document."""
    
    # Initialize clients
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(supabase_url, supabase_key)
    
    # Initialize services
    settings_service = SettingsService(supabase)
    graph_extractor = GraphExtractor(supabase, settings_service=settings_service)
    
    # Get document info
    doc_result = supabase.table("documents").select("id, file_name, user_id").eq("id", document_id).execute()
    if not doc_result.data:
        print(f"❌ Document {document_id} not found")
        return
    
    doc = doc_result.data[0]
    user_id = doc["user_id"]
    file_name = doc["file_name"]
    
    print(f"📄 Re-extracting graph for: {file_name}")
    print(f"   Document ID: {document_id}")
    print(f"   User ID: {user_id}")
    
    # Get all chunks for this document
    chunks_result = supabase.table("chunks").select("id, content, chunk_index").eq("document_id", document_id).order("chunk_index").execute()
    chunks = chunks_result.data
    
    print(f"   Found {len(chunks)} chunks")
    print()
    
    # Process chunks in batches
    total_entities = 0
    total_relationships = 0
    
    for i, chunk in enumerate(chunks, 1):
        print(f"Processing chunk {i}/{len(chunks)}...", end="\r")
        
        try:
            entity_count, rel_count = graph_extractor.process_chunk(
                chunk_id=chunk["id"],
                chunk_content=chunk["content"],
                document_id=document_id,
                user_id=user_id
            )
            total_entities += entity_count
            total_relationships += rel_count
        except Exception as e:
            print(f"\n⚠️  Error processing chunk {i}: {e}")
    
    print()
    print(f"✅ Complete!")
    print(f"   Extracted {total_entities} entities")
    print(f"   Created {total_relationships} relationships")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python reextract_graph.py <document_id>")
        sys.exit(1)
    
    document_id = sys.argv[1]
    reextract_graph(document_id)
