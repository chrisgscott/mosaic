#!/usr/bin/env python3
"""
Generate Embeddings Script

Standalone script to generate embeddings for existing chunks in the database.
Can be run manually or as a one-time migration.

Usage:
    python generate_embeddings.py                    # Process all documents
    python generate_embeddings.py --document-id <id> # Process specific document
    python generate_embeddings.py --user-id <id>     # Process documents for specific user
"""

import os
import sys
import argparse
import logging
from dotenv import load_dotenv
from supabase import create_client

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from processors.embeddings_generator import EmbeddingsGenerator

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Main function to generate embeddings."""
    parser = argparse.ArgumentParser(description="Generate embeddings for document chunks")
    parser.add_argument("--document-id", help="Process specific document by ID")
    parser.add_argument("--user-id", help="Process documents for specific user")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
        sys.exit(1)
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Initialize embeddings generator
    try:
        generator = EmbeddingsGenerator(supabase)
    except Exception as e:
        logger.error(f"Failed to initialize embeddings generator: {e}")
        sys.exit(1)
    
    # Process based on arguments
    try:
        if args.document_id:
            logger.info(f"Processing document: {args.document_id}")
            result = generator.generate_for_document(args.document_id)
            
            if result["success"]:
                logger.info(f"✅ Success! Processed {result['processed']}/{result['total_chunks']} chunks")
            else:
                logger.error(f"❌ Failed: {result.get('error', 'Unknown error')}")
                sys.exit(1)
        
        else:
            logger.info("Processing all documents...")
            if args.user_id:
                logger.info(f"Filtering by user: {args.user_id}")
            
            result = generator.generate_for_all_documents(user_id=args.user_id)
            
            if result["success"]:
                logger.info("\n" + "="*60)
                logger.info("📊 SUMMARY")
                logger.info("="*60)
                logger.info(f"Total documents: {result['total_documents']}")
                logger.info(f"Successful: {result['successful_documents']}")
                logger.info(f"Failed: {result['failed_documents']}")
                logger.info(f"Total chunks processed: {result['total_chunks_processed']}")
                logger.info(f"Total chunks failed: {result['total_chunks_failed']}")
                logger.info("="*60)
                
                if result['failed_documents'] > 0:
                    logger.warning(f"⚠️  {result['failed_documents']} documents had errors")
                    sys.exit(1)
                else:
                    logger.info("✅ All documents processed successfully!")
            else:
                logger.error(f"❌ Batch processing failed: {result.get('error', 'Unknown error')}")
                sys.exit(1)
    
    except KeyboardInterrupt:
        logger.info("\n⚠️  Interrupted by user")
        sys.exit(130)
    
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
