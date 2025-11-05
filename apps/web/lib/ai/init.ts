/**
 * AI Model Initialization
 * 
 * Initializes models from database settings at application startup.
 * This should be called early in the application lifecycle.
 */

import { initModels } from './gateway';

/**
 * Initialize AI models from database settings
 * Call this during application startup
 */
export async function initializeAI() {
  try {
    await initModels();
    console.log('[AI] Models initialized successfully from database settings');
  } catch (error) {
    console.error('[AI] Failed to initialize models:', error);
    // Continue with default models - application should still work
  }
}
