/**
 * Search Tools for Vercel AI SDK
 * 
 * Converts the RAG pipeline from always-on sequential execution
 * to tool-based approach where AI decides when and which search techniques to use.
 * 
 * Architecture: Hybrid approach with one main comprehensive tool + specialized tools
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
 * Main comprehensive search tool - handles 90% of queries
 * 
 * Runs full pipeline based on current settings:
 * - Multi-query generation (if enabled)
 * - Graph-enhanced search (if relationship query detected)
 * - Reranking (if enabled)
 * 
 * This is the default choice for most queries.
 */
export const searchDocumentsTool = tool({
  description: `Comprehensive search through documents using multiple advanced techniques.
  
  USE THIS FOR:
  - Most questions about document content
  - Complex queries requiring deep understanding
  - When you need the most thorough search results
  - Relationship queries (how X relates to Y)
  - Queries that may benefit from multiple search techniques
  
  TECHNIQUES USED:
  - Multi-query generation (3 variations) for better coverage
  - Hybrid semantic + BM25 search
  - Graph-enhanced search for relationship queries
  - Cohere reranking for best results
  
  This tool automatically adapts based on query complexity and system settings.`,
  
  parameters: z.object({
    query: z.string().describe('The search query to find relevant documents'),
  }),
  
  // @ts-ignore - AI SDK v5 type definitions have issues
  execute: async ({ query }) => {
    console.log(`[Tool] search_documents called with query: "${query}"`);
    
    try {
      // Create search request using existing search API
      const searchBody = JSON.stringify({
        query,
        match_threshold: 0.5,
        match_count: 10,
        graph_hops: 1,
      });
      
      // Create request for the search API (use relative URL for environment independence)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const searchRequest = new NextRequest(`${baseUrl}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: searchBody,
      });

      // Call the existing search API
      const searchResponse = await searchAPI(searchRequest);

      if (!searchResponse.ok) {
        const error = await searchResponse.json();
        throw new Error(`Search failed: ${error.message}`);
      }

      const searchData: SearchResponse = await searchResponse.json();
      
      console.log(`[Tool] search_documents completed: ${searchData.count} results in ${searchData.processing_time_ms}ms`);
      
      return {
        ...searchData,
        tool_used: 'search_documents',
      };
    } catch (error) {
      console.error(`[Tool] search_documents error:`, error);
      // Return empty results instead of throwing to allow graceful degradation
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
 * Quick semantic-only search tool
 * 
 * Skip expensive operations for fast results:
 * - No multi-query generation
 * - No graph search
 * - No reranking (unless system settings require it)
 * 
 * Use for simple factual lookups when speed is important.
 */
export const quickSearchTool = tool({
  description: `Fast semantic search through documents for quick factual lookups.
  
  USE THIS FOR:
  - Simple factual questions (what is X, when did Y happen)
  - Definitions and terminology
  - Quick lookups where speed is important
  - Queries that don't need complex analysis
  - Testing if information exists in documents
  
  TECHNIQUES USED:
  - Direct semantic search (no query variations)
  - BM25 keyword search
  - Minimal processing for fastest response
  
  AVOID THIS FOR:
  - Complex relationship queries
  - Questions requiring deep analysis
  - When you need comprehensive results`,
  
  parameters: z.object({
    query: z.string().describe('The search query for quick lookup'),
  }),
  
  execute: async ({ query }: { query: string }) => {
    console.log(`[Tool] quick_search called with query: "${query}"`);
    
    try {
      // Create search request with minimal processing
      const searchBody = JSON.stringify({
        query,
        match_threshold: 0.5,
        match_count: 10,
        graph_hops: 1,
        // Override settings to skip expensive operations
        skip_multi_query: true,
        skip_graph_search: true,
        skip_reranking: true,
      });
      
      // Create request for the search API (use relative URL for environment independence)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const searchRequest = new NextRequest(`${baseUrl}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: searchBody,
      });

      // Call the existing search API
      const searchResponse = await searchAPI(searchRequest);

      if (!searchResponse.ok) {
        const error = await searchResponse.json();
        throw new Error(`Quick search failed: ${error.message}`);
      }

      const searchData: SearchResponse = await searchResponse.json();
      
      console.log(`[Tool] quick_search completed: ${searchData.count} results in ${searchData.processing_time_ms}ms`);
      
      return {
        ...searchData,
        tool_used: 'quick_search',
      };
    } catch (error) {
      console.error(`[Tool] quick_search error:`, error);
      // Return empty results instead of throwing to allow graceful degradation
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
 * Deep graph search tool for relationship-focused queries
 * 
 * Extended graph traversal for complex relationship exploration:
 * - Multi-hop graph traversal (2+ hops)
 * - Entity-centric search
 * - Relationship path discovery
 * 
 * Use for complex "how is X related to Y" type queries.
 */
export const deepGraphSearchTool = tool({
  description: `Deep graph search for complex relationship queries and entity exploration.
  
  USE THIS FOR:
  - Complex relationship queries (how is X related to Y through Z)
  - Finding connection paths between entities
  - Exploring entity networks and relationships
  - Questions requiring multi-hop reasoning
  - When you need to understand complex relationships
  
  TECHNIQUES USED:
  - Extended graph traversal (2+ hops)
  - Entity-centric search and expansion
  - Relationship path discovery
  - Graph-enhanced contextual search
  
  EXAMPLES:
  - "How is Company A connected to Company B?"
  - "What is the relationship between these people?"
  - "Show me the connection path between X and Y"
  
  AVOID THIS FOR:
  - Simple factual questions
  - Non-relationship queries
  - When speed is more important than depth`,
  
  parameters: z.object({
    query: z.string().describe('The relationship query to explore'),
    max_hops: z.number().optional().default(3).describe('Maximum graph hops to explore (default: 3)'),
  }),
  
  execute: async ({ query, max_hops }) => {
    console.log(`[Tool] deep_graph_search called with query: "${query}", max_hops: ${max_hops}`);
    
    try {
      // Create search request with extended graph traversal
      const searchBody = JSON.stringify({
        query,
        match_threshold: 0.5,
        match_count: 10,
        graph_hops: max_hops,
        // Force graph search and extended traversal
        force_graph_search: true,
        extended_graph_traversal: true,
      });
      
      // Create request for the search API (use relative URL for environment independence)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const searchRequest = new NextRequest(`${baseUrl}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: searchBody,
      });

      // Call the existing search API
      const searchResponse = await searchAPI(searchRequest);

      if (!searchResponse.ok) {
        const error = await searchResponse.json();
        throw new Error(`Deep graph search failed: ${error.message}`);
      }

      const searchData: SearchResponse = await searchResponse.json();
      
      console.log(`[Tool] deep_graph_search completed: ${searchData.count} results in ${searchData.processing_time_ms}ms`);
      
      return {
        ...searchData,
        tool_used: 'deep_graph_search',
      };
    } catch (error) {
      console.error(`[Tool] deep_graph_search error:`, error);
      // Return empty results instead of throwing to allow graceful degradation
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
 * Export all tools for registration with AI SDK
 */
export const searchTools = {
  search_documents: searchDocumentsTool,
  quick_search: quickSearchTool,
  deep_graph_search: deepGraphSearchTool,
} as const;

/**
 * Tool selection guidance for system prompt
 */
export const TOOL_GUIDANCE = {
  search_documents: {
    use_case: "Default comprehensive search for most queries",
    techniques: ["Multi-query", "Hybrid search", "Graph search", "Reranking"],
    when_to_use: [
      "Most questions about document content",
      "Complex queries requiring deep understanding", 
      "Relationship queries",
      "When you need thorough results"
    ],
  },
  quick_search: {
    use_case: "Fast semantic-only search for simple lookups",
    techniques: ["Semantic search", "BM25"],
    when_to_use: [
      "Simple factual questions",
      "Definitions and terminology",
      "Quick lookups where speed matters",
      "Testing if information exists"
    ],
  },
  deep_graph_search: {
    use_case: "Extended graph traversal for complex relationships",
    techniques: ["Multi-hop graph search", "Entity expansion", "Relationship paths"],
    when_to_use: [
      "Complex relationship queries",
      "Multi-hop connection discovery",
      "Entity network exploration",
      "When relationships are central to the query"
    ],
  },
};
