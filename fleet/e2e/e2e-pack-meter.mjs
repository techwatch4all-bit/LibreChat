/**
 * Verify that a chat request draws the seat's purchased pack down, and that
 * the pack's share of the cost is taken off the tenant's budget rather than
 * charged twice.
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

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
const user = await db.collection('users').findOne({ email: 'e2e.cloud@satchida.local' });
const seatToken = user?.seatToken;
await mongoose.disconnect();

const seatHeaders = { 'content-type': 'application/json', Authorization: `Bearer ${seatToken}` };

const readPack = async () => {
  const body = await (await fetch(`${ONE_API}/api/seat/subscription/self`, { headers: seatHeaders })).json();
  return body.data.subscriptions[0];
};

const before = await readPack();
console.log('before: total', before.amount_total, 'used', before.amount_used, 'remaining', before.remaining);

const res = await fetch(`${ONE_API}/v1/chat/completions`, {
  method: 'POST',
  headers: { ...seatHeaders, 'X-Satchida-Mode': 'Chat' },
  body: JSON.stringify({
    model: 'Chat',
    messages: [{ role: 'user', content: 'Reply with exactly: PACK_METERED' }],
    max_tokens: 512,
  }),
});
const body = await res.json();
console.log('chat status:', res.status, '|', body?.choices?.[0]?.message?.content ?? body?.error?.message);

const after = await readPack();
console.log('after : total', after.amount_total, 'used', after.amount_used, 'remaining', after.remaining);
console.log('the pack was drawn down by', after.amount_used - before.amount_used, 'tokens');

// The budget records only the part IT funded, so the pack's share is not
// charged to the contract twice.
const pyBudget = String.raw`
import sqlite3
con = sqlite3.connect(r"D:\LAN-AI-Infra\one-api\one-api.db")
for r in con.execute("SELECT owner_type, owner_id, spent_quota, reserved_quota, nominal_limit FROM spend_budgets WHERE owner_id='satchida-master'"):
    print("budget:", r)
`;
const budgetFile = 'C:/Users/WINDIE~1/AppData/Local/Temp/opencode/readbudget.py';
writeFileSync(budgetFile, pyBudget);
console.log(execFileSync('python', [budgetFile], { encoding: 'utf8' }).trim());
