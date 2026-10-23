/**
 * Verify the usage capture.
 *
 *   a request draws the pack down
 *   the pack's usage ledger records the cloud tokens it covered
 *   the seat's usage row splits by who paid
 *   the request log carries the funding split
 *   the tenant's usage view reports the split per seat and per pack
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import mongoose from 'mongoose';

const ONE_API = 'http://127.0.0.1:4000';

const py = String.raw`
import sqlite3
con = sqlite3.connect(r"D:\LAN-AI-Infra\one-api\one-api.db")
row = con.execute("SELECT access_token FROM users WHERE role >= 100 AND status = 1 ORDER BY id LIMIT 1").fetchone()
print(row[0] if row else "")
`;
const pyFile = 'C:/Users/WINDIE~1/AppData/Local/Temp/opencode/readadmin.py';
writeFileSync(pyFile, py);
const adminToken = execFileSync('python', [pyFile], { encoding: 'utf8' }).trim();
const admin = { 'content-type': 'application/json', Authorization: adminToken };

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
const user = await db.collection('users').findOne({ email: 'e2e.cloud@satchida.local' });
const seatToken = user?.seatToken;
await mongoose.disconnect();
const seatHeaders = { 'content-type': 'application/json', Authorization: `Bearer ${seatToken}` };

// 1. A request, drawn from the seat's pack.
const res = await fetch(`${ONE_API}/v1/chat/completions`, {
  method: 'POST',
  headers: { ...seatHeaders, 'X-Satchida-Mode': 'Chat' },
  body: JSON.stringify({
    model: 'Chat',
    messages: [{ role: 'user', content: 'Reply with exactly: CAPTURED' }],
    max_tokens: 512,
  }),
});
const body = await res.json();
console.log('1. request:', res.status, '|', body?.choices?.[0]?.message?.content ?? body?.error?.message);

// 2. The seat's own view of the pack.
const mine = await (await fetch(`${ONE_API}/api/seat/subscription/self`, { headers: seatHeaders })).json();
for (const sub of mine.data.subscriptions) {
  console.log('2. my pack:', sub.mode,
    '| allowance', sub.amount_total, '| used', sub.amount_used,
    '| cloud tokens consumed', (sub.used_input_tokens ?? 0) + (sub.used_output_tokens ?? 0),
    '| requests', sub.requests ?? 0,
    '| quota covered', sub.covered_quota ?? 0);
}

// 3. The tenant's usage view: the per-seat split and the per-pack summary.
const usage = await (await fetch(`${ONE_API}/api/tenant/satchida-master/usage?days=30`, {
  headers: admin,
})).json();
for (const seat of usage.data.seats ?? []) {
  console.log('3. seat', seat.seat_alias,
    '| total tokens', seat.prompt_tokens + seat.completion_tokens,
    '| from the pack', seat.pack_prompt_tokens + seat.pack_completion_tokens,
    '| pack quota', seat.pack_quota,
    '| contract quota', seat.contract_quota,
    '| requests', seat.requests);
}
for (const pack of usage.data.packs ?? []) {
  console.log('   pack', pack.mode, 'on', pack.scope + '/' + pack.scope_id,
    '| consumed', pack.input_tokens + pack.output_tokens, 'cloud tokens',
    '| worth', pack.covered_quota, 'quota',
    '| remaining', pack.remaining, 'of', pack.amount_total);
}

// 4. The request log carries the split, so the operator can attribute it.
const pyLog = String.raw`
import sqlite3
con = sqlite3.connect(r"D:\LAN-AI-Infra\one-api\one-api.db")
for r in con.execute("""SELECT id, seat_alias, mode, prompt_tokens, completion_tokens,
                               pack_prompt_tokens, pack_completion_tokens,
                               pack_quota, contract_quota, pack_subscription_id
                        FROM logs WHERE tenant_id='satchida-master' AND seat_alias != ''
                        ORDER BY id DESC LIMIT 3"""):
    print("   log", r)
`;
const logFile = 'C:/Users/WINDIE~1/AppData/Local/Temp/opencode/readlog.py';
writeFileSync(logFile, pyLog);
console.log('4. the request log:');
console.log(execFileSync('python', [logFile], { encoding: 'utf8' }).trim());

// 5. The pack's own ledger.
const pyLedger = String.raw`
import sqlite3
con = sqlite3.connect(r"D:\LAN-AI-Infra\one-api\one-api.db")
for r in con.execute("""SELECT subscription_id, scope, scope_id, mode, period_start,
                               input_tokens, output_tokens, covered_quota, requests
                        FROM seat_pack_usages ORDER BY subscription_id DESC LIMIT 5"""):
    print("   ledger", r)
`;
const ledgerFile = 'C:/Users/WINDIE~1/AppData/Local/Temp/opencode/readledger.py';
writeFileSync(ledgerFile, pyLedger);
console.log('5. the pack usage ledger:');
console.log(execFileSync('python', [ledgerFile], { encoding: 'utf8' }).trim());
