import { NextRequest } from 'next/server';

// In-memory progress storage (for real-time streaming)
const progressStore = new Map<string, Array<{
  message: string;
  status: 'in-progress' | 'completed';
  timestamp: string;
}>>();

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
      
      try {
        // Send simple ping message first
        const pingData = `data: ping\n\n`;
        controller.enqueue(encoder.encode(pingData));
        console.log(`[Progress SSE] Sent ping message for session: ${id}`);
      } catch (error) {
        console.error(`[Progress SSE] Error sending ping message:`, error);
        controller.error(error);
        return;
      }

      // Set up interval to send keep-alive messages
      const interval = setInterval(() => {
        try {
          if (controller.desiredSize === null) {
            // Stream is closed, stop interval
            clearInterval(interval);
            return;
          }

          // Check if session is completed - close stream if so
          if (completedSessions.has(id)) {
            const completeData = `data: completed\n\n`;
            controller.enqueue(encoder.encode(completeData));
            console.log(`[Progress SSE] Session ${id} completed, closing stream`);
            controller.close();
            clearInterval(interval);
            completedSessions.delete(id);
            return;
          }

          const progress = progressStore.get(id) || [];
          if (progress.length > 0) {
            const progressJson = JSON.stringify(progress);
            const progressData = `data: ${progressJson}\n\n`;
            controller.enqueue(encoder.encode(progressData));
            console.log(`[Progress SSE] Sent progress data for session: ${id}, events: ${progress.length}`);
          } else {
            // Send keep-alive
            const keepAlive = `data: keepalive\n\n`;
            controller.enqueue(encoder.encode(keepAlive));
          }
        } catch (error) {
          console.error(`[Progress SSE] Error in interval for session ${id}:`, error);
          // Don't close the stream on error, just log it
        }
      }, 2000); // Check every 2 seconds

      // Clean up on disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`[Progress SSE] Client disconnected for session: ${id}`);
        clearInterval(interval);
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
