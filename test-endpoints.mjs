#!/usr/bin/env node

/**
 * Test script for Proposal API endpoints
 * Uses Supabase service role key for authentication
 */

const BASE_URL = 'http://localhost:3000';
const API_KEY = '92fe319d3b739aa7904e9659534e8cf0f3afd9286650ba53abb470a0d652a87c';

async function testEndpoint(name, path, body) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify(body),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const text = await response.text();
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      console.log('Response:');
      console.log(JSON.stringify(data, null, 2));
    } catch {
      console.log('Raw response:', text);
    }
    
    return response.ok;
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('\n🧪 Testing Proposal API Endpoints');
  console.log(`Base URL: ${BASE_URL}\n`);

  const results = [];

  // Test 1: Coverage Check
  results.push(await testEndpoint(
    'Coverage Check',
    '/api/proposal/coverage-check',
    {
      proposal_text: 'We provide comprehensive logistics support with 24/7 coordination and real-time tracking capabilities for all transportation needs.',
      pws_tasks: [
        {
          id: 'task-1',
          text: 'Provide 24/7 logistics coordination'
        },
        {
          id: 'task-2',
          text: 'Implement real-time tracking system'
        }
      ]
    }
  ));

  // Test 2: Terminology
  results.push(await testEndpoint(
    'Terminology Validation',
    '/api/proposal/terminology',
    {
      terms: [
        { term: 'logistics' },
        { term: 'TRANSCOM' },
        { term: 'coordination' }
      ]
    }
  ));

  // Test 3: Context
  results.push(await testEndpoint(
    'Context Retrieval',
    '/api/proposal/context',
    {
      query: 'What are the requirements for logistics support?',
      max_chunks: 5,
      max_entities: 3
    }
  ));

  // Test 4: Graph Suggest (may fail if entity doesn't exist)
  results.push(await testEndpoint(
    'Graph Suggest',
    '/api/proposal/graph-suggest',
    {
      entity_name: 'logistics',
      max_depth: 2
    }
  ));

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Test Summary');
  console.log(`${'='.repeat(60)}`);
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed (this may be expected if no data exists yet)');
  }
}

runTests().catch(console.error);
