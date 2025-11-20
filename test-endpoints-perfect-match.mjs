#!/usr/bin/env node

/**
 * Test with perfect/near-perfect matches to validate scoring
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
  console.log('\n🧪 Testing with Near-Perfect Matches (Should Score ~100%)');
  console.log(`Base URL: ${BASE_URL}\n`);

  const results = [];

  // Test 1: Coverage Check with proposal that directly addresses each task
  results.push(await testEndpoint(
    'Coverage Check - Perfect Match Test',
    '/api/proposal/coverage-check',
    {
      proposal_text: `
STRATEGIC AIRLIFT CAPABILITIES

Our approach provides comprehensive strategic airlift capabilities essential for global force projection. We understand that strategic airlift is a national asymmetric advantage critical to global force projection at velocity. Our solution leverages the strategic airlift fleet, composed of C-5M and C-17 aircraft, which stands as the cornerstone of our nation's ability to project power globally.

The C-5M and C-17 fleets are particularly important for the movement of outsize and oversize cargo early in a near-peer conflict, a requirement the Civil Reserve Air Fleet cannot meet. We recognize that sustaining our current fleets is a strategic imperative, and we are committed to pursuing modernization to improve survivability in an increasingly contested environment.

DEPLOYMENT AND DISTRIBUTION SUPPORT

Our deployment and distribution support capabilities ensure rapid and effective force projection worldwide. We provide comprehensive deployment readiness support for TRANSCOM operations, including joint logistics coordination and mobility operations. Our team has extensive experience in managing complex deployment operations across multiple theaters.

We support all aspects of deployment planning, execution, and sustainment. Our distribution network ensures timely delivery of personnel, equipment, and supplies to forward operating locations. We coordinate closely with Transportation Component Commands to ensure seamless integration of air, land, and maritime transportation assets.

MISSION ASSURANCE COORDINATION

Our Mission Assurance approach ensures continuous operations across all TRANSCOM missions. We provide 24/7 coordination support for Mission Assurance activities, including participation in Battle Rhythm Events such as the MA Working Group and VTM Working Group. Our team maintains situational awareness across USTRANSCOM, Component Commands, and partner organizations.

We conduct systematic problem identification and analysis using risk-based prioritization methods. Our analysts monitor operational challenges, review threat information, and analyze lessons learned to identify recurring patterns. We develop comprehensive courses of action with supporting rationale, implementation timelines, and resource requirements for MA OPR consideration.
      `,
      pws_tasks: [
        {
          id: 'task-1',
          text: 'Support strategic airlift operations and capabilities'
        },
        {
          id: 'task-2',
          text: 'Provide deployment and distribution support for TRANSCOM operations'
        },
        {
          id: 'task-3',
          text: 'Support Mission Assurance coordination and Battle Rhythm Events'
        },
        {
          id: 'task-4',
          text: 'Conduct problem identification and analysis with risk-based prioritization'
        }
      ]
    }
  ));

  // Test 2: Terminology with exact entity matches
  results.push(await testEndpoint(
    'Terminology - Exact Entity Matches',
    '/api/proposal/terminology',
    {
      terms: [
        { term: 'USTRANSCOM OIE' },
        { term: 'USTRANSCOM staff' },
        { term: 'strategic airlift' }
      ]
    }
  ));

  // Test 3: Context with highly relevant query
  results.push(await testEndpoint(
    'Context - Highly Relevant Query',
    '/api/proposal/context',
    {
      query: 'strategic airlift fleet C-5M C-17 aircraft global force projection',
      max_chunks: 5,
      max_entities: 3
    }
  ));

  // Test 4: Graph traversal with known entity
  results.push(await testEndpoint(
    'Graph Suggest - Known Entity',
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
  
  console.log('\n📊 Expected Results:');
  console.log('- Coverage scores should be 0.85-1.0 (85-100%)');
  console.log('- All tasks should have high-similarity matched chunks');
  console.log('- Terminology should find exact entity matches');
  console.log('- Context should return highly relevant chunks (>0.8 similarity)');
  console.log('- Graph suggest should traverse from known entity');
}

main().catch(console.error);
