#!/usr/bin/env node

/**
 * Realistic test using actual TRANSCOM proposal drafts
 */

import { readFileSync } from 'fs';

const BASE_URL = 'http://localhost:3000';
const API_KEY = '92fe319d3b739aa7904e9659534e8cf0f3afd9286650ba53abb470a0d652a87c';

// Read actual proposal draft
const proposalText = readFileSync('/Users/chrisgscott/projects/proposal_tool/examples/subfactor1_draft.txt', 'utf-8');

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
    
    try {
      const data = JSON.parse(text);
      console.log('Response:');
      console.log(JSON.stringify(data, null, 2));
      return response.ok;
    } catch (e) {
      console.log('Raw response (not JSON):');
      console.log(text.substring(0, 500));
      return false;
    }
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('\n🧪 Testing Proposal API with Real TRANSCOM Data');
  console.log(`Base URL: ${BASE_URL}\n`);

  const results = [];

  // Test 1: Coverage Check with real proposal and PWS tasks
  results.push(await testEndpoint(
    'Coverage Check - Real Proposal vs PWS Tasks',
    '/api/proposal/coverage-check',
    {
      proposal_text: proposalText,
      pws_tasks: [
        {
          id: '1.3.1.4.1',
          text: 'The Contractor shall provide meeting summaries of actions taken in support of this subtask to the MA OPR'
        },
        {
          id: '1.3.3.2',
          text: 'Support synchronization of multiple complex program activities across TRANSCOM Mission Assurance functions'
        },
        {
          id: '1.3.4.1',
          text: 'Conduct problem identification and analysis using systematic approaches including stakeholder engagement and risk-based prioritization'
        },
        {
          id: '1.3.5.1',
          text: 'Develop courses of action with supporting rationale, implementation timelines, and resource requirements'
        }
      ]
    }
  ));

  // Test 2: Terminology validation with terms from the proposal
  results.push(await testEndpoint(
    'Terminology - Terms from Proposal',
    '/api/proposal/terminology',
    {
      terms: [
        { term: 'RIOS' },
        { term: 'Mission Assurance' },
        { term: 'USTRANSCOM' },
        { term: 'C-sUAS' },
        { term: 'Fourth Component' }
      ]
    }
  ));

  // Test 3: Context retrieval for proposal writing
  results.push(await testEndpoint(
    'Context - Get relevant background for proposal section',
    '/api/proposal/context',
    {
      query: 'What are TRANSCOM Mission Assurance program requirements and battle rhythm events?',
      max_chunks: 10,
      max_entities: 5
    }
  ));

  // Test 4: Graph traversal for related concepts
  results.push(await testEndpoint(
    'Graph Suggest - Find related MA concepts',
    '/api/proposal/graph-suggest',
    {
      entity_name: 'USTRANSCOM OIE',
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
  if (passed < total) {
    console.log(`❌ Failed: ${total - passed}/${total}`);
  }
}

main().catch(console.error);
