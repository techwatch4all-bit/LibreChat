/**
 * Satchida Fleet Ops E2E Verification Script
 */
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CP_URL = 'http://127.0.0.1:8443';
const TEST_FILE = 'd:/LAN-AI-Infra/ops-scripts/test_patch_file.txt';

async function runTest() {
  console.log('1. Starting Control Plane process...');
  const cpProc = spawn('node', ['d:/LAN-AI-Infra/ops-scripts/control-plane.mjs'], {
    stdio: 'inherit',
    windowsHide: true,
  });

  await sleep(4000);

  try {
    // A. Check Initial Status
    console.log('2. Querying initial fleet status...');
    const st0 = await fetch(`${CP_URL}/api/v1/fleet/status`).then(r => r.json());
    console.log('Initial summary:', st0.summary);

    // B. Push Telemetry Incident
    console.log('3. Ingesting error telemetry from school-delhi-01...');
    const incidentPayload = {
      tenantId: 'school-delhi-01',
      incident: {
        errorType: 'tool_not_found',
        fingerprint: 'fp_e2e_verified_01',
        count: 5,
        message: 'Tool get_verified_market_rates not found',
        detail: { persona: 'Chat', query: 'Get SGD INR exchange rate' }
      }
    };

    const incRes = await fetch(`${CP_URL}/api/v1/fleet/incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incidentPayload)
    }).then(r => r.json());

    console.log('Incident ingested successfully:', incRes.ok);
    console.log('AI Analysis Title:', incRes.incident?.aiAnalysis?.plainEnglishTitle);
    console.log('AI Safety Level:', incRes.incident?.aiAnalysis?.safetyLevel);

    // C. Create test file to be patched
    writeFileSync(TEST_FILE, 'BASE_CONFIGURATION_LINE=original_value\n', 'utf8');
    console.log('4. Created test target file:', TEST_FILE);

    // D. Operator clicks "Deploy Fix"
    console.log('5. Operator dispatches patch via Control Plane...');
    const deployPayload = {
      fingerprint: 'fp_e2e_verified_01',
      targetTenant: 'school-delhi-01',
      customPatch: {
        targetFile: TEST_FILE,
        targetString: 'original_value',
        replacementString: 'patched_and_verified_value',
        verifyCommand: `node -e "if(!require('fs').readFileSync('${TEST_FILE.replace(/\\/g, '/')}','utf8').includes('patched_and_verified_value'))process.exit(1)"`
      }
    };

    const depRes = await fetch(`${CP_URL}/api/v1/fleet/deploy-patch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deployPayload)
    }).then(r => r.json());

    console.log('Patch queued with Task ID:', depRes.taskId);

    // E. Start Tenant Fleet Sync Agent
    console.log('6. Starting Tenant Fleet Sync Agent...');
    const agentProc = spawn('node', ['d:/LAN-AI-Infra/ops-scripts/fleet-sync-agent.mjs'], {
      env: { ...process.env, CONTROL_PLANE_URL: CP_URL, TENANT_ID: 'school-delhi-01' },
      stdio: 'inherit',
      windowsHide: true,
    });

    await sleep(6000);

    // F. Verify File was Patched
    const patchedContent = readFileSync(TEST_FILE, 'utf8');
    console.log('7. Patched File Content:', patchedContent.trim());
    const isPatched = patchedContent.includes('patched_and_verified_value');
    console.log('>>> PATCH VERIFIED ON DISK:', isPatched);

    // G. Verify Final Status on Control Plane
    const finalSt = await fetch(`${CP_URL}/api/v1/fleet/status`).then(r => r.json());
    console.log('8. Final Fleet Summary:', finalSt.summary);
    const resolvedIncident = finalSt.incidents.find(i => i.fingerprint === 'fp_e2e_verified_01');
    console.log('>>> INCIDENT RESOLVED STATE:', resolvedIncident?.status);

    agentProc.kill();
  } finally {
    cpProc.kill();
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
  }
}

runTest().catch(console.error);
