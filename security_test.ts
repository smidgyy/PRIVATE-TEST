
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- AURORA OS SECURITY SELF-TEST ---');

  // Helper to get a session
  const session = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
  });

  // Initial request to get a session cookie
  console.log('\nInitializing session...');
  const initRes = await session.post('/api/init');
  const cookie = initRes.headers['set-cookie'];
  console.log('Session initialized. Cookie received.');

  // --- TEST 1: DIRECT API MANIPULATION ---
  console.log('\n--- TEST 1: DIRECT API MANIPULATION ---');
  
  const test1Payloads = [
    { type: "set_state", stage4_complete: true },
    { type: "update_stage4_progress", step: 10 },
    { type: "complete_game" },
    { type: "node02_answer", step: 3, override: true, input: "test" }
  ];

  for (const payload of test1Payloads) {
    try {
      const res = await session.post('/api/validateCommand', payload);
      console.log(`Payload ${JSON.stringify(payload)}: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
    } catch (err) {
      console.log(`Payload ${JSON.stringify(payload)}: HTTP ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
    }
  }

  // --- TEST 2: PROGRESSION SKIP ---
  console.log('\n--- TEST 2: PROGRESSION SKIP ---');
  
  const test2Payloads = [
    { type: "terminal", input: "decode_vale_archive" }, // Stage 4 command
    { type: "unlock_node03_secret" } // Stage 3 command
  ];

  for (const payload of test2Payloads) {
    try {
      const res = await session.post('/api/validateCommand', payload);
      console.log(`Payload ${JSON.stringify(payload)}: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
    } catch (err) {
      console.log(`Payload ${JSON.stringify(payload)}: HTTP ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
    }
  }

  // --- TEST 3: CONTENT ACCESS BYPASS ---
  console.log('\n--- TEST 3: CONTENT ACCESS BYPASS ---');
  
  const test3Targets = ['forum', 'node04', 'observer-log-01'];

  for (const target of test3Targets) {
    try {
      const res = await session.post('/api/getContent', { target });
      console.log(`Target ${target}: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
    } catch (err) {
      console.log(`Target ${target}: HTTP ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
    }
  }

  // --- TEST 4: DIRECT PAGE ACCESS ---
  console.log('\n--- TEST 4: DIRECT PAGE ACCESS ---');
  
  const test4Pages = ['/node04.html', '/node03/secret.html', '/article.html'];

  for (const page of test4Pages) {
    try {
      const res = await session.get(page);
      const isLocked = res.data.includes('ACCESS RESTRICTED');
      console.log(`Page ${page}: HTTP ${res.status} - Locked: ${isLocked}`);
    } catch (err) {
      console.log(`Page ${page}: HTTP ${err.response?.status}`);
    }
  }

  // --- TEST 5: SESSION BYPASS ---
  console.log('\n--- TEST 5: SESSION BYPASS ---');
  
  try {
    const res = await axios.post(`${BASE_URL}/api/userState`);
    console.log(`Request without cookie: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
  } catch (err) {
    console.log(`Request without cookie: HTTP ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
  }

  // --- TEST 6: PARAMETER POLLUTION ---
  console.log('\n--- TEST 6: PARAMETER POLLUTION ---');
  
  try {
    // Duplicate parameters (if using query, but here we use body)
    // For body, we can try extra fields
    const res = await session.post('/api/validateCommand', { 
      type: "terminal", 
      input: "help",
      force: true,
      override: "admin",
      stage: 4
    });
    console.log(`Extra fields: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
  } catch (err) {
    console.log(`Extra fields: HTTP ${err.response?.status}`);
  }

  // --- TEST 7: SCRIPTED REQUEST SIMULATION ---
  console.log('\n--- TEST 7: SCRIPTED REQUEST SIMULATION ---');
  
  console.log('Sending 10 rapid requests to /api/validateCommand...');
  const requests = Array(10).fill(0).map(() => session.post('/api/validateCommand', { type: "terminal", input: "help" }));
  const results = await Promise.allSettled(requests);
  const statuses = results.map(r => r.status === 'fulfilled' ? r.value.status : r.reason.response?.status);
  console.log(`Statuses: ${statuses.join(', ')}`);

  // --- TEST 8: GATED API ACCESS ---
  console.log('\n--- TEST 8: GATED API ACCESS ---');
  
  try {
    const res = await session.get('/api/getArticle');
    console.log(`GET /api/getArticle: HTTP ${res.status}`);
  } catch (err) {
    console.log(`GET /api/getArticle: HTTP ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
  }

  try {
    const res = await session.get('/api/getNode02');
    console.log(`GET /api/getNode02: HTTP ${res.status}`);
  } catch (err) {
    console.log(`GET /api/getNode02: HTTP ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
  }

}

runTests().catch(console.error);
