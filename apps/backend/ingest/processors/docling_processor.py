"""
Docling-based document processor with VLM support.

Supports both API-based VLMs (GPT-4o-mini, etc.) and local VLMs (GraniteDocling).
Significantly faster than traditional OCR, especially for table-heavy documents.
"""

import logging
import os
import tempfile
from pathlib import Path
from typing import Optional, List
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)


class DoclingProcessor:
    """Document processor using Docling with VLM support."""
    
    def __init__(self, use_api_vlm: bool = True, max_workers: int = 10, settings_service=None):
        """
        Initialize Docling processor.
        
        Args:
            use_api_vlm: If True, use API-based VLM (GPT-4o-mini).
                        If False, use local VLM (GraniteDocling).
            max_workers: Number of parallel workers for page processing (default: 10).
            settings_service: Optional settings service for reading model configuration.
        """
        self.use_api_vlm = use_api_vlm
        self.max_workers = max_workers
        self.settings_service = settings_service
        self.converter = None
        
        # Lazy initialization - only import and configure when needed
        logger.info(f"Initializing Docling processor (API VLM: {use_api_vlm}, max_workers: {max_workers})")
    
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
                
                # Get VLM model from settings (default to gpt-4o-mini)
                vlm_model = "gpt-4o-mini"
                if self.settings_service:
                    vlm_model = self.settings_service.get_string('processing.vlmModel', 'gpt-4o-mini')
                
                vlm_options = ApiVlmOptions(
                    url="https://api.openai.com/v1/chat/completions",
                    params=dict(
                        model=vlm_model,
                        max_tokens=4096,
                    ),
                    headers={"Authorization": f"Bearer {api_key}"},
                    prompt="Convert this document page to markdown, preserving all tables, lists, and structure. Be precise and complete.",
                    timeout=120,  # Increased from default 60s to reduce timeout failures
                    temperature=0.1,
                    response_format=ResponseFormat.MARKDOWN,
                )
                
                logger.info(f"Configured Docling with API VLM ({vlm_model})")
                
                pipeline_options = VlmPipelineOptions(
                    vlm_options=vlm_options,
                    enable_remote_services=True
                )
                
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
    
    def _split_pdf_pages(self, pdf_path: str) -> List[str]:
        """
        Split PDF into individual page files for parallel processing.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            List of paths to individual page PDFs
        """
        try:
            from pypdf import PdfReader, PdfWriter
            
            reader = PdfReader(pdf_path)
            num_pages = len(reader.pages)
            
            logger.info(f"Splitting PDF into {num_pages} pages for parallel processing")
            
            page_paths = []
            for page_num in range(num_pages):
                writer = PdfWriter()
                writer.add_page(reader.pages[page_num])
                
                # Create temp file for this page
                page_file = tempfile.NamedTemporaryFile(
                    mode='wb',
                    suffix=f'_page_{page_num + 1}.pdf',
                    delete=False
                )
                writer.write(page_file)
                page_file.close()
                page_paths.append(page_file.name)
            
            logger.info(f"Split PDF into {len(page_paths)} page files")
            return page_paths
            
        except Exception as e:
            logger.error(f"Error splitting PDF: {e}")
            raise
    
    def _merge_documents(self, page_documents: List[tuple[int, any]]):
        """
        Merge multiple DoclingDocument objects into a single document.
        
        Args:
            page_documents: List of (page_num, DoclingDocument) tuples
            
        Returns:
            Merged DoclingDocument object
        """
        from docling_core.types.doc import DoclingDocument
        
        # Sort by page number
        sorted_docs = sorted(page_documents, key=lambda x: x[0])
        
        # Start with the first document as base
        _, base_doc = sorted_docs[0]
        
        # Merge remaining documents
        for page_num, doc in sorted_docs[1:]:
            if doc is None:
                logger.warning(f"Skipping None document for page {page_num}")
                continue
                
            # Merge texts
            base_doc.texts.extend(doc.texts)
            
            # Merge tables if they exist
            if hasattr(doc, 'tables') and hasattr(base_doc, 'tables'):
                base_doc.tables.extend(doc.tables)
            
            # Merge pictures if they exist
            if hasattr(doc, 'pictures') and hasattr(base_doc, 'pictures'):
                base_doc.pictures.extend(doc.pictures)
        
        logger.info(f"Merged {len(sorted_docs)} pages into single document")
        logger.info(f"Total: {len(base_doc.texts)} text elements")
        if hasattr(base_doc, 'tables'):
            logger.info(f"Total: {len(base_doc.tables)} tables")
        
        return base_doc
    
    def _process_single_page_document(self, page_path: str, page_num: int):
        """
        Process a single PDF page and return DoclingDocument object.
        
        Args:
            page_path: Path to the single-page PDF
            page_num: Page number (1-indexed) for logging
            
        Returns:
            Tuple of (page_num, DoclingDocument or None)
        """
        try:
            # Each thread gets its own converter instance (thread-safe)
            from docling.document_converter import DocumentConverter, PdfFormatOption
            from docling.datamodel.base_models import InputFormat
            from docling.pipeline.vlm_pipeline import VlmPipeline
            from docling.datamodel.pipeline_options import VlmPipelineOptions
            
            if self.use_api_vlm:
                from docling.datamodel.pipeline_options_vlm_model import (
                    ApiVlmOptions,
                    ResponseFormat
                )
                
                api_key = os.getenv('OPENAI_API_KEY')
                vlm_options = ApiVlmOptions(
                    url="https://api.openai.com/v1/chat/completions",
                    params=dict(
                        model="gpt-4o-mini",
                        max_tokens=4096,
                    ),
                    headers={"Authorization": f"Bearer {api_key}"},
                    prompt="Convert this document page to markdown, preserving all tables, lists, and structure. Be precise and complete.",
                    timeout=120,
                    temperature=0.1,
                    response_format=ResponseFormat.MARKDOWN,
                )
                
                pipeline_options = VlmPipelineOptions(
                    vlm_options=vlm_options,
                    enable_remote_services=True
                )
            else:
                from docling.datamodel import vlm_model_specs
                pipeline_options = VlmPipelineOptions(
                    vlm_options=vlm_model_specs.GRANITEDOCLING
                )
            
            # Create converter for this thread
            converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(
                        pipeline_cls=VlmPipeline,
                        pipeline_options=pipeline_options,
                    )
                }
            )
            
            logger.debug(f"Processing page {page_num}...")
            result = converter.convert(source=page_path)
            doc = result.document
            
            logger.info(f"✓ Completed page {page_num} ({len(doc.texts)} text elements)")
            return (page_num, doc)
            
        except Exception as e:
            logger.error(f"✗ Error processing page {page_num}: {e}")
            return (page_num, None)
    
    def _process_single_page(self, page_path: str, page_num: int) -> tuple[int, Optional[str]]:
        """
        Process a single PDF page with its own converter instance (returns markdown).
        
        Args:
            page_path: Path to the single-page PDF
            page_num: Page number (1-indexed) for logging
            
        Returns:
            Tuple of (page_num, markdown_content)
        """
        try:
            # Each thread gets its own converter instance (thread-safe)
            from docling.document_converter import DocumentConverter, PdfFormatOption
            from docling.datamodel.base_models import InputFormat
            from docling.pipeline.vlm_pipeline import VlmPipeline
            from docling.datamodel.pipeline_options import VlmPipelineOptions
            
            if self.use_api_vlm:
                from docling.datamodel.pipeline_options_vlm_model import (
                    ApiVlmOptions,
                    ResponseFormat
                )
                
                api_key = os.getenv('OPENAI_API_KEY')
                vlm_options = ApiVlmOptions(
                    url="https://api.openai.com/v1/chat/completions",
                    params=dict(
                        model="gpt-4o-mini",
                        max_tokens=4096,
                    ),
                    headers={"Authorization": f"Bearer {api_key}"},
                    prompt="Convert this document page to markdown, preserving all tables, lists, and structure. Be precise and complete.",
                    timeout=120,  # Increased from default 60s to reduce timeout failures
                    temperature=0.1,
                    response_format=ResponseFormat.MARKDOWN,
                )
                
                pipeline_options = VlmPipelineOptions(
                    vlm_options=vlm_options,
                    enable_remote_services=True
                )
            else:
                from docling.datamodel import vlm_model_specs
                pipeline_options = VlmPipelineOptions(
                    vlm_options=vlm_model_specs.GRANITEDOCLING
                )
            
            # Create converter for this thread
            converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(
                        pipeline_cls=VlmPipeline,
                        pipeline_options=pipeline_options,
                    )
                }
            )
            
            logger.debug(f"Processing page {page_num}...")
            result = converter.convert(source=page_path)
            markdown = result.document.export_to_markdown()
            
            logger.info(f"✓ Completed page {page_num} ({len(markdown):,} chars)")
            return (page_num, markdown)
            
        except Exception as e:
            logger.error(f"✗ Error processing page {page_num}: {e}")
            return (page_num, None)
    
    def extract_document(self, file_data: bytes, file_path: str):
        """
        Extract DoclingDocument object for use with HybridChunker.
        
        Args:
            file_data: Raw file bytes
            file_path: Original file path (for logging/context)
        
        Returns:
            DoclingDocument object, or None if processing fails.
            
        Note:
            This method returns the full DoclingDocument object which can be used
            with Docling's native chunkers (HybridChunker, HierarchicalChunker).
            For parallel processing, pages are combined into a single document.
        """
        temp_path = None
        page_paths = []
        
        try:
            logger.info(f"Processing file with Docling: {file_path}")
            logger.info(f"File size: {len(file_data) / 1024 / 1024:.1f}MB")
            logger.info(f"Using {'API VLM (GPT-4o-mini)' if self.use_api_vlm else 'Local VLM (GraniteDocling)'}")
            
            # Write bytes to temporary file
            suffix = Path(file_path).suffix or '.pdf'
            
            # Convert .txt to .md since Docling doesn't support plain text
            if suffix.lower() == '.txt':
                suffix = '.md'
                logger.info("Converting .txt to .md for Docling compatibility")
            
            with tempfile.NamedTemporaryFile(mode='wb', suffix=suffix, delete=False) as temp_file:
                temp_file.write(file_data)
                temp_path = temp_file.name
            
            logger.info(f"Wrote file to temp path: {temp_path}")
            
            # Check if it's a PDF and should be split for parallel processing
            is_pdf = suffix.lower() == '.pdf'
            
            if is_pdf and self.max_workers > 1:
                # Parallel processing for PDFs - split, process, merge
                logger.info(f"Starting parallel page processing with {self.max_workers} workers...")
                
                # Split PDF into pages
                page_paths = self._split_pdf_pages(temp_path)
                total_pages = len(page_paths)
                
                # Process pages in parallel
                page_documents = []
                completed = 0
                
                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    # Submit all page processing tasks
                    future_to_page = {
                        executor.submit(self._process_single_page_document, page_path, page_num): page_num
                        for page_num, page_path in enumerate(page_paths, start=1)
                    }
                    
                    # Collect results as they complete
                    for future in as_completed(future_to_page):
                        page_num, doc = future.result()
                        if doc:
                            page_documents.append((page_num, doc))
                        completed += 1
                        
                        if completed % 10 == 0 or completed == total_pages:
                            logger.info(f"Progress: {completed}/{total_pages} pages processed")
                
                # Merge all page documents into one
                logger.info("Merging page documents...")
                document = self._merge_documents(page_documents)
                
                return document
            else:
                # Sequential processing for non-PDFs or single-worker mode
                logger.info("Processing document sequentially...")
                self._initialize_converter()
                
                result = self.converter.convert(source=temp_path)
                document = result.document
                
                logger.info(f"Document processed successfully")
                logger.info(f"Document has {len(document.texts)} text elements")
                if hasattr(document, 'tables'):
                    logger.info(f"Document has {len(document.tables)} tables")
                
                return document
            
        except Exception as e:
            logger.error(f"Error processing with Docling: {e}", exc_info=True)
            return None
        finally:
            # Clean up temp files
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                    logger.debug(f"Cleaned up temp file: {temp_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temp file {temp_path}: {e}")
    
    def extract_elements(self, file_data: bytes, file_path: str) -> Optional[str]:
        """
        Extract text and structure from document using Docling with parallel processing.
        
        Args:
            file_data: Raw file bytes
            file_path: Original file path (for logging/context)
        
        Returns:
            Markdown string with document content, or None if processing fails.
            
        Note:
            Unlike UnstructuredProcessor which returns a list of elements,
            this returns a single markdown string. The markdown preserves
            document structure including tables, headings, lists, etc.
            
            For PDFs, pages are processed in parallel using max_workers threads
            for significantly faster processing.
        """
        temp_path = None
        page_paths = []
        
        try:
            logger.info(f"Processing file with Docling: {file_path}")
            logger.info(f"File size: {len(file_data) / 1024 / 1024:.1f}MB")
            logger.info(f"Using {'API VLM (GPT-4o-mini)' if self.use_api_vlm else 'Local VLM (GraniteDocling)'}")
            logger.info(f"Parallel workers: {self.max_workers}")
            
            # Write bytes to temporary file
            suffix = Path(file_path).suffix or '.pdf'
            
            # Convert .txt to .md since Docling doesn't support plain text
            if suffix.lower() == '.txt':
                suffix = '.md'
                logger.info("Converting .txt to .md for Docling compatibility")
            
            with tempfile.NamedTemporaryFile(mode='wb', suffix=suffix, delete=False) as temp_file:
                temp_file.write(file_data)
                temp_path = temp_file.name
            
            logger.info(f"Wrote file to temp path: {temp_path}")
            
            # Check if it's a PDF and should be split for parallel processing
            is_pdf = suffix.lower() == '.pdf'
            
            if is_pdf and self.max_workers > 1:
                # Parallel processing for PDFs
                logger.info("Starting parallel page processing...")
                
                # Split PDF into pages
                page_paths = self._split_pdf_pages(temp_path)
                total_pages = len(page_paths)
                
                # Process pages in parallel
                page_results = {}
                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    # Submit all pages for processing
                    future_to_page = {
                        executor.submit(self._process_single_page, page_path, page_num + 1): page_num + 1
                        for page_num, page_path in enumerate(page_paths)
                    }
                    
                    # Collect results as they complete
                    completed = 0
                    for future in as_completed(future_to_page):
                        page_num, markdown = future.result()
                        if markdown:
                            page_results[page_num] = markdown
                        completed += 1
                        
                        if completed % 10 == 0 or completed == total_pages:
                            logger.info(f"Progress: {completed}/{total_pages} pages completed ({completed/total_pages*100:.1f}%)")
                
                # Combine pages in order
                logger.info("Combining page results...")
                markdown_pages = []
                for page_num in sorted(page_results.keys()):
                    markdown_pages.append(page_results[page_num])
                
                markdown = "\n\n".join(markdown_pages)
                
                logger.info(f"Parallel processing complete")
                logger.info(f"Processed {len(page_results)}/{total_pages} pages successfully")
                
            else:
                # Sequential processing for non-PDFs or single-worker mode
                logger.info("Starting sequential processing...")
                self._initialize_converter()
                
                result = self.converter.convert(source=temp_path)
                markdown = result.document.export_to_markdown()
                
                logger.info(f"Sequential processing complete")
            
            logger.info(f"Generated {len(markdown):,} characters of markdown")
            logger.info(f"Document has {markdown.count('#')} headings")
            logger.info(f"Document has {markdown.count('|')} table cells")
            
            return markdown
            
        except Exception as e:
            logger.error(f"Error processing with Docling: {e}", exc_info=True)
            return None
        finally:
            # Clean up temp files
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                    logger.debug(f"Cleaned up main temp file: {temp_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temp file {temp_path}: {e}")
            
            # Clean up page files
            for page_path in page_paths:
                if os.path.exists(page_path):
                    try:
                        os.unlink(page_path)
                        logger.debug(f"Cleaned up page file: {page_path}")
                    except Exception as e:
                        logger.warning(f"Failed to clean up page file {page_path}: {e}")
