import { useEffect, useState, useCallback } from 'react';
import type { ProgressEvent } from '@/app/api/chat/route';

export function useProgressStream(sessionId: string | null) {
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const eventSource = new EventSource(`/api/chat/${sessionId}/progress`);
    
    eventSource.onopen = () => {
      setIsConnected(true);
      console.log('[Progress SSE] Connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const message = event.data.trim();
        console.log('[Progress SSE] Received message:', message);
        
        if (message === 'ping') {
          console.log('[Progress SSE] Received ping');
        } else if (message === 'keepalive') {
          console.log('[Progress SSE] Received keepalive');
        } else if (message === 'completed') {
          console.log('[Progress SSE] Received completion signal, closing connection');
          setIsConnected(false);
          eventSource.close();
        } else {
          // Try to parse as progress JSON
          const progress = JSON.parse(message);
          setProgress(progress);
          console.log('[Progress SSE] Received progress:', progress);
        }
      } catch (error) {
        console.error('[Progress SSE] Error parsing message:', error);
        console.error('[Progress SSE] Raw message:', event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[Progress SSE] Error:', error);
      console.error('[Progress SSE] EventSource readyState:', eventSource.readyState);
      console.error('[Progress SSE] EventSource URL:', eventSource.url);
      
      // Only close if it's a critical error (readyState = 2)
      if (eventSource.readyState === EventSource.CLOSED) {
        setIsConnected(false);
        console.log('[Progress SSE] Stream closed, will not reconnect');
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.log('[Progress SSE] Still connecting, will retry...');
      } else {
        setIsConnected(false);
        console.log('[Progress SSE] Connection lost, keeping open for potential reconnect');
      }
    };

    return eventSource;
  }, [sessionId]);

  useEffect(() => {
    const eventSource = connect();
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [connect]);

  const clearProgress = useCallback(() => {
    setProgress([]);
  }, []);

  return {
    progress,
    isConnected,
    clearProgress,
  };
}
