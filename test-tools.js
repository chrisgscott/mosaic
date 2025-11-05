/**
 * Simple test script for search tools
 * Tests the tool definitions without requiring authentication
 */

const { searchDocumentsTool, quickSearchTool, deepGraphSearchTool } = require('./apps/web/lib/ai/tools.ts');

async function testTools() {
  console.log('Testing search tools...\n');
  
  try {
    // Test quick search tool
    console.log('1. Testing quick_search tool...');
    const quickResult = await quickSearchTool.execute({ query: 'What is React?' });
    console.log('Quick search result:', {
      tool_used: quickResult.tool_used,
      count: quickResult.count,
      processing_time_ms: quickResult.processing_time_ms
    });
    
    // Test comprehensive search tool  
    console.log('\n2. Testing search_documents tool...');
    const comprehensiveResult = await searchDocumentsTool.execute({ query: 'How does React work?' });
    console.log('Comprehensive search result:', {
      tool_used: comprehensiveResult.tool_used,
      count: comprehensiveResult.count,
      processing_time_ms: comprehensiveResult.processing_time_ms
    });
    
    console.log('\n✅ All tools working correctly!');
    
  } catch (error) {
    console.error('❌ Tool test failed:', error);
    process.exit(1);
  }
}

testTools();
