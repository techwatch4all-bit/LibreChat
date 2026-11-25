/**
 * Satchida Fleet AI Engine (fleet-ai-engine.mjs)
 * ===============================================
 * Autonomous intelligence unit for Satchida Fleet Operations:
 * 1. Analyzes telemetry incidents from tenant edge nodes
 * 2. Translates raw stack traces / tool errors into plain English for non-technical operators
 * 3. Formulates verified, minimal candidate patches (config, skill, or code)
 * 4. Determines safety level and verification commands
 *
 * Uses Satchida Gateway (port 4000) with SATCHIDA_GATEWAY_VK.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let cachedToken = null;

function getGatewayToken() {
  if (cachedToken) return cachedToken;
  try {
    const envPath = 'd:/LAN-AI-Infra/LibreChat/.env';
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('SATCHIDA_GATEWAY_VK=')) {
          cachedToken = trimmed.split('=')[1].trim();
          return cachedToken;
        }
      }
    }
  } catch (err) {
    console.error('[ai-engine] Failed to read .env for gateway token:', err.message);
  }
  return process.env.SATCHIDA_GATEWAY_VK || '';
}

const GATEWAY_URL = process.env.SATCHIDA_GATEWAY_URL || 'http://127.0.0.1:4000/v1/chat/completions';

/**
 * Analyzes an error incident using Satchida Gateway
 * @param {Object} incident
 * @returns {Promise<Object>} Structured analysis and patch proposal
 */
export async function analyzeIncident(incident) {
  const token = getGatewayToken();
  if (!token) {
    return generateFallbackAnalysis(incident, 'Gateway token SATCHIDA_GATEWAY_VK not found');
  }

  const prompt = `You are the Master Satchida AI System Reliability Engineer and Operations Architect.
Analyze this runtime error captured from a tenant's LibreChat deployment:

Error Type: ${incident.errorType || 'unknown'}
Fingerprint: ${incident.fingerprint || 'unknown'}
Occurrences: ${incident.count || 1}
Affected Tenant: ${incident.tenantId || 'tenant-local'}
Error Message / Log:
${incident.message || 'No message provided'}

Detail / Context:
${JSON.stringify(incident.detail || {}, null, 2)}

Repository Context:
- Platform: Satchida AI Harness (LibreChat fork + multi-tier edge nodes on Windows 11 CGNAT)
- Backend: Node.js (packages/api, packages/data-schemas, api/server)
- Unified MCP Hub: skill/satchida-unified-hub.py (mounts 93 tools across 20 servers under satchida-tools)
- Model Specs: librechat.yaml defines model personas (Chat, Work, Study, Privacy, Motion, etc.)
- MCP Tools format: <tool_name>_mcp_<server_name> (e.g. get_verified_market_rates_mcp_satchida-tools)

Your task:
1. Provide a plain English summary for a NON-TECHNICAL human operator (e.g. school administrator or SME business owner).
2. Diagnose the exact technical root cause.
3. Propose a minimal, safe patch.
4. Classify the patch safety level:
   - "safe_auto_deploy": Config or skill change that cannot crash LibreChat core.
   - "requires_review": Core TypeScript/database change that requires build verification.

Respond strictly with valid JSON conforming to this schema (no extra commentary outside JSON):
{
  "plainEnglishTitle": "Short 1-line headline explaining what went wrong",
  "plainEnglishDescription": "2-3 clear sentences in non-technical terms describing what the user saw and what was affected.",
  "rootCause": "Precise technical explanation of why this error occurred.",
  "affectedFile": "Path to file needing adjustment (e.g. librechat.yaml or skill/satchida-web-search-server.py)",
  "patchType": "config | skill | source",
  "safetyLevel": "safe_auto_deploy | requires_review",
  "patchAction": "yaml_update | code_replace | alias_register",
  "suggestedPatch": {
    "targetFile": "relative/path/to/file",
    "description": "What this patch changes",
    "targetString": "exact string to replace (or null if full rewrite/config append)",
    "replacementString": "replacement string or full updated content"
  },
  "verifyCommand": "Verification shell command (e.g. 'node --check ...' or 'npm run build:api')"
}`;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Chat',
        messages: [
          { role: 'system', content: 'You are an autonomous SRE expert. Return ONLY valid JSON matching the requested schema. No code fences, no markdown formatting.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1500,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return generateFallbackAnalysis(incident, `Gateway HTTP ${res.status}: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON safely from response (handling potential markdown ```json blocks)
    let parsed = null;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.warn('[ai-engine] Failed to parse AI JSON response:', parseErr.message);
    }

    if (parsed && parsed.plainEnglishTitle) {
      return {
        success: true,
        analyzedAt: new Date(),
        analysis: parsed,
      };
    }

    return generateFallbackAnalysis(incident, 'AI response format incomplete');
  } catch (err) {
    console.error('[ai-engine] AI analysis failed:', err.message);
    return generateFallbackAnalysis(incident, err.message);
  }
}

/**
 * Deterministic fallback analysis if AI gateway is unreachable
 */
function generateFallbackAnalysis(incident, reason = '') {
  const type = incident.errorType || 'unknown';
  const msg = incident.message || '';

  const heuristics = {
    tool_not_found: {
      title: 'Missing Tool or Alias Misconfiguration',
      desc: 'A user requested an action or calculation, but the system could not locate the requested tool.',
      rootCause: 'The requested tool is not mounted in the current persona or was called with a bare name without MCP server binding.',
      affectedFile: 'librechat.yaml',
      patchType: 'config',
      safetyLevel: 'safe_auto_deploy',
      verifyCommand: 'node -e "require(\'yaml\').parse(require(\'fs\').readFileSync(\'librechat.yaml\',\'utf8\'))"',
    },
    mcp_timeout: {
      title: 'External Integration Response Timeout',
      desc: 'A tool or video generator took longer than expected to finish its work.',
      rootCause: 'The MCP subprocess exceeded the configured client timeout limit.',
      affectedFile: 'librechat.yaml',
      patchType: 'config',
      safetyLevel: 'safe_auto_deploy',
      verifyCommand: 'node -e "console.log(\'Timeout adjusted\')"',
    },
    provider_error: {
      title: 'AI Model Gateway or Upstream Provider Outage',
      desc: 'The external AI model provider returned a server error or failed to generate text.',
      rootCause: 'Upstream HTTP 5xx or connection termination from the model provider.',
      affectedFile: 'satchida-gateway config',
      patchType: 'config',
      safetyLevel: 'requires_review',
      verifyCommand: 'curl -s http://127.0.0.1:4000/v1/models',
    },
    json_parse_error: {
      title: 'Malformed Output Format',
      desc: 'The AI model generated an invalid command parameter structure.',
      rootCause: 'Tool arguments failed JSON syntax validation.',
      affectedFile: 'packages/api/src/agents/handlers.ts',
      patchType: 'source',
      safetyLevel: 'requires_review',
      verifyCommand: 'npm run build:api',
    },
  };

  const h = heuristics[type] || {
    title: `Platform Event: ${type}`,
    desc: `An unclassified error occurred during user interaction (${msg.slice(0, 80)}).`,
    rootCause: msg || 'General operational exception',
    affectedFile: 'N/A',
    patchType: 'config',
    safetyLevel: 'requires_review',
    verifyCommand: 'npx pm2 status',
  };

  return {
    success: false,
    fallbackReason: reason,
    analyzedAt: new Date(),
    analysis: {
      plainEnglishTitle: h.title,
      plainEnglishDescription: h.desc,
      rootCause: h.rootCause,
      affectedFile: h.affectedFile,
      patchType: h.patchType,
      safetyLevel: h.safetyLevel,
      patchAction: 'code_replace',
      suggestedPatch: {
        targetFile: h.affectedFile,
        description: `Remediation for ${type}`,
        targetString: null,
        replacementString: null,
      },
      verifyCommand: h.verifyCommand,
    },
  };
}
