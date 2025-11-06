import { NextRequest } from 'next/server';

// In-memory progress storage (for real-time streaming)
const progressStore = new Map<string, Array<{
  message: string;
  status: 'in-progress' | 'completed';
  timestamp: string;
}>>();

// Track active SSE controllers per session for immediate push
const activeControllers = new Map<string, ReadableStreamDefaultController>();

// Track completed sessions to close SSE streams
const completedSessions = new Set<string>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  console.log(`[Progress SSE] Connection requested for session: ${id}`);
  
  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      console.log(`[Progress SSE] Stream started for session: ${id}`);
      
      // Register this controller for immediate push
      activeControllers.set(id, controller);
      
      try {
        // Send simple ping message first
        const pingData = `data: ping\n\n`;
        controller.enqueue(encoder.encode(pingData));
        console.log(`[Progress SSE] Sent ping message for session: ${id}`);
        
        // Send current progress if any exists
        const currentProgress = progressStore.get(id) || [];
        if (currentProgress.length > 0) {
          const progressJson = JSON.stringify(currentProgress);
          const progressData = `data: ${progressJson}\n\n`;
          controller.enqueue(encoder.encode(progressData));
          console.log(`[Progress SSE] Sent initial progress: ${currentProgress.length} events`);
        }
      } catch (error) {
        console.error(`[Progress SSE] Error sending initial messages:`, error);
        controller.error(error);
        return;
      }

      // Set up interval only for keep-alive and completion check
      const interval = setInterval(() => {
        try {
          if (controller.desiredSize === null) {
            clearInterval(interval);
            activeControllers.delete(id);
            return;
          }

          // Check if session is completed
          if (completedSessions.has(id)) {
            const completeData = `data: completed\n\n`;
            controller.enqueue(encoder.encode(completeData));
            console.log(`[Progress SSE] Session ${id} completed, closing stream`);
            controller.close();
            clearInterval(interval);
            completedSessions.delete(id);
            activeControllers.delete(id);
            return;
          }

          // Send keep-alive ping
          const keepAlive = `data: keepalive\n\n`;
          controller.enqueue(encoder.encode(keepAlive));
        } catch (error) {
          console.error(`[Progress SSE] Error in keep-alive for session ${id}:`, error);
        }
      }, 10000); // Keep-alive every 10 seconds

      // Clean up on disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`[Progress SSE] Client disconnected for session: ${id}`);
        clearInterval(interval);
        activeControllers.delete(id);
      });
    },
  });

  return new Response(stream, { headers });
}

// Helper function to add progress (imported by chat route)
export function addProgress(sessionId: string, message: string, status: 'in-progress' | 'completed') {
  // Reset progress when starting a new message (indicated by "Analyzing your question")
  if (message === 'Analyzing your question') {
    progressStore.set(sessionId, []);
    console.log(`[Progress SSE] Reset progress for new message - session: ${sessionId}`);
  }
  
  const progress = progressStore.get(sessionId) || [];
  
  // Check if this exact message already exists to avoid duplicates
  const existingIndex = progress.findIndex(p => p.message === message);
  
  if (existingIndex !== -1) {
    // Update existing progress event
    progress[existingIndex] = {
      message,
      status,
      timestamp: new Date().toISOString(),
    };
  } else {
    // Add new progress event
    progress.push({
      message,
      status,
      timestamp: new Date().toISOString(),
    });
  }
  
  progressStore.set(sessionId, progress);
  
  console.log(`[Progress SSE] ${message} (${status}) - Total events: ${progress.length}`);
  
  // Immediately push to active SSE controller if connected
  const controller = activeControllers.get(sessionId);
  if (controller) {
    try {
      const encoder = new TextEncoder();
      const progressJson = JSON.stringify(progress);
      const progressData = `data: ${progressJson}\n\n`;
      controller.enqueue(encoder.encode(progressData));
      console.log(`[Progress SSE] Pushed update immediately to session: ${sessionId}`);
    } catch (error) {
      console.error(`[Progress SSE] Error pushing to controller:`, error);
      // Controller might be closed, remove it
      activeControllers.delete(sessionId);
    }
  }
}

// Clear progress events for a session
export function clearProgress(sessionId: string) {
  progressStore.delete(sessionId);
  console.log(`[Progress SSE] Cleared progress for session ${sessionId}`);
}

// Mark session as complete to close SSE stream
export function markSessionComplete(sessionId: string) {
  completedSessions.add(sessionId);
  console.log(`[Progress SSE] Marked session ${sessionId} as complete`);
}
