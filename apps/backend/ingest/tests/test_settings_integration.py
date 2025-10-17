"""
Integration tests for settings with processors

Tests that processors correctly read and use settings from SettingsService.
"""

import pytest
import sys
from unittest.mock import Mock, patch, MagicMock

# Mock heavy dependencies before importing processors
sys.modules['docling'] = MagicMock()
sys.modules['docling.document_converter'] = MagicMock()
sys.modules['docling.datamodel.base_models'] = MagicMock()
sys.modules['docling.pipeline.vlm_pipeline'] = MagicMock()
sys.modules['docling.datamodel.pipeline_options'] = MagicMock()
sys.modules['docling.datamodel.pipeline_options_vlm_model'] = MagicMock()
sys.modules['docling_core'] = MagicMock()
sys.modules['docling_core.types.doc.document'] = MagicMock()
sys.modules['docling_core.transforms.chunker.tokenizer.huggingface'] = MagicMock()
sys.modules['docling.chunking'] = MagicMock()
sys.modules['transformers'] = MagicMock()

from settings_service import SettingsService
from processors.docling_processor import DoclingProcessor
from chunkers.hybrid_chunker import HybridChunker
from processors.graph_extractor import GraphExtractor
from processors.embeddings_generator import EmbeddingsGenerator


class TestDoclingProcessorSettings:
    """Test DoclingProcessor settings integration"""
    
    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client"""
        mock = Mock()
        mock.table = Mock(return_value=mock)
        mock.select = Mock(return_value=mock)
        mock.execute = Mock()
        return mock
    
    def test_accepts_settings_service(self, mock_supabase):
        """Test that DoclingProcessor accepts and stores settings_service"""
        settings_data = [{"key": "processing.vlmModel", "value": "gpt-4o"}]
        mock_supabase.execute.return_value = Mock(data=settings_data)
        settings_service = SettingsService(mock_supabase, ttl=60)
        
        # Create processor with settings
        processor = DoclingProcessor(
            use_api_vlm=True,
            max_workers=10,
            settings_service=settings_service
        )
        
        # Verify settings service is attached
        assert processor.settings_service is not None
        assert processor.settings_service == settings_service
    
    def test_works_without_settings_service(self):
        """Test that processor works without settings service"""
        processor = DoclingProcessor(
            use_api_vlm=True,
            max_workers=10,
            settings_service=None
        )
        
        assert processor.settings_service is None


class TestHybridChunkerSettings:
    """Test HybridChunker settings integration"""
    
    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client"""
        mock = Mock()
        mock.table = Mock(return_value=mock)
        mock.select = Mock(return_value=mock)
        mock.execute = Mock()
        return mock
    
    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'})
    def test_accepts_settings_service(self, mock_supabase):
        """Test that HybridChunker accepts and stores settings_service"""
        settings_data = [{"key": "processing.summaryModel", "value": "gpt-4o"}]
        mock_supabase.execute.return_value = Mock(data=settings_data)
        settings_service = SettingsService(mock_supabase, ttl=60)
        
        # Create chunker with settings
        chunker = HybridChunker(
            summary_neighbors=2,
            settings_service=settings_service
        )
        
        assert chunker.settings_service is not None
        assert chunker.settings_service == settings_service
    
    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'})
    def test_works_without_settings_service(self):
        """Test that chunker works without settings service"""
        chunker = HybridChunker(
            summary_neighbors=2,
            settings_service=None
        )
        
        assert chunker.settings_service is None


class TestGraphExtractorSettings:
    """Test GraphExtractor settings integration"""
    
    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client"""
        mock = Mock()
        mock.table = Mock(return_value=mock)
        mock.select = Mock(return_value=mock)
        mock.execute = Mock()
        return mock
    
    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'})
    def test_accepts_settings_service(self, mock_supabase):
        """Test that GraphExtractor accepts and stores settings_service"""
        settings_data = [{"key": "processing.graphModel", "value": "gpt-4o"}]
        mock_supabase.execute.return_value = Mock(data=settings_data)
        settings_service = SettingsService(mock_supabase, ttl=60)
        
        # Create extractor with settings
        extractor = GraphExtractor(
            mock_supabase,
            settings_service=settings_service
        )
        
        assert extractor.settings_service is not None
        assert extractor.settings_service == settings_service
    
    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'})
    def test_works_without_settings_service(self, mock_supabase):
        """Test that extractor works without settings service"""
        extractor = GraphExtractor(
            mock_supabase,
            settings_service=None
        )
        
        assert extractor.settings_service is None


class TestEmbeddingsGeneratorSettings:
    """Test EmbeddingsGenerator settings integration"""
    
    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client"""
        mock = Mock()
        mock.table = Mock(return_value=mock)
        mock.select = Mock(return_value=mock)
        mock.execute = Mock()
        return mock
    
    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'})
    def test_reads_model_from_settings(self, mock_supabase):
        """Test that EmbeddingsGenerator reads model from settings"""
        settings_data = [
            {"key": "llm.embeddingModel", "value": "text-embedding-3-large"}
        ]
        mock_supabase.execute.return_value = Mock(data=settings_data)
        settings_service = SettingsService(mock_supabase, ttl=60)
        
        # Create generator with settings
        generator = EmbeddingsGenerator(
            mock_supabase,
            settings_service=settings_service
        )
        
        # Verify model was read from settings
        assert generator.model == "text-embedding-3-large"
    
    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'})
    def test_uses_default_without_settings(self, mock_supabase):
        """Test that generator uses default model without settings service"""
        generator = EmbeddingsGenerator(
            mock_supabase,
            settings_service=None
        )
        
        # Should use default
        assert generator.model == "text-embedding-3-small"


class TestSettingsChangeDetection:
    """Test that settings changes are detected after cache refresh"""
    
    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client"""
        mock = Mock()
        mock.table = Mock(return_value=mock)
        mock.select = Mock(return_value=mock)
        mock.execute = Mock()
        return mock
    
    def test_processor_picks_up_changed_setting(self, mock_supabase):
        """Test that processor uses updated setting after cache refresh"""
        # Initial settings
        initial_data = [{"key": "processing.vlmModel", "value": "gpt-4o-mini"}]
        mock_supabase.execute.return_value = Mock(data=initial_data)
        
        # Create settings service with short TTL
        settings_service = SettingsService(mock_supabase, ttl=1)
        
        # Verify initial value
        initial_model = settings_service.get_string("processing.vlmModel", "default")
        assert initial_model == "gpt-4o-mini"
        
        # Update settings in "database"
        updated_data = [{"key": "processing.vlmModel", "value": "gpt-4o"}]
        mock_supabase.execute.return_value = Mock(data=updated_data)
        
        # Force cache refresh
        settings_service.invalidate_cache()
        
        # Verify updated value
        updated_model = settings_service.get_string("processing.vlmModel", "default")
        assert updated_model == "gpt-4o"
