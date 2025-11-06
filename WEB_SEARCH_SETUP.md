# Web Search Setup

## Overview
The web search feature allows the AI to search the internet for current information using Tavily's search API.

## Configuration

### 1. Get Tavily API Key
1. Visit https://tavily.com
2. Sign up for an account
3. Get your API key from the dashboard

### 2. Add to Environment Variables

Add to `.env.local`:
```bash
TAVILY_API_KEY=tvly-your-api-key-here
```

Or add to your deployment environment (Vercel, etc.)

## Usage

1. **Enable web search** - Toggle the "Web Search" switch in the chat header
2. **Ask a question** - The AI will automatically decide when to search the web
3. **View results** - Web search results appear as citations with a "web" source indicator

## How It Works

```
User enables toggle → AI receives web_search tool → AI decides to use it
                                                    ↓
                                            Calls /api/web-search
                                                    ↓
                                            Tavily API search
                                                    ↓
                                            Returns results as citations
                                                    ↓
                                            AI uses in response
```

## Features

- **Smart routing** - AI only uses web search when needed
- **Citation format** - Web results appear as numbered citations
- **Graceful fallback** - If Tavily fails, chat continues with document search only
- **Rate limiting** - Respects Tavily API limits

## When to Use

Web search is useful for:
- Current events and news
- Recent information not in your documents
- External references and verification
- Supplementing document knowledge

## Limitations

- Requires TAVILY_API_KEY to be configured
- Subject to Tavily API rate limits
- Basic search depth (can be configured for deeper searches)
- Results are not stored in your document library

## Cost

Tavily offers:
- **Free tier**: 1,000 searches/month
- **Pro tier**: Higher limits and advanced features

Check https://tavily.com/pricing for current pricing.
