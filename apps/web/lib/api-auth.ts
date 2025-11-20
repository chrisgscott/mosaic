import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

/**
 * Authenticate API requests using either:
 * 1. Cookie-based Supabase auth (for web UI)
 * 2. API key in X-API-Key header (for external integrations)
 * 
 * Returns { authenticated: true, user } on success
 * Returns { authenticated: false, error } on failure
 */
export async function authenticateRequest(request: NextRequest): Promise<{
  authenticated: boolean;
  user?: any;
  error?: string;
}> {
  // Check for API key first
  const apiKey = request.headers.get('x-api-key');
  
  if (apiKey) {
    // Validate API key against environment variable
    const validApiKey = process.env.MOSAIC_API_KEY || process.env.N8N_SEARCH_API_KEY;
    
    if (!validApiKey) {
      console.warn('[API Auth] No API key configured in environment');
      return {
        authenticated: false,
        error: 'API key authentication not configured',
      };
    }
    
    if (apiKey === validApiKey) {
      console.log('[API Auth] Authenticated via API key');
      return {
        authenticated: true,
        user: { id: 'api-key-user', email: 'api@mosaic.local' },
      };
    } else {
      console.warn('[API Auth] Invalid API key provided');
      return {
        authenticated: false,
        error: 'Invalid API key',
      };
    }
  }
  
  // Fall back to cookie-based Supabase auth
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.warn('[API Auth] Cookie auth failed:', authError?.message);
      return {
        authenticated: false,
        error: 'Unauthorized - please login or provide API key',
      };
    }
    
    console.log('[API Auth] Authenticated via Supabase session');
    return {
      authenticated: true,
      user,
    };
  } catch (error) {
    console.error('[API Auth] Authentication error:', error);
    return {
      authenticated: false,
      error: 'Authentication failed',
    };
  }
}
