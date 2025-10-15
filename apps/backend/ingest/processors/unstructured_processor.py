"""
Unstructured.io text extraction processor.

Handles extraction of text from various document formats using the Unstructured library.
"""

import logging
import tempfile
import os
import shutil
from typing import Optional, List, Any
from unstructured.partition.auto import partition

logger = logging.getLogger(__name__)


class UnstructuredProcessor:
    """Extract text from documents using Unstructured.io."""
    
    def __init__(self):
        """Initialize the Unstructured processor."""
        self.supported_extensions = {
            '.pdf', '.docx', '.doc', '.txt', '.md', 
            '.html', '.xml', '.csv', '.xlsx', '.pptx'
        }
    
    def extract_elements(self, file_data: bytes, file_path: str) -> Optional[List[Any]]:
        """
        Extract document elements for chunking.
        
        Args:
            file_data: Raw file bytes
            file_path: Original file path (used to determine file type)
            
        Returns:
            List of Unstructured document elements, or None if extraction fails
        """
        # Get file extension
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        
        if ext not in self.supported_extensions:
            logger.warning(f"Unsupported file type: {ext}")
            return None
        
        # Write to temporary file (Unstructured needs a file path)
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_file:
            tmp_file.write(file_data)
            tmp_path = tmp_file.name
        
        try:
            logger.info(f"Processing file with extension {ext}")
            logger.info(f"File size: {len(file_data)} bytes")
            
            # Use Unstructured to partition the document
            # partition() automatically detects the file type and uses the appropriate parser
            logger.info("Starting partition() call...")
            elements = partition(
                filename=tmp_path,
                strategy="auto",  # Auto-select best strategy (we have 2GB RAM now)
                include_page_breaks=True,  # Track page boundaries for citations
                infer_table_structure=True,  # Extract tables as structured HTML
            )
            logger.info(f"Partition complete, got {len(elements)} elements")
            
            # Return elements for chunking
            # Elements include paragraphs, titles, lists, tables, etc.
            # The chunker will use these to respect semantic boundaries
            return elements
            
        except Exception as e:
            logger.error(f"Error extracting text from {file_path}: {e}")
            return None
            
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.warning(f"Could not delete temp file {tmp_path}: {e}")
            
            # Clean up any Unstructured temp directories
            # Unstructured creates temp dirs for image extraction, etc.
            self.cleanup_temp_dirs()
    
    def extract_with_metadata(self, file_data: bytes, file_path: str) -> Optional[dict]:
        """
        Extract text along with metadata (page numbers, sections, etc.).
        
        This is a more advanced version that preserves structure.
        Can be used in the future for better chunking.
        
        Returns:
            Dictionary with 'text' and 'metadata' keys
        """
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        
        if ext not in self.supported_extensions:
            return None
        
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_file:
            tmp_file.write(file_data)
            tmp_path = tmp_file.name
        
        try:
            elements = partition(filename=tmp_path, strategy="auto")
            
            # Build structured output
            structured_content = []
            for element in elements:
                element_dict = {
                    "text": str(element),
                    "type": element.category if hasattr(element, 'category') else "unknown",
                    "metadata": {}
                }
                
                # Extract metadata if available
                if hasattr(element, 'metadata'):
                    metadata = element.metadata
                    if hasattr(metadata, 'page_number'):
                        element_dict["metadata"]["page"] = metadata.page_number
                    if hasattr(metadata, 'filename'):
                        element_dict["metadata"]["filename"] = metadata.filename
                
                structured_content.append(element_dict)
            
            return {
                "text": "\n\n".join([e["text"] for e in structured_content if e["text"].strip()]),
                "elements": structured_content
            }
            
        except Exception as e:
            logger.error(f"Error extracting structured content: {e}")
            return None
            
        finally:
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    def cleanup_temp_dirs(self):
        """Clean up temporary directories created by Unstructured."""
        try:
            tmp_dir = tempfile.gettempdir()
            import time
            current_time = time.time()
            
            cleaned_count = 0
            for item in os.listdir(tmp_dir):
                item_path = os.path.join(tmp_dir, item)
                try:
                    # Clean up Unstructured-related temp dirs immediately after processing
                    # Also clean up any temp dirs older than 5 minutes
                    if os.path.isdir(item_path):
                        age_seconds = current_time - os.path.getmtime(item_path)
                        
                        # Aggressive cleanup: remove Unstructured dirs immediately
                        # Remove other temp dirs after 5 minutes
                        should_remove = (
                            'unstructured' in item.lower() or
                            item.startswith('tmp') and age_seconds > 300
                        )
                        
                        if should_remove:
                            shutil.rmtree(item_path, ignore_errors=True)
                            cleaned_count += 1
                except Exception:
                    # Ignore errors for individual items
                    pass
            
            if cleaned_count > 0:
                logger.info(f"Cleaned up {cleaned_count} temp directories")
                
        except Exception as e:
            logger.warning(f"Error during temp cleanup: {e}")
