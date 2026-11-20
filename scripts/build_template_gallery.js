const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseDir = 'D:\\LAN-AI-Infra\\LibreChat\\templates\\starters';
const thumbsDir = 'D:\\LAN-AI-Infra\\LibreChat\\client\\public\\templates\\thumbnails';

if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

const templates = [
  {
    id: 'crm-pipeline',
    title: 'CRM & Sales Pipeline',
    badge: 'Business',
    color: '#3b82f6',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CRM</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1e293b;padding-bottom:16px;margin-bottom:24px}
.title{font-size:20px;font-weight:700;display:flex;align-items:center;gap:8px}
.badge{background:#3b82f6;color:#fff;font-size:12px;padding:3px 8px;border-radius:4px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.stat-card{background:#1e293b;padding:16px;border-radius:12px;border:1px solid #334155}
.stat-val{font-size:24px;font-weight:700;color:#60a5fa}
.stat-lbl{font-size:12px;color:#94a3b8;margin-top:4px}
.board{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.col{background:#1e293b;border-radius:12px;padding:16px;border:1px solid #334155}
.col-header{font-size:14px;font-weight:600;margin-bottom:12px;display:flex;justify-content:space-between}
.deal{background:#0f172a;padding:12px;border-radius:8px;border:1px solid #334155;margin-bottom:10px}
.deal-name{font-size:13px;font-weight:600}
.deal-val{font-size:12px;color:#10b981;margin-top:4px}
.deal-client{font-size:11px;color:#94a3b8;margin-top:2px}
</style></head><body>
<div class="header"><div class="title">💼 Sales Pipeline CRM <span class="badge">Active</span></div><div><button style="background:#3b82f6;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer">+ Add Lead</button></div></div>
<div class="stats">
<div class="stat-card"><div class="stat-val">$184,500</div><div class="stat-lbl">Pipeline Value</div></div>
<div class="stat-card"><div class="stat-val">42</div><div class="stat-lbl">Active Leads</div></div>
<div class="stat-card"><div class="stat-val">68%</div><div class="stat-lbl">Win Rate</div></div>
<div class="stat-card"><div class="stat-val">$42,800</div><div class="stat-lbl">Closed Won (Nov)</div></div>
</div>
<div class="board">
<div class="col"><div class="col-header"><span>New Leads</span><span>(14)</span></div>
<div class="deal"><div class="deal-name">Cloud Migration</div><div class="deal-val">$24,000</div><div class="deal-client">Apex Solutions Inc</div></div>
<div class="deal"><div class="deal-name">ERP Customization</div><div class="deal-val">$15,000</div><div class="deal-client">Metro Logistics</div></div>
</div>
<div class="col"><div class="col-header"><span>Qualified</span><span>(11)</span></div>
<div class="deal"><div class="deal-name">AI Fleet License</div><div class="deal-val">$38,500</div><div class="deal-client">Global Logistics Ltd</div></div>
</div>
<div class="col"><div class="col-header"><span>Proposal Sent</span><span>(9)</span></div>
<div class="deal"><div class="deal-name">Govt Secure Portal</div><div class="deal-val">$62,000</div><div class="deal-client">State Education Dept</div></div>
</div>
<div class="col"><div class="col-header"><span>Won Deals</span><span>(8)</span></div>
<div class="deal"><div class="deal-name">Mobile App Retainer</div><div class="deal-val">$45,000</div><div class="deal-client">Zenith Retailers</div></div>
</div>
</div>
</body></html>`
  },
  {
    id: 'gst-invoice-builder',
    title: 'GST Invoice & Billing',
    badge: 'Business',
    color: '#10b981',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>GST Invoice</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.header{display:flex;justify-content:space-between;border-bottom:1px solid #1e293b;padding-bottom:16px;margin-bottom:20px}
.invoice-card{background:#1e293b;border-radius:12px;border:1px solid #334155;padding:24px;max-width:800px;margin:0 auto}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;font-size:13px}
table{width:100%;border-collapse:collapse;margin:20px 0;font-size:13px}
th{background:#0f172a;padding:10px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8}
td{padding:12px 10px;border-bottom:1px solid #334155}
.totals{display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-size:13px}
.grand{font-size:18px;font-weight:700;color:#10b981;margin-top:6px}
</style></head><body>
<div class="invoice-card">
<div class="header"><div><h2 style="margin:0;color:#60a5fa">TAX INVOICE</h2><div style="font-size:12px;color:#94a3b8;margin-top:4px">GSTIN: 27AABCS1429B1Z8</div></div><div style="text-align:right"><div style="font-weight:700">INV-2026-089</div><div style="font-size:12px;color:#94a3b8">20 Nov 2026</div></div></div>
<div class="meta-grid"><div><strong style="color:#94a3b8">Billed To:</strong><div style="font-weight:600;margin-top:4px">Sunrise Engineering Works</div><div style="color:#cbd5e1;font-size:12px">Mumbai, Maharashtra - 400001</div></div><div><strong style="color:#94a3b8">Place of Supply:</strong><div style="font-weight:600;margin-top:4px">Maharashtra (27)</div><div style="color:#cbd5e1;font-size:12px">CGST (9%) + SGST (9%)</div></div></div>
<table><thead><tr><th>Item Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate (₹)</th><th>Taxable (₹)</th></tr></thead>
<tbody>
<tr><td>AI Edge Gateway Appliance</td><td>8471</td><td>2</td><td>45,000.00</td><td>90,000.00</td></tr>
<tr><td>Annual Maintenance Support</td><td>9983</td><td>1</td><td>18,000.00</td><td>18,000.00</td></tr>
<tr><td>On-site System Integration</td><td>9987</td><td>1</td><td>12,000.00</td><td>12,000.00</td></tr>
</tbody></table>
<div class="totals">
<div>Sub Total: ₹1,20,000.00</div>
<div>CGST @ 9%: ₹10,800.00</div>
<div>SGST @ 9%: ₹10,800.00</div>
<div class="grand">Total Payable: ₹1,41,600.00</div>
</div>
</div></body></html>`
  },
  {
    id: 'live-web-price-monitor',
    title: 'Live Metals & Market Monitor',
    badge: 'Finance',
    color: '#f59e0b',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Metals Monitor</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#090d16;color:#f8fafc;padding:24px}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1e293b;padding-bottom:16px;margin-bottom:20px}
.ticker-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.ticker-card{background:#111827;border-radius:12px;border:1px solid #374151;padding:16px}
.sym{font-size:12px;font-weight:700;color:#9ca3af;display:flex;justify-content:space-between}
.price{font-size:26px;font-weight:800;margin:8px 0;color:#facc15}
.chg{font-size:12px;font-weight:600;color:#34d399}
.split{display:grid;grid-template-columns:2fr 1fr;gap:20px}
.news-box{background:#111827;border-radius:12px;border:1px solid #374151;padding:16px}
.news-item{padding:10px 0;border-bottom:1px solid #1f2937}
.news-title{font-size:13px;font-weight:600;color:#f3f4f6}
.news-meta{font-size:11px;color:#9ca3af;margin-top:4px}
</style></head><body>
<div class="header"><div style="font-size:20px;font-weight:700">🥇 Live Metals & Commodity Ticker <span style="font-size:11px;background:#10b981;color:#fff;padding:2px 8px;border-radius:12px;margin-left:8px">LIVE WEBSOCKET</span></div><div style="font-size:12px;color:#9ca3af">Source: metalsdaily & abaxx feed</div></div>
<div class="ticker-grid">
<div class="ticker-card"><div class="sym"><span>GOLD SPOT (XAU)</span><span>USD</span></div><div class="price">$2,642.80</div><div class="chg">+0.84% (+$22.10)</div></div>
<div class="ticker-card"><div class="sym"><span>SILVER SPOT (XAG)</span><span>USD</span></div><div class="price" style="color:#e5e7eb">$31.45</div><div class="chg">+1.35% (+$0.42)</div></div>
<div class="ticker-card"><div class="sym"><span>GOLD 24K (10g)</span><span>INR</span></div><div class="price" style="color:#fbbf24">₹78,420</div><div class="chg">+0.65% (+₹510)</div></div>
<div class="ticker-card"><div class="sym"><span>SILVER (1kg)</span><span>INR</span></div><div class="price" style="color:#e5e7eb">₹92,800</div><div class="chg">+1.10% (+₹1,020)</div></div>
</div>
<div class="split">
<div class="news-box"><h3 style="margin:0 0 12px;font-size:14px;color:#60a5fa">📰 Top Breaking Stories & Market Alerts</h3>
<div class="news-item"><div class="news-title">Precious Metals Rally as Global Bond Yields Soften</div><div class="news-meta">12 mins ago • Commodities Desk • High Signal</div></div>
<div class="news-item"><div class="news-title">Central Banks Expand Physical Gold Reserves in Q4 2026</div><div class="news-meta">34 mins ago • Macro Intelligence • Verified</div></div>
<div class="news-item"><div class="news-title">Silver Industrial Demand Touches New High on Solar Boom</div><div class="news-meta">1 hr ago • Renewable Analytics</div></div>
</div>
<div class="news-box"><h3 style="margin:0 0 12px;font-size:14px;color:#10b981">⚙️ Automation Monitor</h3>
<div style="font-size:12px;line-height:1.6;color:#cbd5e1">
<div>• Probe Interval: <b>30 seconds</b></div>
<div>• Fallback: <b>abaxx XHR stream</b></div>
<div>• Parser: <b>Zero-dependency SSE</b></div>
<div>• Uptime: <b>99.98%</b></div>
</div>
</div>
</div></body></html>`
  },
  {
    id: 'expense-cashflow-tracker',
    title: 'Expense & Cashflow Analytics',
    badge: 'Finance',
    color: '#6366f1',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Expense Tracker</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
.card{background:#1e293b;padding:20px;border-radius:12px;border:1px solid #334155}
.val{font-size:24px;font-weight:700;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-top:20px;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155}
th,td{padding:12px 16px;text-align:left;font-size:13px;border-bottom:1px solid #334155}
th{background:#0f172a;color:#94a3b8}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
<h2 style="margin:0">📊 Expense & Cashflow Analytics</h2>
<button style="background:#6366f1;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:600">Export CSV</button>
</div>
<div class="grid">
<div class="card"><div style="color:#94a3b8;font-size:12px">Total Income (Nov)</div><div class="val" style="color:#10b981">$34,250.00</div></div>
<div class="card"><div style="color:#94a3b8;font-size:12px">Total Operating Expenses</div><div class="val" style="color:#f43f5e">$12,480.00</div></div>
<div class="card"><div style="color:#94a3b8;font-size:12px">Net Cashflow Margin</div><div class="val" style="color:#60a5fa">+$21,770.00 (63.5%)</div></div>
</div>
<table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead>
<tbody>
<tr><td>20 Nov 2026</td><td>Cloud Hosting</td><td>GPU Dedicated Compute Cluster</td><td style="color:#f43f5e">Expense</td><td>-$1,250.00</td></tr>
<tr><td>19 Nov 2026</td><td>Client Retainer</td><td>Enterprise AI Agent Suite</td><td style="color:#10b981">Income</td><td>+$8,500.00</td></tr>
<tr><td>18 Nov 2026</td><td>Office & Power</td><td>Dedicated Fiber & Electricity</td><td style="color:#f43f5e">Expense</td><td>-$480.00</td></tr>
</tbody></table>
</body></html>`
  },
  {
    id: 'clinic-queue-manager',
    title: 'Clinic Patient Queue',
    badge: 'Healthcare',
    color: '#ec4899',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Clinic Queue</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.token-grid{display:grid;grid-template-columns:1fr 2fr;gap:20px}
.card{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}
.big-token{font-size:64px;font-weight:900;color:#ec4899;text-align:center;margin:12px 0}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:10px;text-align:left;border-bottom:1px solid #334155}
th{color:#94a3b8}
</style></head><body>
<h2 style="margin-top:0;display:flex;align-items:center;gap:8px">🏥 Clinic Patient Queue & Token Board</h2>
<div class="token-grid">
<div class="card"><div style="color:#94a3b8;font-size:13px;text-align:center">NOW CONSULTING</div><div class="big-token">#024</div><div style="text-align:center;font-weight:600">Dr. Rajesh Mehta (Cardiology)</div><div style="text-align:center;font-size:12px;color:#94a3b8;margin-top:4px">Patient: S. Sharma (Room 3)</div></div>
<div class="card"><h3 style="margin-top:0;font-size:14px;color:#38bdf8">Waiting Queue (8 Patients)</h3>
<table><thead><tr><th>Token</th><th>Patient Name</th><th>Age</th><th>Doctor</th><th>Status</th></tr></thead>
<tbody>
<tr><td>#025</td><td>Ananya Deshmukh</td><td>34</td><td>Dr. R. Mehta</td><td><span style="color:#facc15;font-weight:600">Next</span></td></tr>
<tr><td>#026</td><td>Vikram Malhotra</td><td>58</td><td>Dr. R. Mehta</td><td>Waiting (15m)</td></tr>
<tr><td>#027</td><td>Pooja Iyer</td><td>29</td><td>Dr. S. Kulkarni</td><td>Waiting (22m)</td></tr>
</tbody></table>
</div></div></body></html>`
  },
  {
    id: 'lab-prescription-portal',
    title: 'Lab & Prescription Portal',
    badge: 'Healthcare',
    color: '#06b6d4',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lab Portal</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.panel{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}
th,td{padding:12px;text-align:left;border-bottom:1px solid #334155}
th{background:#0f172a;color:#94a3b8}
.high{color:#f43f5e;font-weight:700}
.normal{color:#10b981;font-weight:600}
</style></head><body>
<div class="panel">
<div style="display:flex;justify-content:space-between;align-items:center">
<div><h2 style="margin:0">🧪 Clinical Lab Report & Diagnostic Panel</h2><div style="font-size:12px;color:#94a3b8;margin-top:4px">Patient ID: PT-98214 • Date: 20 Nov 2026</div></div>
<button style="background:#06b6d4;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:600">Print Report</button>
</div>
<table><thead><tr><th>Test Name</th><th>Observed Value</th><th>Unit</th><th>Reference Range</th><th>Status</th></tr></thead>
<tbody>
<tr><td>Fasting Blood Sugar</td><td class="high">138</td><td>mg/dL</td><td>70 - 99</td><td><span style="background:#881337;color:#fda4af;padding:2px 8px;border-radius:4px">HIGH</span></td></tr>
<tr><td>HbA1c</td><td class="high">6.8</td><td>%</td><td>4.0 - 5.6</td><td><span style="background:#881337;color:#fda4af;padding:2px 8px;border-radius:4px">ELEVATED</span></td></tr>
<tr><td>Total Cholesterol</td><td class="normal">184</td><td>mg/dL</td><td>125 - 200</td><td><span style="background:#064e3b;color:#6ee7b7;padding:2px 8px;border-radius:4px">NORMAL</span></td></tr>
<tr><td>Hemoglobin</td><td class="normal">14.2</td><td>g/dL</td><td>13.5 - 17.5</td><td><span style="background:#064e3b;color:#6ee7b7;padding:2px 8px;border-radius:4px">NORMAL</span></td></tr>
</tbody></table>
</div></body></html>`
  },
  {
    id: 'student-attendance-gradebook',
    title: 'School Attendance & Gradebook',
    badge: 'Education',
    color: '#8b5cf6',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gradebook</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.card{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}
th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #334155}
th{background:#0f172a;color:#94a3b8}
</style></head><body>
<div class="card">
<div style="display:flex;justify-content:space-between;align-items:center">
<h2 style="margin:0">📚 Class 10-A Attendance & Marks Gradebook</h2>
<div style="font-size:12px;color:#94a3b8">Term 1 Examination</div>
</div>
<table><thead><tr><th>Roll #</th><th>Student Name</th><th>Attendance</th><th>Maths (100)</th><th>Science (100)</th><th>English (100)</th><th>GPA / Grade</th></tr></thead>
<tbody>
<tr><td>101</td><td>Aarav Patil</td><td style="color:#10b981">96%</td><td>92</td><td>88</td><td>85</td><td><b>A+ (9.1)</b></td></tr>
<tr><td>102</td><td>Bhavna Sen</td><td style="color:#10b981">92%</td><td>85</td><td>91</td><td>89</td><td><b>A+ (9.0)</b></td></tr>
<tr><td>103</td><td>Chirag Verma</td><td style="color:#facc15">81%</td><td>74</td><td>68</td><td>72</td><td><b>B+ (7.4)</b></td></tr>
</tbody></table>
</div></body></html>`
  },
  {
    id: 'interactive-quiz-builder',
    title: 'Interactive Quiz & Exam Studio',
    badge: 'Education',
    color: '#a855f7',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quiz Studio</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.quiz-card{background:#1e293b;border-radius:12px;padding:24px;border:1px solid #334155;max-width:700px;margin:0 auto}
.opt{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px 16px;margin-bottom:10px;cursor:pointer;font-size:14px}
.opt.correct{border-color:#10b981;background:#064e3b;color:#a7f3d0}
</style></head><body>
<div class="quiz-card">
<div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:12px;margin-bottom:12px"><span>QUESTION 4 OF 10</span><span style="color:#f43f5e;font-weight:700">⏱ 00:48</span></div>
<h3 style="margin:0 0 16px;font-size:16px">What is the primary architectural function of an edge Gateway in a local-first system?</h3>
<div class="opt">A) Forward all plaintext data directly to external third-party public clouds</div>
<div class="opt correct">B) Enforce physical tenant isolation, seat policy & zero-knowledge credential injection</div>
<div class="opt">C) Store all passwords in plain text in an unencrypted cookie</div>
<div class="opt">D) Disable local inference and require high-latency remote relays</div>
</div></body></html>`
  },
  {
    id: 'inventory-pos-dashboard',
    title: 'Inventory & POS Order Desk',
    badge: 'Retail',
    color: '#f97316',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>POS</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.pos-grid{display:grid;grid-template-columns:2fr 1fr;gap:20px}
.card{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}
.sku-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}
.sku{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;cursor:pointer}
</style></head><body>
<div class="pos-grid">
<div class="card"><h3 style="margin-top:0">📦 Quick SKU Product Catalog</h3>
<div class="sku-grid">
<div class="sku"><div style="font-weight:600">USB-C Hub 7-in-1</div><div style="color:#10b981;font-weight:700;margin-top:4px">$34.99</div><div style="font-size:11px;color:#94a3b8">Stock: 48 pcs</div></div>
<div class="sku"><div style="font-weight:600">Mechanical Keyboard</div><div style="color:#10b981;font-weight:700;margin-top:4px">$89.00</div><div style="font-size:11px;color:#94a3b8">Stock: 12 pcs</div></div>
<div class="sku"><div style="font-weight:600">4K Ultra Webcam</div><div style="color:#10b981;font-weight:700;margin-top:4px">$65.00</div><div style="font-size:11px;color:#f43f5e">Stock: 2 pcs (LOW)</div></div>
</div></div>
<div class="card"><h3 style="margin-top:0">🛒 Current Cart (3 items)</h3>
<div style="font-size:13px;line-height:1.8">
<div style="display:flex;justify-content:space-between"><span>USB-C Hub (x2)</span><span>$69.98</span></div>
<div style="display:flex;justify-content:space-between"><span>4K Webcam (x1)</span><span>$65.00</span></div>
<hr style="border-color:#334155;margin:12px 0">
<div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;color:#10b981"><span>Total</span><span>$134.98</span></div>
<button style="width:100%;background:#f97316;color:#fff;border:none;padding:10px;border-radius:8px;font-weight:700;margin-top:16px;cursor:pointer">Charge Customer</button>
</div></div>
</div></body></html>`
  },
  {
    id: 'product-catalog-storefront',
    title: 'Product Catalog Storefront',
    badge: 'Retail',
    color: '#ea580c',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Storefront</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.item{background:#1e293b;border-radius:12px;border:1px solid #334155;overflow:hidden}
.img{height:120px;background:#334155;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:14px}
.desc{padding:16px}
</style></head><body>
<h2 style="margin-top:0">🛍️ Premium Hardware Storefront</h2>
<div class="grid">
<div class="item"><div class="img">🖥️ Studio Display Pro</div><div class="desc"><div style="font-weight:700">27" 5K Retina Monitor</div><div style="color:#ea580c;font-weight:700;margin:6px 0">$1,299.00</div><div style="font-size:12px;color:#94a3b8">Factory color calibrated with Thunderbolt 4.</div></div></div>
<div class="item"><div class="img">🎧 Studio ANC Headphones</div><div class="desc"><div style="font-weight:700">Wireless Spatial Audio</div><div style="color:#ea580c;font-weight:700;margin:6px 0">$349.00</div><div style="font-size:12px;color:#94a3b8">Lossless audio stream with 40h battery.</div></div></div>
<div class="item"><div class="img">⌨️ Custom Ergonomic Board</div><div class="desc"><div style="font-weight:700">Split Gasket Mount</div><div style="color:#ea580c;font-weight:700;margin:6px 0">$220.00</div><div style="font-size:12px;color:#94a3b8">Hot-swappable switches with aluminum frame.</div></div></div>
</div></body></html>`
  },
  {
    id: 'legal-case-docket',
    title: 'Case Docket & Hearing Tracker',
    badge: 'Legal',
    color: '#eab308',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Case Docket</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.card{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}
th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #334155}
th{background:#0f172a;color:#94a3b8}
</style></head><body>
<div class="card">
<h2 style="margin-top:0">⚖️ Legal Case Docket & Hearing Calendar</h2>
<table><thead><tr><th>Case Suit #</th><th>Matter Title</th><th>Court / Forum</th><th>Next Hearing</th><th>Stage / Priority</th></tr></thead>
<tbody>
<tr><td>WP 1402/2026</td><td>Tata Motors vs Union of India</td><td>Bombay High Court</td><td style="color:#f43f5e;font-weight:700">22 Nov 2026 (Urgent)</td><td>Final Arguments</td></tr>
<tr><td>ARB 88/2026</td><td>Reliance Retail vs Infra Ltd</td><td>Arbitral Tribunal</td><td>28 Nov 2026</td><td>Cross-Examination</td></tr>
<tr><td>CS 412/2025</td><td>Sharma Property Partition</td><td>City Civil Court</td><td>05 Dec 2026</td><td>Evidence Recording</td></tr>
</tbody></table>
</div></body></html>`
  },
  {
    id: 'compliance-audit-checklist',
    title: 'Compliance & Audit Board',
    badge: 'Legal',
    color: '#14b8a6',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Compliance Audit</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.card{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}
.progress{background:#0f172a;height:12px;border-radius:6px;overflow:hidden;margin:12px 0}
.fill{background:#14b8a6;height:100%;width:92%}
</style></head><body>
<div class="card">
<div style="display:flex;justify-content:space-between;align-items:center">
<h2 style="margin:0">🛡️ ISO 27001 & DPDP Act Compliance Readiness</h2>
<span style="font-size:18px;font-weight:800;color:#14b8a6">92% READY</span>
</div>
<div class="progress"><div class="fill"></div></div>
<div style="font-size:13px;line-height:2;margin-top:16px">
<div>✅ <b>Physical Tenant Isolation:</b> Dedicated SQLite/Mongo instance per customer verified.</div>
<div>✅ <b>Zero Cloud VPS / Zero VPN:</b> Cloudflare Named Tunnels verified active.</div>
<div>✅ <b>Zero-Knowledge Credentials:</b> Master API keys stripped from client machines.</div>
<div>⚠️ <b>Disaster Recovery Drill:</b> Scheduled for 25 Nov 2026 (Pending sign-off).</div>
</div>
</div></body></html>`
  },
  {
    id: 'team-kanban-board',
    title: 'Team Kanban Sprint Board',
    badge: 'Operations',
    color: '#0ea5e9',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sprint Kanban</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.board{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.col{background:#1e293b;border-radius:12px;padding:16px;border:1px solid #334155}
.task{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;margin-bottom:10px}
</style></head><body>
<h2 style="margin-top:0">📋 Team Sprint & Kanban Board</h2>
<div class="board">
<div class="col"><div style="font-weight:700;margin-bottom:12px;color:#94a3b8">BACKLOG (4)</div>
<div class="task"><div style="font-weight:600">Add biometric lock to mobile app</div><div style="font-size:11px;color:#38bdf8;margin-top:4px">Mobile • P2</div></div>
</div>
<div class="col"><div style="font-weight:700;margin-bottom:12px;color:#38bdf8">IN PROGRESS (3)</div>
<div class="task"><div style="font-weight:600">1-Click Template gallery preview</div><div style="font-size:11px;color:#facc15;margin-top:4px">Frontend • High</div></div>
</div>
<div class="col"><div style="font-weight:700;margin-bottom:12px;color:#facc15">IN REVIEW (2)</div>
<div class="task"><div style="font-weight:600">Bifrost ZDR fallback routing</div><div style="font-size:11px;color:#a855f7;margin-top:4px">Gateway • Critical</div></div>
</div>
<div class="col"><div style="font-weight:700;margin-bottom:12px;color:#10b981">COMPLETED (8)</div>
<div class="task"><div style="font-weight:600">Windows Safe User Folder Isolation</div><div style="font-size:11px;color:#10b981;margin-top:4px">Core • Verified</div></div>
</div>
</div></body></html>`
  },
  {
    id: 'hr-leave-shift-roster',
    title: 'Employee Leave & Shift Roster',
    badge: 'Operations',
    color: '#84cc16',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>HR Roster</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:24px}
.card{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}
th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #334155}
th{background:#0f172a;color:#94a3b8}
</style></head><body>
<div class="card">
<h2 style="margin-top:0">👥 Employee Leave & Shift Coverage Roster</h2>
<table><thead><tr><th>Employee</th><th>Department</th><th>Shift Time</th><th>Current Status</th><th>Leave Balance</th></tr></thead>
<tbody>
<tr><td>Kavita Nair</td><td>Engineering</td><td>09:00 - 18:00</td><td><span style="color:#10b981;font-weight:600">On Duty</span></td><td>16 Days</td></tr>
<tr><td>Rohan Seth</td><td>Customer Support</td><td>14:00 - 23:00</td><td><span style="color:#10b981;font-weight:600">On Duty</span></td><td>12 Days</td></tr>
<tr><td>Meera Joshi</td><td>Operations</td><td>09:00 - 18:00</td><td><span style="color:#f43f5e;font-weight:600">On Leave (Casual)</span></td><td>8 Days</td></tr>
</tbody></table>
</div></body></html>`
  }
];

// 1. Build template files on disk
for (const tpl of templates) {
  const tplDir = path.join(baseDir, tpl.id);
  if (!fs.existsSync(tplDir)) fs.mkdirSync(tplDir, { recursive: true });
  fs.writeFileSync(path.join(tplDir, 'index.html'), tpl.html, 'utf8');
  
  const serverCode = `import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Template server running at http://0.0.0.0:' + PORT);
});
`;
  fs.writeFileSync(path.join(tplDir, 'server.mjs'), serverCode, 'utf8');
  
  const pkg = {
    name: tpl.id,
    version: '1.0.0',
    type: 'module',
    scripts: { start: 'node server.mjs' }
  };
  fs.writeFileSync(path.join(tplDir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
}
console.log('Created 14 template projects on disk.');

// 2. Render actual UI screenshots using Playwright
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 480 } });

  for (const tpl of templates) {
    const filePath = path.join(baseDir, tpl.id, 'index.html');
    await page.goto(`file://${filePath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const thumbPath = path.join(thumbsDir, `${tpl.id}.png`);
    await page.screenshot({ path: thumbPath });
    console.log(`Rendered thumbnail: ${tpl.id}.png`);
  }

  await browser.close();
  console.log('All 14 template thumbnails rendered successfully!');
})();
