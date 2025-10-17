"""
Settings service for reading configuration from database with caching.

Provides type-safe access to system settings stored in the database,
with a TTL cache to minimize database queries. Falls back to environment
variables if database is unavailable.
"""

import os
import time
import logging
from typing import Any, Optional, Dict
from supabase import Client

logger = logging.getLogger(__name__)


class SettingsService:
    """Service for reading and caching system settings from database."""
    
    def __init__(self, supabase_client: Client, ttl: int = 60):
        """
        Initialize settings service.
        
        Args:
            supabase_client: Supabase client for database access
            ttl: Cache time-to-live in seconds (default: 60)
        """
        self.supabase = supabase_client
        self._ttl = ttl
        self._cache: Dict[str, Any] = {}
        self._cache_time: float = 0
        
        # Load initial settings
        self._refresh_cache()
    
    def _refresh_cache(self) -> None:
        """Refresh the settings cache from database."""
        try:
            response = self.supabase.table('system_settings').select('*').execute()
            
            if response.data:
                # Clear existing cache
                self._cache.clear()
                
                # Populate cache with all settings
                for setting in response.data:
                    self._cache[setting['key']] = setting['value']
                
                self._cache_time = time.time()
                logger.info(f"Settings cache refreshed with {len(self._cache)} settings")
            else:
                logger.warning("No settings found in database")
                
        except Exception as e:
            logger.error(f"Error refreshing settings cache: {e}")
            # Keep existing cache if refresh fails
    
    def _is_cache_stale(self) -> bool:
        """Check if cache needs refresh."""
        return time.time() - self._cache_time > self._ttl
    
    def _get_value(self, key: str, default: Any, env_var: Optional[str] = None) -> Any:
        """
        Get a setting value from cache, refreshing if stale.
        
        Args:
            key: Setting key (e.g., 'processing.pdfWorkers')
            default: Default value if not found
            env_var: Optional environment variable name for fallback
            
        Returns:
            Setting value or default
        """
        # Refresh cache if stale
        if self._is_cache_stale():
            self._refresh_cache()
        
        # Try cache first
        if key in self._cache:
            return self._cache[key]
        
        # Try environment variable fallback
        if env_var and env_var in os.environ:
            logger.debug(f"Using ENV fallback for {key}: {env_var}")
            return os.environ[env_var]
        
        # Return default
        logger.debug(f"Using default for {key}: {default}")
        return default
    
    def get_bool(self, key: str, default: bool, env_var: Optional[str] = None) -> bool:
        """
        Get a boolean setting.
        
        Args:
            key: Setting key
            default: Default value
            env_var: Optional environment variable name for fallback
            
        Returns:
            Boolean value
        """
        value = self._get_value(key, default, env_var)
        
        # Handle various boolean representations
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes', 'on')
        if isinstance(value, (int, float)):
            return bool(value)
        
        return default
    
    def get_int(self, key: str, default: int, env_var: Optional[str] = None) -> int:
        """
        Get an integer setting.
        
        Args:
            key: Setting key
            default: Default value
            env_var: Optional environment variable name for fallback
            
        Returns:
            Integer value
        """
        value = self._get_value(key, default, env_var)
        
        try:
            return int(value)
        except (ValueError, TypeError):
            logger.warning(f"Invalid integer value for {key}: {value}, using default: {default}")
            return default
    
    def get_float(self, key: str, default: float, env_var: Optional[str] = None) -> float:
        """
        Get a float setting.
        
        Args:
            key: Setting key
            default: Default value
            env_var: Optional environment variable name for fallback
            
        Returns:
            Float value
        """
        value = self._get_value(key, default, env_var)
        
        try:
            return float(value)
        except (ValueError, TypeError):
            logger.warning(f"Invalid float value for {key}: {value}, using default: {default}")
            return default
    
    def get_string(self, key: str, default: str, env_var: Optional[str] = None) -> str:
        """
        Get a string setting.
        
        Args:
            key: Setting key
            default: Default value
            env_var: Optional environment variable name for fallback
            
        Returns:
            String value
        """
        value = self._get_value(key, default, env_var)
        return str(value) if value is not None else default
    
    def invalidate_cache(self) -> None:
        """Force cache refresh on next access."""
        self._cache_time = 0
        logger.info("Settings cache invalidated")
