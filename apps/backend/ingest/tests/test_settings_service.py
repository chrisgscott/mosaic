"""
Unit tests for SettingsService

Tests cache behavior, type conversions, and fallbacks.
"""

import os
import time
import pytest
from unittest.mock import Mock, MagicMock
from settings_service import SettingsService


class TestSettingsService:
    """Test suite for SettingsService"""
    
    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client"""
        mock = Mock()
        mock.table = Mock(return_value=mock)
        mock.select = Mock(return_value=mock)
        mock.execute = Mock()
        return mock
    
    @pytest.fixture
    def settings_data(self):
        """Sample settings data"""
        return [
            {"key": "processing.pdfWorkers", "value": 15},
            {"key": "processing.useApiVlm", "value": True},
            {"key": "processing.vlmModel", "value": "gpt-4o"},
            {"key": "llm.temperature", "value": 0.7},
        ]
    
    def test_initialization_loads_settings(self, mock_supabase, settings_data):
        """Test that settings are loaded on initialization"""
        mock_supabase.execute.return_value = Mock(data=settings_data)
        
        service = SettingsService(mock_supabase, ttl=60)
        
        # Verify database was queried
        mock_supabase.table.assert_called_with('system_settings')
        mock_supabase.select.assert_called_with('*')
        
        # Verify cache was populated
        assert len(service._cache) == 4
        assert service._cache["processing.pdfWorkers"] == 15
    
    def test_get_int_returns_correct_value(self, mock_supabase, settings_data):
        """Test get_int returns integer value"""
        mock_supabase.execute.return_value = Mock(data=settings_data)
        service = SettingsService(mock_supabase, ttl=60)
        
        result = service.get_int("processing.pdfWorkers", 10)
        assert result == 15
        assert isinstance(result, int)
    
    def test_get_bool_returns_correct_value(self, mock_supabase, settings_data):
        """Test get_bool returns boolean value"""
        mock_supabase.execute.return_value = Mock(data=settings_data)
        service = SettingsService(mock_supabase, ttl=60)
        
        result = service.get_bool("processing.useApiVlm", False)
        assert result is True
        assert isinstance(result, bool)
    
    def test_get_string_returns_correct_value(self, mock_supabase, settings_data):
        """Test get_string returns string value"""
        mock_supabase.execute.return_value = Mock(data=settings_data)
        service = SettingsService(mock_supabase, ttl=60)
        
        result = service.get_string("processing.vlmModel", "gpt-4o-mini")
        assert result == "gpt-4o"
        assert isinstance(result, str)
    
    def test_get_float_returns_correct_value(self, mock_supabase, settings_data):
        """Test get_float returns float value"""
        mock_supabase.execute.return_value = Mock(data=settings_data)
        service = SettingsService(mock_supabase, ttl=60)
        
        result = service.get_float("llm.temperature", 0.5)
        assert result == 0.7
        assert isinstance(result, float)
    
    def test_returns_default_for_missing_key(self, mock_supabase, settings_data):
        """Test that default value is returned for missing keys"""
        mock_supabase.execute.return_value = Mock(data=settings_data)
        service = SettingsService(mock_supabase, ttl=60)
        
        result = service.get_int("nonexistent.key", 42)
        assert result == 42
    
    def test_env_fallback_when_key_missing(self, mock_supabase, settings_data):
        """Test fallback to environment variable"""
        mock_supabase.execute.return_value = Mock(data=settings_data)
        service = SettingsService(mock_supabase, ttl=60)
        
        # Set environment variable
        os.environ["TEST_ENV_VAR"] = "123"
        
        result = service.get_int("missing.key", 10, env_var="TEST_ENV_VAR")
        assert result == 123
        
        # Cleanup
        del os.environ["TEST_ENV_VAR"]
    
    def test_cache_refresh_after_ttl(self, mock_supabase, settings_data):
        """Test that cache refreshes after TTL expires"""
        # Initial data
        mock_supabase.execute.return_value = Mock(data=settings_data)
        service = SettingsService(mock_supabase, ttl=1)  # 1 second TTL
        
        # Get initial value
        initial = service.get_int("processing.pdfWorkers", 10)
        assert initial == 15
        
        # Update mock data
        updated_data = [{"key": "processing.pdfWorkers", "value": 20}]
        mock_supabase.execute.return_value = Mock(data=updated_data)
        
        # Wait for TTL to expire
        time.sleep(1.1)
        
        # Get value again - should trigger refresh
        updated = service.get_int("processing.pdfWorkers", 10)
        assert updated == 20
    
    def test_cache_not_refreshed_before_ttl(self, mock_supabase, settings_data):
        """Test that cache is not refreshed before TTL expires"""
        mock_supabase.execute.return_value = Mock(data=settings_data)
        service = SettingsService(mock_supabase, ttl=60)
        
        # Get initial value
        initial = service.get_int("processing.pdfWorkers", 10)
        assert initial == 15
        
        # Reset mock to track new calls
        mock_supabase.execute.reset_mock()
        
        # Get value again immediately - should use cache
        cached = service.get_int("processing.pdfWorkers", 10)
        assert cached == 15
        
        # Verify no new database call was made
        mock_supabase.execute.assert_not_called()
    
    def test_type_conversion_handles_string_boolean(self, mock_supabase):
        """Test that string 'true'/'false' converts to boolean"""
        data = [{"key": "test.bool", "value": "true"}]
        mock_supabase.execute.return_value = Mock(data=data)
        service = SettingsService(mock_supabase, ttl=60)
        
        result = service.get_bool("test.bool", False)
        assert result is True
    
    def test_type_conversion_handles_string_number(self, mock_supabase):
        """Test that string numbers convert to int/float"""
        data = [
            {"key": "test.int", "value": "42"},
            {"key": "test.float", "value": "3.14"}
        ]
        mock_supabase.execute.return_value = Mock(data=data)
        service = SettingsService(mock_supabase, ttl=60)
        
        int_result = service.get_int("test.int", 0)
        assert int_result == 42
        
        float_result = service.get_float("test.float", 0.0)
        assert float_result == 3.14
    
    def test_invalid_type_returns_default(self, mock_supabase):
        """Test that invalid type conversions return default"""
        data = [{"key": "test.int", "value": "not_a_number"}]
        mock_supabase.execute.return_value = Mock(data=data)
        service = SettingsService(mock_supabase, ttl=60)
        
        result = service.get_int("test.int", 99)
        assert result == 99
    
    def test_database_error_keeps_existing_cache(self, mock_supabase, settings_data):
        """Test that cache is preserved if refresh fails"""
        # Initial successful load
        mock_supabase.execute.return_value = Mock(data=settings_data)
        service = SettingsService(mock_supabase, ttl=1)
        
        initial = service.get_int("processing.pdfWorkers", 10)
        assert initial == 15
        
        # Simulate database error on refresh
        mock_supabase.execute.side_effect = Exception("Database error")
        
        # Wait for TTL to expire
        time.sleep(1.1)
        
        # Should still return cached value despite error
        result = service.get_int("processing.pdfWorkers", 10)
        assert result == 15
    
    def test_invalidate_cache_forces_refresh(self, mock_supabase, settings_data):
        """Test that invalidate_cache forces immediate refresh"""
        mock_supabase.execute.return_value = Mock(data=settings_data)
        service = SettingsService(mock_supabase, ttl=60)
        
        # Get initial value
        initial = service.get_int("processing.pdfWorkers", 10)
        assert initial == 15
        
        # Invalidate cache
        service.invalidate_cache()
        
        # Update mock data
        updated_data = [{"key": "processing.pdfWorkers", "value": 25}]
        mock_supabase.execute.return_value = Mock(data=updated_data)
        
        # Next access should refresh immediately
        updated = service.get_int("processing.pdfWorkers", 10)
        assert updated == 25
