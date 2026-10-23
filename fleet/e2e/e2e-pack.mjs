/**
 * Exercise the pack purchase flow end to end against the running One-API.
 *
 *   publish a pack -> buy it with the seat's bearer token -> observe ->
 *   confirm -> the pack is active and the seat's allowance shows it
 *
 * Nothing secret is printed.
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

const admin = {
  'content-type': 'application/json',
  Authorization: adminToken,
};

async function adminApi(path, method, body) {
  const res = await fetch(`${ONE_API}${path}`, {
    method,
    headers: admin,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return parsed;
}

// 1. Publish the pack: a Pro seat's Chat pack, priced at Rs 100 a month.
const plan = await adminApi('/api/seat/subscription/admin/plans', 'PUT', {
  plan_id: 'pro-chat-1m',
  display_name: 'Pro Chat Pack',
  description: 'One million tokens of Chat, a month at a time.',
  mode: 'Chat',
  account_type: 'pro',
  unit: 'mtok',
  base_price_minor: 10000,
  currency: 'INR',
  allowed_units: 1000000,
  reset_period_days: 30,
  seat_count: 1,
  price_seat_equivalents: 1,
  allow_wallet_overflow: true,
  carry_forward: true,
  enabled: true,
  sort_order: 10,
});
console.log('1. pack published:', plan.data.plan.plan_id);
console.log('   ladder:', plan.data.terms.map((t) => `${t.months}m=${t.price_minor / 100}rs`).join(' '));

// The catalog as a customer sees it.
const catalog = await adminApi('/api/seat/subscription/plans', 'GET');
console.log('2. catalog:', catalog.data.map((p) => `${p.plan_id} [${p.terms.length} rungs]`).join(', '));

// 3. Buy it with the seat's own bearer token.
await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
const user = await db.collection('users').findOne({ email: 'e2e.cloud@satchida.local' });
const seatToken = user?.seatToken;
await mongoose.disconnect();
if (!seatToken) throw new Error('the cloud seat has no bearer token');

const seatHeaders = {
  'content-type': 'application/json',
  Authorization: `Bearer ${seatToken}`,
};

const purchase = await fetch(`${ONE_API}/api/seat/subscription/pay`, {
  method: 'POST',
  headers: seatHeaders,
  body: JSON.stringify({ plan_id: 'pro-chat-1m', months: 3 }),
});
const purchased = await purchase.json();
if (!purchase.ok) throw new Error(`purchase -> ${purchase.status}: ${JSON.stringify(purchased)}`);
console.log('3. purchase opened:', purchased.data.id, 'status', purchased.data.status,
  'amount Rs', purchased.data.amount_inr, 'reference', purchased.data.reference);
console.log('   QR present:', Boolean(purchased.data.upi_qr_svg));

// 4. Observe, then confirm.
const observed = await fetch(`${ONE_API}/api/seat/subscription/pay/${purchased.data.id}`, {
  headers: seatHeaders,
});
const observedBody = await observed.json();
console.log('4. observed status:', observedBody.data.status);

const confirmed = await fetch(`${ONE_API}/api/seat/subscription/pay/${purchased.data.id}/confirm`, {
  method: 'POST',
  headers: seatHeaders,
});
const confirmedBody = await confirmed.json();
console.log('5. confirmed:', confirmedBody.success, '|', confirmedBody.message);

// 5. The seat's own view of its pack.
const mine = await fetch(`${ONE_API}/api/seat/subscription/self`, { headers: seatHeaders });
const mineBody = await mine.json();
for (const sub of mineBody.data.subscriptions) {
  console.log('6. my pack:', sub.mode, sub.amount_total, 'total /', sub.amount_used, 'used,',
    'remaining', sub.remaining, '| next reset', new Date(sub.next_reset_at * 1000).toISOString().slice(0, 10));
}

// 6. Confirming again must not grant twice.
const again = await fetch(`${ONE_API}/api/seat/subscription/pay/${purchased.data.id}/confirm`, {
  method: 'POST',
  headers: seatHeaders,
});
const againBody = await again.json();
console.log('7. second confirm:', againBody.message);
const mineAgain = await (await fetch(`${ONE_API}/api/seat/subscription/self`, { headers: seatHeaders })).json();
console.log('   packs held:', mineAgain.data.subscriptions.length,
  '| total', mineAgain.data.subscriptions[0]?.amount_total);
