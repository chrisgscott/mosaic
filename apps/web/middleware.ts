import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";
import { initModels } from "@/lib/ai/gateway";

// Initialize models once at startup
let modelsInitialized = false;

export async function middleware(request: NextRequest) {
  // Initialize models on first request
  if (!modelsInitialized) {
    try {
      await initModels();
      modelsInitialized = true;
      console.log('[Middleware] AI models initialized successfully');
    } catch (error) {
      console.error('[Middleware] Failed to initialize models:', error);
      // Continue anyway - models will use defaults
    }
  }
  
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - api/proposal/* (proposal API endpoints - handle auth internally)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/proposal/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
