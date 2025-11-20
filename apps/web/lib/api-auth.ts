import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

/**
 * Authenticate API requests using either:
 * 1. Cookie-based Supabase auth (for web UI)
 * 2. API key in X-API-Key header (for external integrations)
 * 
 * Returns { authenticated: true, user, supabase } on success
 * Returns { authenticated: false, error } on failure
 * 
 * When using API key auth, returns a service role client to bypass RLS
 */
export async function authenticateRequest(request: NextRequest): Promise<{
  authenticated: boolean;
  user?: any;
  error?: string;
  supabase?: any;
  useServiceRole?: boolean;
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
      
      // Create service role client to bypass RLS
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);
      
      return {
        authenticated: true,
        user: { id: '00000000-0000-0000-0000-000000000000', email: 'api@mosaic.local' },
        supabase: serviceClient,
        useServiceRole: true,
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
