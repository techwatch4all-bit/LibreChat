const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

console.log('=== AUDIT 1: librechat.yaml paths ===');
const doc = yaml.parse(fs.readFileSync('librechat.yaml', 'utf8'));

// Check mcpServers
for (const [name, srv] of Object.entries(doc.mcpServers || {})) {
  if (srv.command && (srv.command.includes('/') || srv.command.includes('\\'))) {
    const exists = fs.existsSync(srv.command);
    console.log(`[mcpServer ${name}] command: "${srv.command}" -> exists: ${exists}`);
  }
  if (srv.args) {
    srv.args.forEach((arg, idx) => {
      if (typeof arg === 'string' && (arg.endsWith('.py') || arg.endsWith('.js') || arg.includes('/') || arg.includes('\\'))) {
        if (!arg.startsWith('-') && !arg.startsWith('http')) {
          const exists = fs.existsSync(arg);
          console.log(`[mcpServer ${name}] arg[${idx}]: "${arg}" -> exists: ${exists}`);
        }
      }
    });
  }
  if (srv.env) {
    for (const [k, v] of Object.entries(srv.env)) {
      if (typeof v === 'string' && (v.includes('/') || v.includes('\\')) && !v.startsWith('http')) {
        const parts = v.split(';');
        parts.forEach(p => {
          if (p && !p.startsWith('$')) {
            const exists = fs.existsSync(p);
            console.log(`[mcpServer ${name}] env ${k}: "${p}" -> exists: ${exists}`);
          }
        });
      }
    }
  }
}
