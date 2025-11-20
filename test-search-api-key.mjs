#!/usr/bin/env node

/**
 * Test /api/search with API key authentication
 */

const BASE_URL = 'http://localhost:3000';
const API_KEY = '92fe319d3b739aa7904e9659534e8cf0f3afd9286650ba53abb470a0d652a87c';

async function testSearch() {
  console.log('\n🔍 Testing /api/search with API Key Authentication\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        query: 'What are TRANSCOM strategic airlift requirements?',
        match_count: 5,
        use_reranking: true,
        use_hyde: false,
        use_multi_query: false,
      }),
    });

    console.log(`Status: ${response.status} ${response.statusText}\n`);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!\n');
      console.log(`Query: ${data.query}`);
      console.log(`Results: ${data.count}`);
      console.log(`Processing time: ${data.processing_time_ms}ms\n`);
      
      console.log('Top 3 Results:');
      data.results.slice(0, 3).forEach((result, i) => {
        console.log(`\n${i + 1}. Score: ${result.rerank_score?.toFixed(3) || result.similarity?.toFixed(3)}`);
        console.log(`   Doc: ${result.document_name}`);
        console.log(`   Preview: ${result.content.substring(0, 100)}...`);
      });
    } else {
      console.log('❌ Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testSearch();
