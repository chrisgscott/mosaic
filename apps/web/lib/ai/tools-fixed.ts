/**
 * Search Tools for Vercel AI SDK - Fixed Version
 * 
 * Using inputSchema (AI SDK v5) instead of parameters
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
  error?: string; // Optional error message for graceful degradation
}

/**
 * Main comprehensive search tool
 */
export const searchDocumentsTool = tool({
  description: `Comprehensive search through documents using multiple advanced techniques. Use for most questions about document content.`,
  
  inputSchema: z.object({
    query: z.string().describe('The search query to find relevant documents'),
  }),
  
  execute: async ({ query }) => {
    console.log(`[Tool] search_documents called with query: "${query}"`);
    
    // Get session ID from global context
    const sessionId = (global as typeof global & { currentChatSessionId?: string }).currentChatSessionId;
    
    try {
      const searchBody = JSON.stringify({
        query,
        session_id: sessionId,
        match_threshold: 0.5,
        match_count: 10,
        graph_hops: 1,
      });
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const searchRequest = new NextRequest(`${baseUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: searchBody,
      });

      const searchResponse = await searchAPI(searchRequest);

      if (!searchResponse.ok) {
        const error = await searchResponse.json();
        throw new Error(`Search failed: ${error.message}`);
      }

      const searchData: SearchResponse = await searchResponse.json();
      
      console.log(`[Tool] search_documents completed: ${searchData.count} results`);
      
      return {
        ...searchData,
        tool_used: 'search_documents',
      };
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
 * Quick search tool
 */
export const quickSearchTool = tool({
  description: `Fast semantic search for quick factual lookups. Use for simple questions and definitions.`,
  
  inputSchema: z.object({
    query: z.string().describe('The search query for quick lookup'),
  }),
  
  execute: async ({ query }) => {
    console.log(`[Tool] quick_search called with query: "${query}"`);
    
    // Get session ID from global context
    const sessionId = (global as typeof global & { currentChatSessionId?: string }).currentChatSessionId;
    
    try {
      const searchBody = JSON.stringify({
        query,
        session_id: sessionId,
        match_threshold: 0.5,
        match_count: 10,
        graph_hops: 1,
        skip_multi_query: true,
        skip_graph_search: true,
        skip_reranking: true,
      });
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const searchRequest = new NextRequest(`${baseUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: searchBody,
      });

      const searchResponse = await searchAPI(searchRequest);

      if (!searchResponse.ok) {
        const error = await searchResponse.json();
        throw new Error(`Quick search failed: ${error.message}`);
      }

      const searchData: SearchResponse = await searchResponse.json();
      
      console.log(`[Tool] quick_search completed: ${searchData.count} results`);
      
      return {
        ...searchData,
        tool_used: 'quick_search',
      };
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
 * Deep graph search tool
 */
export const deepGraphSearchTool = tool({
  description: `Deep graph search for complex relationship queries. Use for questions about how entities are related.`,
  
  inputSchema: z.object({
    query: z.string().describe('The relationship query to explore'),
    max_hops: z.number().optional().default(3).describe('Maximum graph hops to explore (default: 3)'),
  }),
  
  execute: async ({ query, max_hops = 3 }) => {
    console.log(`[Tool] deep_graph_search called with query: "${query}", max_hops: ${max_hops}`);
    
    // Get session ID from global context
    const sessionId = (global as typeof global & { currentChatSessionId?: string }).currentChatSessionId;
    
    try {
      const searchBody = JSON.stringify({
        query,
        session_id: sessionId,
        match_threshold: 0.5,
        match_count: 10,
        graph_hops: max_hops,
        force_graph_search: true,
        extended_graph_traversal: true,
      });
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const searchRequest = new NextRequest(`${baseUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: searchBody,
      });

      const searchResponse = await searchAPI(searchRequest);

      if (!searchResponse.ok) {
        const error = await searchResponse.json();
        throw new Error(`Deep graph search failed: ${error.message}`);
      }

      const searchData: SearchResponse = await searchResponse.json();
      
      console.log(`[Tool] deep_graph_search completed: ${searchData.count} results`);
      
      return {
        ...searchData,
        tool_used: 'deep_graph_search',
      };
    } catch (error) {
      console.error(`[Tool] deep_graph_search error:`, error);
      return {
        results: [],
        query,
        count: 0,
        processing_time_ms: 0,
        tool_used: 'deep_graph_search',
        error: error instanceof Error ? error.message : 'Deep graph search failed',
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
 * Export all tools for registration with AI SDK
 */
export const searchTools = {
  search_documents: searchDocumentsTool,
  quick_search: quickSearchTool,
  deep_graph_search: deepGraphSearchTool,
} as const;

/**
 * Export tools with web search enabled
 */
export const searchToolsWithWeb = {
  ...searchTools,
  web_search: webSearchTool,
} as const;
