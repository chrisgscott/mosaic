#!/usr/bin/env node

/**
 * Test with proposal text that should score 90-100% 
 * Uses exact language from TRANSCOM documents in the database
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
  console.log('\n🎯 Testing with Exact Database Language (Should Score 90-100%)');
  console.log(`Base URL: ${BASE_URL}\n`);

  const results = [];

  // Test 1: Coverage Check using exact language from TRANSCOM documents
  results.push(await testEndpoint(
    'Coverage Check - Exact Database Language',
    '/api/proposal/coverage-check',
    {
      proposal_text: `
STRATEGIC AIRLIFT CAPABILITIES

Strategic airlift is a national asymmetric advantage critical to global force projection at velocity; no other nation or combination of nations can provide comparable global airlift output. The strategic airlift fleet, composed of 52 C-5M, 223 C-17 aircraft, and commercial partners stands as the cornerstone of our nation's ability to project power globally. The C-5M and C-17 fleets are particularly important for the movement of outsize and oversize cargo early in a near-peer conflict, a requirement the Civil Reserve Air Fleet cannot meet. Sustaining our current fleets is a strategic imperative, and we must also pursue modernization to improve survivability in an increasingly contested environment.

Low readiness is a key concern across the airlift fleets with observed aircraft availability rates falling below programmed levels. The three most recent DoD-level mobility studies, including the FY20 National Defense Authorization Act-directed Mobility Capability Requirements Study (MCRS-20), each validated an organic strategic airlift requirement of 275 strategic airlift aircraft.

DEPLOYMENT AND DISTRIBUTION SUPPORT

We are the U.S. Transportation Command (USTRANSCOM), a warfighting command who projects and sustains combat power at any time and any place our national objectives require. Our mission is to move and maneuver the Department of Defense (DoD), the interagency, allies, and partners in peace, competition, crisis, and conflict. We fulfill this responsibility through capacity, posture, and command and control.

The Contractor shall collaborate frequently with the Command Staff and TCCs: Military Surface Deployment and Distribution Command, Military Sealift Command and Air Mobility Command (AMC). The Contractor shall interact with the MA OPR, personnel involved in relevant MARPAs, including OASD HD&H, Joint Staff J3-6, CCMDs, Military Services, DOD Agencies, USTRANSCOM staff, Transportation Component Commands (TCC), and other stakeholders. The Contractor shall provide support during real-world operations and exercises.

MISSION ASSURANCE COORDINATION

In coordination with DoD Components, we develop, publish, and annually review supplemental MA guidance for implementing and facilitating MA Construct activities across the DoD Components. This includes guidance on identification process execution, Mission Assurance Assessment (MAA) and MA self-assessment execution, risk management plan (RMP) development and coordination, and monitoring activities.

We implement and oversee the Mission Assurance Assessment Program (MAAP) in accordance with CJCS policy on MAAs. We provide guidance for execution of the MAAP, follow established periodicity criteria to designate assessment timelines, and standardize MAA activities across DoD. The Contractor shall support the MA OPR in synchronizing efforts across relevant MARPAs to identify risk, mitigation measures, offer analysis results, and recommendations to the MA OPR for senior leader consideration.

RISK ANALYSIS AND PRIORITIZATION

MAAs integrate many assessment requirements of MA-related programs and activities (MARPA) to present a more complete understanding of potential risks to missions across the DoD. MAAs consist of several elements including dependency analysis, criticality verification, hazard and threat analysis, and vulnerability assessments. The assessment results are used by mission owners for awareness of risks to capabilities that have been validated and linked to strategic missions.

The Joint Force works together to achieve a common understanding of globally integrated risk. This is accomplished primarily through JSPS processes and products. Commanders and staffs use risk analysis to provide the best military advice possible in pursuit of strategy execution. Appraising, managing, and communicating global risk lays the foundation to allocate resources, set priorities, and achieve national military objectives.
      `,
      pws_tasks: [
        {
          id: 'task-1',
          text: 'Support strategic airlift operations including C-5M and C-17 fleet sustainment and modernization'
        },
        {
          id: 'task-2',
          text: 'Provide deployment and distribution support through collaboration with Military Surface Deployment and Distribution Command, Military Sealift Command and Air Mobility Command'
        },
        {
          id: 'task-3',
          text: 'Support Mission Assurance coordination including MAAP execution and MA guidance development'
        },
        {
          id: 'task-4',
          text: 'Conduct risk analysis and prioritization using MAA processes including dependency analysis, criticality verification, hazard and threat analysis'
        }
      ]
    }
  ));

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Test Summary');
  console.log(`${'='.repeat(60)}`);
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`✅ Passed: ${passed}/${total}`);
  
  console.log('\n📊 Expected Results:');
  console.log('- Coverage scores should be 0.90-1.0 (90-100%)');
  console.log('- All tasks should have very high similarity scores (>0.85)');
  console.log('- Proposal uses exact language from database documents');
}

main().catch(console.error);
