import { NextRequest, NextResponse } from 'next/server';

/**
 * Web Search API - Tavily Search Integration
 * 
 * This endpoint calls the Tavily API to perform web searches.
 * Requires TAVILY_API_KEY environment variable.
 */

export async function POST(request: NextRequest) {
  try {
    const { query, max_results = 5 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.error('[WebSearch] TAVILY_API_KEY not configured');
      return NextResponse.json(
        { error: 'Web search not configured' },
        { status: 503 }
      );
    }

    console.log(`[WebSearch] Searching for: "${query}"`);

    // Call Tavily API
    const tavilyResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!tavilyResponse.ok) {
      const error = await tavilyResponse.text();
      console.error('[WebSearch] Tavily API error:', error);
      return NextResponse.json(
        { error: 'Web search failed' },
        { status: tavilyResponse.status }
      );
    }

    const data = await tavilyResponse.json();
    
    // Transform Tavily results to our format
    const results = (data.results || []).map((result: {
      title: string;
      url: string;
      content: string;
      score: number;
    }, index: number) => ({
      number: (index + 1).toString(),
      title: result.title,
      url: result.url,
      description: result.content,
      quote: result.content.substring(0, 200) + '...',
      score: result.score,
      source: 'web',
    }));

    console.log(`[WebSearch] Found ${results.length} results`);

    return NextResponse.json({
      results,
      query,
      count: results.length,
      processing_time_ms: 0,
    });
  } catch (error) {
    console.error('[WebSearch] Error:', error);
    return NextResponse.json(
      { error: 'Web search failed' },
      { status: 500 }
    );
  }
}
