"""
Unstructured.io text extraction processor.

Handles extraction of text from various document formats using the Unstructured library.
"""

import logging
import tempfile
import os
from typing import Optional
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
    
    def extract_text(self, file_data: bytes, file_path: str) -> Optional[str]:
        """
        Extract text from a document.
        
        Args:
            file_data: Raw file bytes
            file_path: Original file path (used to determine file type)
            
        Returns:
            Extracted text as a string, or None if extraction fails
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
                strategy="fast",  # Use "fast" for Starter plan - less memory intensive
                # "auto" and "hi_res" use more memory and can timeout on small instances
            )
            logger.info(f"Partition complete, got {len(elements)} elements")
            
            # Combine all text elements
            # Elements include paragraphs, titles, lists, tables, etc.
            text_parts = []
            for element in elements:
                # Get text from element
                text = str(element)
                if text.strip():
                    text_parts.append(text)
            
            # Join with double newlines to preserve some structure
            full_text = "\n\n".join(text_parts)
            
            logger.info(f"Extracted {len(full_text)} characters from {len(elements)} elements")
            
            return full_text
            
        except Exception as e:
            logger.error(f"Error extracting text from {file_path}: {e}")
            return None
            
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.warning(f"Could not delete temp file {tmp_path}: {e}")
    
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
