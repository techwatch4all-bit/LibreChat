const fs = require('fs');

const head = fs.readFileSync('librechat.yaml', 'utf8');

const opencodeBlock = `opencode:
  enabled: true
  baseUrl: http://127.0.0.1:4096
  allowedRoots:
    - D:\\LAN-AI-Infra\\vibe-apps
    - D:\\LAN-AI-Infra
    - C:\\LAN-AI-Infra
    - D:\\LAN-AI-Infra\\sample-vibe-project
    - D:\\LAN-AI-Infra\\workspace
  maxFileBytes: 2097152
  requestTimeoutMs: 30000
`;

let updated = head;
if (!updated.includes('opencode:')) {
  updated = updated.replace(/version: [^\r\n]+[\r\n]+/, (m) => m + opencodeBlock);
  fs.writeFileSync('librechat.yaml', updated, 'utf8');
  console.log('librechat.yaml updated successfully');
} else {
  console.log('already has opencode block');
}
