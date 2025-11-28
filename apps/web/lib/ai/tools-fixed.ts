/**
 * Search Tools for Vercel AI SDK
 * 
 * Two tools for agentic RAG:
 * 1. search_documents - Full search with reranking (default)
 * 2. quick_search - Fast search without reranking
 * 
 * Graph search is available but off by default (enable via settings).
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { SearchResult, SearchResponse } from '@/app/api/search/route';
import { POST as searchAPI } from "@/app/api/search/route";
import { NextRequest } from "next/server";

// Tool result types
export interface SearchToolResult {
  results: SearchResult[];
  query: string;
  count: number;
  processing_time_ms: number;
  tool_used: string;
  error?: string;
}

// Helper to get session ID from global context
function getSessionId(): string | undefined {
  return (global as typeof global & { currentChatSessionId?: string }).currentChatSessionId;
}

// Helper to call search API
async function callSearchAPI(body: Record<string, unknown>): Promise<SearchResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const searchRequest = new NextRequest(`${baseUrl}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const response = await searchAPI(searchRequest);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Search failed');
  }
  return response.json();
}

/**
 * Main search tool - hybrid search with reranking
 */
export const searchDocumentsTool = tool({
  description: `Search through documents using semantic + keyword hybrid search with reranking. Use for most questions about document content.`,
  
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  
  execute: async ({ query }) => {
    console.log(`[Tool] search_documents: "${query}"`);
    
    try {
      const data = await callSearchAPI({
        query,
        session_id: getSessionId(),
        match_count: 10,
      });
      
      console.log(`[Tool] search_documents: ${data.count} results`);
      return { ...data, tool_used: 'search_documents' };
    } catch (error) {
      console.error(`[Tool] search_documents error:`, error);
      return {
        results: [],
        query,
        count: 0,
        processing_time_ms: 0,
        tool_used: 'search_documents',
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  },
});

/**
 * Quick search tool - fast search without reranking
 */
export const quickSearchTool = tool({
  description: `Fast semantic search for quick factual lookups. Skips reranking for speed.`,
  
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  
  execute: async ({ query }) => {
    console.log(`[Tool] quick_search: "${query}"`);
    
    try {
      const data = await callSearchAPI({
        query,
        session_id: getSessionId(),
        match_count: 5,
        skip_reranking: true,
        skip_graph_search: true,
      });
      
      console.log(`[Tool] quick_search: ${data.count} results`);
      return { ...data, tool_used: 'quick_search' };
    } catch (error) {
      console.error(`[Tool] quick_search error:`, error);
      return {
        results: [],
        query,
        count: 0,
        processing_time_ms: 0,
        tool_used: 'quick_search',
        error: error instanceof Error ? error.message : 'Quick search failed',
      };
    }
  },
});

/**
 * Graph search tool - for relationship queries (optional, off by default)
 */
export const graphSearchTool = tool({
  description: `Search for relationships between entities using knowledge graph. Use for questions about how concepts are connected.`,
  
  inputSchema: z.object({
    query: z.string().describe('The relationship query'),
  }),
  
  execute: async ({ query }) => {
    console.log(`[Tool] graph_search: "${query}"`);
    
    try {
      const data = await callSearchAPI({
        query,
        session_id: getSessionId(),
        match_count: 10,
        force_graph_search: true,
        graph_hops: 2,
      });
      
      console.log(`[Tool] graph_search: ${data.count} results`);
      return { ...data, tool_used: 'graph_search' };
    } catch (error) {
      console.error(`[Tool] graph_search error:`, error);
      return {
        results: [],
        query,
        count: 0,
        processing_time_ms: 0,
        tool_used: 'graph_search',
        error: error instanceof Error ? error.message : 'Graph search failed',
      };
    }
  },
});

/**
 * Web search tool using Tavily
 */
export const webSearchTool = tool({
  description: `Search the web for current information, news, or content not available in the document library. Use when the user asks about recent events, external information, or when document search returns insufficient results.`,
  
  inputSchema: z.object({
    query: z.string().describe('The search query for web search'),
    max_results: z.number().optional().default(5).describe('Maximum number of results to return (default: 5)'),
  }),
  
  execute: async ({ query, max_results = 5 }) => {
    console.log(`[Tool] web_search called with query: "${query}"`);
    
    // Get session ID from global context
    const sessionId = (global as typeof global & { currentChatSessionId?: string }).currentChatSessionId;
    
    try {
      // Add progress message
      if (sessionId) {
        const { addProgress } = await import('@/app/api/chat/[id]/progress/route');
        addProgress(sessionId, 'Searching the web', 'in-progress');
      }
      
      // Call the web search API directly (internal call, no auth needed)
      const { POST: webSearchAPI } = await import('@/app/api/web-search/route');
      
      const searchBody = JSON.stringify({
        query,
        max_results,
      });
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const searchRequest = new NextRequest(`${baseUrl}/api/web-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: searchBody,
      });

      const searchResponse = await webSearchAPI(searchRequest);

      if (!searchResponse.ok) {
        const error = await searchResponse.json();
        throw new Error(`Web search failed: ${error.error || 'Unknown error'}`);
      }

      const searchData = await searchResponse.json();
      
      console.log(`[Tool] web_search completed: ${searchData.count} results`);
      
      // Update progress with results count
      if (sessionId) {
        const { addProgress } = await import('@/app/api/chat/[id]/progress/route');
        addProgress(sessionId, `Found ${searchData.count} web sources`, 'completed');
      }
      
      return {
        ...searchData,
        tool_used: 'web_search',
      };
    } catch (error) {
      console.error(`[Tool] web_search error:`, error);
      
      // Update progress with error
      if (sessionId) {
        const { addProgress } = await import('@/app/api/chat/[id]/progress/route');
        addProgress(sessionId, 'Web search failed', 'completed');
      }
      
      return {
        results: [],
        query,
        count: 0,
        processing_time_ms: 0,
        tool_used: 'web_search',
        error: error instanceof Error ? error.message : 'Web search failed',
      };
    }
  },
});

/**
 * Core search tools (default)
 */
export const searchTools = {
  search_documents: searchDocumentsTool,
  quick_search: quickSearchTool,
} as const;

/**
 * Search tools with graph search enabled
 */
export const searchToolsWithGraph = {
  ...searchTools,
  graph_search: graphSearchTool,
} as const;

/**
 * All search tools including web search
 */
export const searchToolsWithWeb = {
  ...searchTools,
  web_search: webSearchTool,
} as const;

/**
 * Full toolset with all features
 */
export const allSearchTools = {
  ...searchTools,
  graph_search: graphSearchTool,
  web_search: webSearchTool,
} as const;
