"""
Docling-based document processor with VLM support.

Supports both API-based VLMs (GPT-4o-mini, etc.) and local VLMs (GraniteDocling).
Significantly faster than traditional OCR, especially for table-heavy documents.
"""

import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class DoclingProcessor:
    """Document processor using Docling with VLM support."""
    
    def __init__(self, use_api_vlm: bool = True):
        """
        Initialize Docling processor.
        
        Args:
            use_api_vlm: If True, use API-based VLM (GPT-4o-mini).
                        If False, use local VLM (GraniteDocling).
        """
        self.use_api_vlm = use_api_vlm
        self.converter = None
        
        # Lazy initialization - only import and configure when needed
        logger.info(f"Initializing Docling processor (API VLM: {use_api_vlm})")
    
    def _initialize_converter(self):
        """Lazy initialization of DocumentConverter to avoid import errors if not used."""
        if self.converter is not None:
            return
        
        try:
            from docling.document_converter import DocumentConverter, PdfFormatOption
            from docling.datamodel.base_models import InputFormat
            from docling.pipeline.vlm_pipeline import VlmPipeline
            from docling.datamodel.pipeline_options import VlmPipelineOptions
            
            if self.use_api_vlm:
                # API-based VLM (GPT-4o-mini)
                from docling.datamodel.pipeline_options_vlm_model import (
                    ApiVlmOptions,
                    ResponseFormat
                )
                
                api_key = os.getenv('OPENAI_API_KEY')
                if not api_key:
                    raise ValueError("OPENAI_API_KEY environment variable required for API VLM")
                
                vlm_options = ApiVlmOptions(
                    url="https://api.openai.com/v1/chat/completions",
                    params=dict(
                        model="gpt-4o-mini",
                        max_tokens=4096,
                    ),
                    headers={"Authorization": f"Bearer {api_key}"},
                    prompt="Convert this document page to markdown, preserving all tables, lists, and structure. Be precise and complete.",
                    temperature=0.1,
                    response_format=ResponseFormat.MARKDOWN,
                )
                
                pipeline_options = VlmPipelineOptions(
                    vlm_options=vlm_options,
                    enable_remote_services=True
                )
                
                logger.info("Configured Docling with API VLM (GPT-4o-mini)")
            else:
                # Local VLM (GraniteDocling)
                from docling.datamodel import vlm_model_specs
                
                pipeline_options = VlmPipelineOptions(
                    vlm_options=vlm_model_specs.GRANITEDOCLING
                )
                
                logger.info("Configured Docling with Local VLM (GraniteDocling)")
            
            self.converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(
                        pipeline_cls=VlmPipeline,
                        pipeline_options=pipeline_options,
                    )
                }
            )
            
            logger.info("Docling DocumentConverter initialized successfully")
            
        except ImportError as e:
            logger.error(f"Failed to import Docling dependencies: {e}")
            logger.error("Make sure 'docling' and 'openai' are installed")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Docling converter: {e}")
            raise
    
    def extract_elements(self, file_data: bytes, file_path: str) -> Optional[str]:
        """
        Extract text and structure from document using Docling.
        
        Args:
            file_data: Raw file bytes
            file_path: Original file path (for logging/context)
        
        Returns:
            Markdown string with document content, or None if processing fails.
            
        Note:
            Unlike UnstructuredProcessor which returns a list of elements,
            this returns a single markdown string. The markdown preserves
            document structure including tables, headings, lists, etc.
        """
        # Docling requires a file path, not BytesIO
        # Write bytes to temp file
        temp_file = None
        try:
            # Initialize converter on first use
            self._initialize_converter()
            
            logger.info(f"Processing file with Docling: {file_path}")
            logger.info(f"File size: {len(file_data) / 1024 / 1024:.1f}MB")
            logger.info(f"Using {'API VLM (GPT-4o-mini)' if self.use_api_vlm else 'Local VLM (GraniteDocling)'}")
            
            # Write bytes to temporary file
            # Docling needs a real file path, not BytesIO
            suffix = Path(file_path).suffix or '.pdf'
            with tempfile.NamedTemporaryFile(mode='wb', suffix=suffix, delete=False) as temp_file:
                temp_file.write(file_data)
                temp_path = temp_file.name
            
            logger.info(f"Wrote file to temp path: {temp_path}")
            
            # Process document
            logger.info("Starting Docling conversion...")
            result = self.converter.convert(source=temp_path)
            
            # Export to markdown
            markdown = result.document.export_to_markdown()
            
            logger.info(f"Docling processing complete")
            logger.info(f"Generated {len(markdown):,} characters of markdown")
            logger.info(f"Document has {markdown.count('#')} headings")
            logger.info(f"Document has {markdown.count('|')} table cells")
            
            return markdown
            
        except Exception as e:
            logger.error(f"Error processing with Docling: {e}", exc_info=True)
            return None
        finally:
            # Clean up temp file
            if temp_file and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                    logger.debug(f"Cleaned up temp file: {temp_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temp file {temp_path}: {e}")
