import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

/**
 * Hash an API key using SHA256
 */
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Authentication result type
 */
export interface AuthResult {
  authenticated: boolean;
  user?: User | { id: string; email: string };
  error?: string;
  supabase?: SupabaseClient;
  useServiceRole?: boolean;
  tenantId?: string;  // For multi-tenant API key auth
}

/**
 * Authenticate API requests using either:
 * 1. Cookie-based Supabase auth (for web UI / admin)
 * 2. API key in X-API-Key header (for external apps)
 * 
 * API keys are looked up in the api_keys table and scoped to a tenant_id.
 * Legacy env-based API keys are still supported for backward compatibility.
 * 
 * Returns { authenticated: true, user, supabase, tenantId } on success
 * Returns { authenticated: false, error } on failure
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  // Check for API key first
  const apiKey = request.headers.get('x-api-key');
  
  if (apiKey) {
    // Create service role client for API key lookups (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);
    
    // First, check database for API key
    const keyHash = hashApiKey(apiKey);
    const { data: keyRecord } = await serviceClient
      .from('api_keys')
      .select('id, tenant_id, name, is_active')
      .eq('key_hash', keyHash)
      .single();
    
    if (keyRecord && keyRecord.is_active) {
      console.log(`[API Auth] Authenticated via API key: ${keyRecord.name}`);
      
      // Update last_used_at (fire and forget)
      serviceClient
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyRecord.id)
        .then(() => {});
      
      return {
        authenticated: true,
        user: { id: keyRecord.tenant_id, email: `api-${keyRecord.name}@mosaic.local` },
        supabase: serviceClient,
        useServiceRole: true,
        tenantId: keyRecord.tenant_id,
      };
    }
    
    // Fall back to legacy env-based API key (backward compatibility)
    const legacyApiKey = process.env.MOSAIC_API_KEY || process.env.N8N_SEARCH_API_KEY;
    if (legacyApiKey && apiKey === legacyApiKey) {
      console.log('[API Auth] Authenticated via legacy env API key');
      return {
        authenticated: true,
        user: { id: '00000000-0000-0000-0000-000000000000', email: 'api@mosaic.local' },
        supabase: serviceClient,
        useServiceRole: true,
        tenantId: undefined,  // No tenant scoping for legacy keys
      };
    }
    
    console.warn('[API Auth] Invalid API key provided');
    return {
      authenticated: false,
      error: 'Invalid API key',
    };
  }
  
  // Fall back to cookie-based Supabase auth (for admin UI)
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
      tenantId: undefined,  // Admin users aren't scoped to a tenant
    };
  } catch (error) {
    console.error('[API Auth] Authentication error:', error);
    return {
      authenticated: false,
      error: 'Authentication failed',
    };
  }
}

// Note: API key generation is now in app/(app)/admin/api-keys/actions.ts
// to avoid importing server-only code into client components
