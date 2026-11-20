const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseDir = 'D:\\LAN-AI-Infra\\LibreChat\\templates\\starters';
const thumbsDir = 'D:\\LAN-AI-Infra\\LibreChat\\client\\public\\templates\\thumbnails';
const distThumbsDir = 'D:\\LAN-AI-Infra\\LibreChat\\client\\dist\\templates\\thumbnails';

if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });
if (!fs.existsSync(distThumbsDir)) fs.mkdirSync(distThumbsDir, { recursive: true });

const templates = [
  {
    id: 'crm-pipeline',
    title: 'CRM & Sales Pipeline',
    badge: 'Enterprise Sales',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>OmniFlow CRM</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--surface:#0e131f;--surface-elevated:#141c2e;--border:#1e293b;--border-active:#38bdf8;--text-main:#f1f5f9;--text-muted:#818cf8;--accent-cyan:#06b6d4;--accent-blue:#3b82f6;--accent-emerald:#10b981;--accent-amber:#f59e0b;--accent-purple:#8b5cf6}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 15% 0%, #1e1b4b 0%, var(--bg) 45%, #050811 100%);color:var(--text-main);font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
header{display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:24px}
.brand{display:flex;align-items:center;gap:12px}
.brand-logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#38bdf8,#6366f1);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#fff;box-shadow:0 0 20px rgba(99,102,241,0.4)}
.brand-title{font-size:18px;font-weight:700;letter-spacing:-0.02em}
.brand-sub{font-size:11px;color:#94a3b8;font-family:'JetBrains Mono',monospace}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:28px}
.kpi{background:rgba(14,19,31,0.7);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:20px;position:relative;overflow:hidden}
.kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--glow,rgba(56,189,248,0.6)),transparent)}
.kpi-title{font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em}
.kpi-val{font-size:30px;font-weight:800;letter-spacing:-0.03em;margin:8px 0 4px;font-family:'JetBrains Mono',monospace}
.kpi-trend{font-size:12px;color:var(--accent-emerald);font-weight:600;display:flex;align-items:center;gap:4px}
.board{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.column{background:rgba(14,19,31,0.5);border:1px solid rgba(255,255,255,0.05);border-radius:16px;padding:16px}
.col-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.05)}
.col-name{font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px}
.badge-dot{width:8px;height:8px;border-radius:50%;background:var(--dot,#38bdf8);box-shadow:0 0 10px var(--dot,#38bdf8)}
.col-count{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.06);color:#94a3b8;font-family:'JetBrains Mono',monospace}
.deal-card{background:rgba(20,28,46,0.85);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;margin-bottom:12px;box-shadow:0 4px 16px rgba(0,0,0,0.3)}
.deal-title{font-size:13px;font-weight:700;line-height:1.3;margin-bottom:6px}
.deal-meta{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;margin-top:10px}
.deal-amount{color:var(--accent-emerald);font-weight:700;font-size:13px;font-family:'JetBrains Mono',monospace}
.tag{font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(56,189,248,0.12);color:#38bdf8;font-weight:600}
</style></head><body>
<header>
<div class="brand"><div class="brand-logo">Ω</div><div><div class="brand-title">OmniFlow Revenue Ops</div><div class="brand-sub">ENTERPRISE PIPELINE • REAL-TIME Q4</div></div></div>
<div><button style="background:linear-gradient(135deg,#2563eb,#38bdf8);color:#fff;border:none;padding:10px 18px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 0 25px rgba(37,99,235,0.4)">+ Create New Deal</button></div>
</header>
<div class="kpi-row">
<div class="kpi" style="--glow:#38bdf8"><div class="kpi-title">Active Weighted Pipeline</div><div class="kpi-val" style="color:#38bdf8">$4,280,500</div><div class="kpi-trend">↑ 18.4% vs last quarter</div></div>
<div class="kpi" style="--glow:#10b981"><div class="kpi-title">Closed Won Revenue</div><div class="kpi-val" style="color:#10b981">$1,140,200</div><div class="kpi-trend">↑ 92% to quota attainment</div></div>
<div class="kpi" style="--glow:#8b5cf6"><div class="kpi-title">Avg Sales Cycle</div><div class="kpi-val" style="color:#c084fc">18.4 Days</div><div class="kpi-trend" style="color:#c084fc">⚡ 4.2 days faster via AI</div></div>
<div class="kpi" style="--glow:#f59e0b"><div class="kpi-title">Win Probability Index</div><div class="kpi-val" style="color:#fbbf24">74.8%</div><div class="kpi-trend">↑ High deal velocity</div></div>
</div>
<div class="board">
<div class="column">
<div class="col-head"><div class="col-name"><span class="badge-dot" style="--dot:#38bdf8"></span> Discovery & Qual</div><span class="col-count">14 Deals</span></div>
<div class="deal-card"><span class="tag">Banking</span><div class="deal-title" style="margin-top:6px">Tier-1 Core Banking AI Migration</div><div class="deal-meta"><span>HDFC Financial Corp</span><span class="deal-amount">$680,000</span></div></div>
<div class="deal-card"><span class="tag" style="background:rgba(139,92,246,0.15);color:#c084fc">Telco</span><div class="deal-title" style="margin-top:6px">5G Edge Compute Automation</div><div class="deal-meta"><span>Airtel Enterprise</span><span class="deal-amount">$420,000</span></div></div>
</div>
<div class="column">
<div class="col-head"><div class="col-name"><span class="badge-dot" style="--dot:#8b5cf6"></span> Security Review</div><span class="col-count">8 Deals</span></div>
<div class="deal-card"><span class="tag" style="background:rgba(16,185,129,0.15);color:#34d399">Govt Sovereign</span><div class="deal-title" style="margin-top:6px">Zero-Knowledge Defense Gateway</div><div class="deal-meta"><span>Ministry of IT</span><span class="deal-amount">$1,250,000</span></div></div>
</div>
<div class="column">
<div class="col-head"><div class="col-name"><span class="badge-dot" style="--dot:#f59e0b"></span> Commercials</div><span class="col-count">5 Deals</span></div>
<div class="deal-card"><span class="tag">Healthcare</span><div class="deal-title" style="margin-top:6px">Autonomous Multi-Hospital Network</div><div class="deal-meta"><span>Apollo Health</span><span class="deal-amount">$890,000</span></div></div>
</div>
<div class="column">
<div class="col-head"><div class="col-name"><span class="badge-dot" style="--dot:#10b981"></span> Closed Won</div><span class="col-count">12 Deals</span></div>
<div class="deal-card" style="border-color:rgba(16,185,129,0.3)"><span class="tag" style="background:rgba(16,185,129,0.2);color:#10b981">Signed Contract</span><div class="deal-title" style="margin-top:6px">Global Cloud Security Fabric</div><div class="deal-meta"><span>Tata Digital</span><span class="deal-amount">$1,140,200</span></div></div>
</div>
</div>
</body></html>`,
  },
  {
    id: 'gst-invoice-builder',
    title: 'GST Invoice & Billing',
    badge: 'Finance & Compliance',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>GST Ledger</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--accent-cyan:#06b6d4;--accent-emerald:#10b981}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 80% 0%, #064e3b 0%, var(--bg) 45%, #050811 100%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
.container{max-width:960px;margin:0 auto;background:rgba(15,21,35,0.9);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:20px;padding:32px;box-shadow:0 20px 50px rgba(0,0,0,0.5)}
.top-bar{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border);padding-bottom:24px;margin-bottom:24px}
.inv-title{font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#fff;display:flex;align-items:center;gap:10px}
.qr-badge{background:linear-gradient(135deg,#064e3b,#10b981);padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace}
.meta-box{display:grid;grid-template-columns:1fr 1fr;gap:24px;background:rgba(255,255,255,0.02);padding:18px;border-radius:12px;border:1px solid var(--border);margin-bottom:24px;font-size:13px}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{background:#151d30;padding:12px 14px;text-align:left;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.04em}
td{padding:14px;border-bottom:1px solid var(--border);font-size:13px}
.num{font-family:'JetBrains Mono',monospace;text-align:right}
.summary-wrap{display:flex;justify-content:flex-end;margin-top:16px}
.summary-box{width:360px;background:#151d30;border-radius:12px;padding:18px;border:1px solid var(--border);font-size:13px}
.sum-line{display:flex;justify-content:space-between;padding:6px 0;color:#94a3b8}
.sum-total{border-top:1px solid var(--border);padding-top:10px;margin-top:6px;font-size:18px;font-weight:800;color:#10b981;display:flex;justify-content:space-between}
</style></head><body>
<div class="container">
<div class="top-bar">
<div><div class="inv-title">TAX INVOICE <span class="qr-badge">IRN VERIFIED</span></div><div style="color:#94a3b8;font-size:12px;margin-top:6px;font-family:'JetBrains Mono',monospace">GSTIN: 27AAACS8924B1Z4 • HSN SEC: 8471/9983</div></div>
<div style="text-align:right"><div style="font-size:20px;font-weight:800;font-family:'JetBrains Mono',monospace">INV-2026-9402</div><div style="color:#94a3b8;font-size:12px;margin-top:4px">DATE: 20 NOV 2026 • DUE: IMMEDIATE</div></div>
</div>
<div class="meta-box">
<div><div style="color:#94a3b8;font-weight:600;font-size:11px;text-transform:uppercase">Customer / Billed Party:</div><div style="font-size:15px;font-weight:700;margin:4px 0">Mahindra Aerospace & Defense Systems</div><div style="color:#94a3b8">Chakan Industrial Estate, Pune, Maharashtra 410501</div></div>
<div><div style="color:#94a3b8;font-weight:600;font-size:11px;text-transform:uppercase">Place of Supply & Currency:</div><div style="font-size:15px;font-weight:700;margin:4px 0">Maharashtra (27) — Intra-State</div><div style="color:#94a3b8">CGST 9% + SGST 9% • Cleared via UPI / RTGS</div></div>
</div>
<table>
<thead><tr><th>Line Item</th><th>HSN</th><th class="num">Qty</th><th class="num">Unit Rate</th><th class="num">Taxable Value</th></tr></thead>
<tbody>
<tr><td><b>Satchida Neural Inference Edge Blade</b><br><small style="color:#94a3b8">Dual RTX-6000 Ada with local llama-fleet</small></td><td style="font-family:'JetBrains Mono',monospace">8471</td><td class="num">2</td><td class="num">₹4,50,000.00</td><td class="num">₹9,00,000.00</td></tr>
<tr><td><b>Enterprise On-Premises Gateway Setup</b><br><small style="color:#94a3b8">Physical tenant isolation & zero-knowledge injection</small></td><td style="font-family:'JetBrains Mono',monospace">9983</td><td class="num">1</td><td class="num">₹1,50,000.00</td><td class="num">₹1,50,000.00</td></tr>
<tr><td><b>24/7 SLA Mission Critical Support (1-Year)</b></td><td style="font-family:'JetBrains Mono',monospace">9987</td><td class="num">1</td><td class="num">₹1,80,000.00</td><td class="num">₹1,80,000.00</td></tr>
</tbody>
</table>
<div class="summary-wrap">
<div class="summary-box">
<div class="sum-line"><span>Taxable Subtotal:</span><span class="num" style="color:#fff">₹12,30,000.00</span></div>
<div class="sum-line"><span>CGST @ 9.0%:</span><span class="num" style="color:#fff">₹1,10,700.00</span></div>
<div class="sum-line"><span>SGST @ 9.0%:</span><span class="num" style="color:#fff">₹1,10,700.00</span></div>
<div class="sum-total"><span>Grand Total (INR):</span><span class="num">₹14,51,400.00</span></div>
</div>
</div>
</div>
</body></html>`,
  },
  {
    id: 'live-web-price-monitor',
    title: 'Live Metals & Market Monitor',
    badge: 'Trading & Commodities',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Metals Stream</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#05070d;--card:#0b101d;--gold:#facc15;--silver:#e2e8f0;--green:#34d399;--border:rgba(255,255,255,0.08)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 50% 0%, #1e1b4b 0%, var(--bg) 60%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:18px}
.ticker-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.t-card{background:rgba(11,16,29,0.85);backdrop-filter:blur(16px);border:1px solid var(--border);border-radius:16px;padding:20px;position:relative}
.t-sym{font-size:12px;font-weight:700;color:#94a3b8;display:flex;justify-content:space-between}
.t-price{font-size:32px;font-weight:800;font-family:'JetBrains Mono',monospace;margin:8px 0 4px}
.t-chg{font-size:12px;font-weight:700;color:var(--green);font-family:'JetBrains Mono',monospace}
.split{display:grid;grid-template-columns:2.5fr 1fr;gap:20px}
.panel{background:rgba(11,16,29,0.8);border:1px solid var(--border);border-radius:16px;padding:20px}
.news-item{display:flex;gap:16px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
.news-badge{background:rgba(250,204,21,0.12);color:var(--gold);font-size:10px;font-weight:700;padding:4px 8px;border-radius:4px;height:fit-content;font-family:'JetBrains Mono',monospace}
.news-h{font-size:14px;font-weight:700;line-height:1.4}
.news-sub{font-size:12px;color:#94a3b8;margin-top:4px}
</style></head><body>
<header>
<div><div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#fff;display:flex;align-items:center;gap:10px">🥇 Live Sovereign Metals Ticker <span style="font-size:11px;background:#10b981;color:#fff;padding:3px 10px;border-radius:999px;font-weight:700;box-shadow:0 0 15px rgba(16,185,129,0.5)">REAL-TIME SSE / WS</span></div><div style="color:#94a3b8;font-size:12px;margin-top:4px;font-family:'JetBrains Mono',monospace">GATEWAY STREAM • METALSDAILY + ABAXX FUTURES</div></div>
<div style="font-size:12px;color:#94a3b8;text-align:right">LATENCY: <b style="color:#34d399;font-family:'JetBrains Mono',monospace">4.2ms</b> • 20 NOV 2026</div>
</header>
<div class="ticker-cards">
<div class="t-card" style="border-color:rgba(250,204,21,0.3)"><div class="t-sym"><span>GOLD SPOT (XAU)</span><span>USD/OZ</span></div><div class="t-price" style="color:var(--gold)">$2,648.20</div><div class="t-chg">▲ +1.12% (+$29.40)</div></div>
<div class="t-card" style="border-color:rgba(226,232,240,0.3)"><div class="t-sym"><span>SILVER SPOT (XAG)</span><span>USD/OZ</span></div><div class="t-price" style="color:var(--silver)">$31.85</div><div class="t-chg">▲ +2.40% (+$0.74)</div></div>
<div class="t-card"><div class="t-sym"><span>GOLD 24K (10 GRAMS)</span><span>INR</span></div><div class="t-price" style="color:var(--gold)">₹78,940</div><div class="t-chg">▲ +₹820 (MCX)</div></div>
<div class="t-card"><div class="t-sym"><span>SILVER (1 KG)</span><span>INR</span></div><div class="t-price" style="color:var(--silver)">₹93,600</div><div class="t-chg">▲ +₹1,450 (MCX)</div></div>
</div>
<div class="split">
<div class="panel">
<div style="font-size:15px;font-weight:700;margin-bottom:14px;color:#38bdf8">⚡ Live Intelligence & High-Signal Flash News</div>
<div class="news-item"><div class="news-badge">BREAKING</div><div><div class="news-h">Global Central Banks Accelerate Physical Bullion Repatriation in Q4</div><div class="news-sub">4 mins ago • Macro Commodities Bureau • High Market Impact</div></div></div>
<div class="news-item"><div class="news-badge" style="background:rgba(52,211,153,0.15);color:#34d399">FUTURES</div><div><div class="news-h">Abaxx Gold Futures (GKSX26) Volumes Surge Past 45,000 Contracts</div><div class="news-sub">18 mins ago • Institutional Liquidity Desk • Verified Settlement</div></div></div>
<div class="news-item"><div class="news-badge" style="background:rgba(192,132,252,0.15);color:#c084fc">SOLAR</div><div><div class="news-h">Industrial Silver Supply Deficit Forecast at 180M Ounces on PV Demand</div><div class="news-sub">42 mins ago • CleanTech Analytics</div></div></div>
</div>
<div class="panel">
<div style="font-size:15px;font-weight:700;margin-bottom:14px;color:#10b981">🛡️ Automated Scraper Mesh</div>
<div style="font-size:12px;line-height:2;color:#cbd5e1;font-family:'JetBrains Mono',monospace">
<div>• Mode: <b>Client-Engineered WS</b></div>
<div>• Fallback: <b>Pure SSE Stream</b></div>
<div>• Heartbeat: <b>Every 15s</b></div>
<div>• Data Integrity: <b>100% SHA-256</b></div>
</div>
</div>
</div>
</body></html>`,
  },
  {
    id: 'expense-cashflow-tracker',
    title: 'Expense & Cashflow Analytics',
    badge: 'Treasury & Finance',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Treasury Flow</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--green:#10b981;--red:#f43f5e;--purple:#a855f7}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 20% 0%, #311042 0%, var(--bg) 50%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:18px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:24px}
.k-card{background:rgba(15,21,35,0.85);backdrop-filter:blur(16px);border:1px solid var(--border);border-radius:16px;padding:22px}
.val{font-size:32px;font-weight:800;font-family:'JetBrains Mono',monospace;margin:8px 0 4px}
table{width:100%;border-collapse:collapse;background:rgba(15,21,35,0.8);border-radius:16px;overflow:hidden;border:1px solid var(--border)}
th{background:#171f33;padding:12px 16px;text-align:left;font-size:12px;color:#94a3b8;font-weight:600}
td{padding:14px 16px;border-bottom:1px solid var(--border);font-size:13px}
.mono{font-family:'JetBrains Mono',monospace}
</style></head><body>
<header>
<div><div style="font-size:22px;font-weight:800">📊 Corporate Treasury & Cashflow Engine</div><div style="font-size:12px;color:#94a3b8;font-family:'JetBrains Mono',monospace">FISCAL 2026-27 • REAL-TIME GAAP COMPLIANT</div></div>
<button style="background:linear-gradient(135deg,#9333ea,#4f46e5);color:#fff;border:none;padding:10px 18px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer">Download Audit CSV</button>
</header>
<div class="kpis">
<div class="k-card"><div style="color:#94a3b8;font-size:12px;font-weight:600">Total Net Inflows (Nov)</div><div class="val" style="color:var(--green)">$428,950.00</div><div style="color:var(--green);font-size:12px">↑ +24.8% YoY growth</div></div>
<div class="k-card"><div style="color:#94a3b8;font-size:12px;font-weight:600">Total Operational Outflows</div><div class="val" style="color:var(--red)">$112,400.00</div><div style="color:#94a3b8;font-size:12px">Under budget by 8.4%</div></div>
<div class="k-card"><div style="color:#94a3b8;font-size:12px;font-weight:600">Net Operating Free Cashflow</div><div class="val" style="color:#38bdf8">+$316,550.00</div><div style="color:#38bdf8;font-size:12px">⚡ 73.8% Profit Margin</div></div>
</div>
<table>
<thead><tr><th>Transaction ID</th><th>Category</th><th>Description</th><th class="mono">Amount</th><th>Status</th></tr></thead>
<tbody>
<tr><td class="mono">TX-89241</td><td>GPU Cluster Lease</td><td>NVIDIA H200 8-Node Bare Metal</td><td class="mono" style="color:var(--red)">-$28,500.00</td><td><span style="background:rgba(16,185,129,0.15);color:var(--green);padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700">Reconciled</span></td></tr>
<tr><td class="mono">TX-89242</td><td>Govt Enterprise SaaS</td><td>State Smart City AI Architecture License</td><td class="mono" style="color:var(--green)">+$185,000.00</td><td><span style="background:rgba(16,185,129,0.15);color:var(--green);padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700">Settled (RTGS)</span></td></tr>
<tr><td class="mono">TX-89243</td><td>Datacenter Power</td><td>Renewable Dedicated Solar Feed</td><td class="mono" style="color:var(--red)">-$4,820.00</td><td><span style="background:rgba(16,185,129,0.15);color:var(--green);padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700">Reconciled</span></td></tr>
</tbody>
</table>
</body></html>`,
  },
  {
    id: 'clinic-queue-manager',
    title: 'Clinic Patient Queue',
    badge: 'Clinical Healthcare',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Clinic Queue</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--pink:#ec4899;--cyan:#06b6d4}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 10% 0%, #4a044e 0%, var(--bg) 45%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:18px}
.grid{display:grid;grid-template-columns:1fr 2fr;gap:24px}
.token-card{background:rgba(15,21,35,0.9);border:1px solid rgba(236,72,153,0.3);border-radius:20px;padding:32px;text-align:center;box-shadow:0 0 40px rgba(236,72,153,0.15)}
.big-token{font-size:80px;font-weight:900;color:var(--pink);font-family:'JetBrains Mono',monospace;letter-spacing:-0.05em;margin:16px 0}
.list-card{background:rgba(15,21,35,0.85);border:1px solid var(--border);border-radius:20px;padding:24px}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:10px 14px;color:#94a3b8;font-size:12px;border-bottom:1px solid var(--border)}
td{padding:14px;border-bottom:1px solid var(--border);font-size:13px}
</style></head><body>
<header>
<div><div style="font-size:22px;font-weight:800">🏥 Outpatient Clinic Token & Vitals Queue</div><div style="font-size:12px;color:#94a3b8">MAX HEALTHCARE • OP-DEPARTMENT A</div></div>
<div><span style="font-size:12px;background:rgba(6,182,212,0.15);color:var(--cyan);padding:4px 12px;border-radius:999px;font-weight:700">3 CONSULTANTS ONLINE</span></div>
</header>
<div class="grid">
<div class="token-card">
<div style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">NOW IN CONSULTATION</div>
<div class="big-token">#042</div>
<div style="font-size:16px;font-weight:700">Dr. Sunita Rao, MD (Cardiology)</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">Room 104 • Patient: Mr. K. Singhania (62y)</div>
</div>
<div class="list-card">
<div style="font-size:15px;font-weight:700;margin-bottom:14px;color:#38bdf8">Next Scheduled Walk-in & Appointment Queue</div>
<table>
<thead><tr><th>Token</th><th>Patient Name</th><th>Age / Sex</th><th>Vitals (BP / HR)</th><th>Status</th></tr></thead>
<tbody>
<tr><td style="font-weight:800;color:var(--pink);font-family:'JetBrains Mono',monospace">#043</td><td><b>Rohan Sengupta</b></td><td>45 / M</td><td>128/84 • 74 bpm</td><td><span style="background:rgba(250,204,21,0.2);color:#facc15;padding:3px 8px;border-radius:4px;font-weight:700;font-size:11px">CALLING NEXT</span></td></tr>
<tr><td style="font-weight:800;color:#94a3b8;font-family:'JetBrains Mono',monospace">#044</td><td><b>Meena Kumari</b></td><td>58 / F</td><td>138/90 • 82 bpm</td><td>Waiting (8 mins)</td></tr>
<tr><td style="font-weight:800;color:#94a3b8;font-family:'JetBrains Mono',monospace">#045</td><td><b>Aarush Deshmukh</b></td><td>12 / M</td><td>110/70 • 78 bpm</td><td>Waiting (16 mins)</td></tr>
</tbody>
</table>
</div>
</div>
</body></html>`,
  },
  {
    id: 'lab-prescription-portal',
    title: 'Lab & Prescription Portal',
    badge: 'Clinical Diagnostics',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Lab Diagnostics</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--red:#f43f5e;--green:#10b981;--cyan:#06b6d4}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 80% 0%, #083344 0%, var(--bg) 45%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
.box{max-width:960px;margin:0 auto;background:rgba(15,21,35,0.9);border:1px solid var(--border);border-radius:20px;padding:32px}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:20px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{background:#151d30;padding:12px 14px;text-align:left;font-size:12px;color:#94a3b8;font-weight:600}
td{padding:14px;border-bottom:1px solid var(--border);font-size:13px}
.flag{padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700}
.flag-high{background:rgba(244,63,94,0.18);color:var(--red)}
.flag-norm{background:rgba(16,185,129,0.18);color:var(--green)}
.mono{font-family:'JetBrains Mono',monospace}
</style></head><body>
<div class="box">
<header>
<div><div style="font-size:22px;font-weight:800;color:#fff">🧪 Pathological Blood Analysis & Prescription</div><div style="font-size:12px;color:#94a3b8;margin-top:4px;font-family:'JetBrains Mono',monospace">PATIENT: PT-29401 (VIKRAM RAO, 52Y) • SPECIMEN: FASTING VENOUS</div></div>
<button style="background:var(--cyan);color:#07090e;border:none;padding:10px 18px;border-radius:8px;font-weight:800;cursor:pointer">Print Clinical Summary</button>
</header>
<table>
<thead><tr><th>Biomarker Test</th><th class="mono">Observed Value</th><th>Standard Units</th><th class="mono">Normal Reference</th><th>Diagnostic Flag</th></tr></thead>
<tbody>
<tr><td><b>Fasting Blood Glucose</b></td><td class="mono" style="color:var(--red);font-weight:700">148.0</td><td>mg/dL</td><td class="mono">70.0 - 99.0</td><td><span class="flag flag-high">HIGH (ALERT)</span></td></tr>
<tr><td><b>Glycated Hemoglobin (HbA1c)</b></td><td class="mono" style="color:var(--red);font-weight:700">7.2</td><td>%</td><td class="mono">4.0 - 5.6</td><td><span class="flag flag-high">ELEVATED</span></td></tr>
<tr><td><b>Lipid: Serum Triglycerides</b></td><td class="mono" style="color:var(--green);font-weight:700">132.0</td><td>mg/dL</td><td class="mono"> &lt; 150.0</td><td><span class="flag flag-norm">NORMAL</span></td></tr>
<tr><td><b>Kidney: Serum Creatinine</b></td><td class="mono" style="color:var(--green);font-weight:700">0.95</td><td>mg/dL</td><td class="mono">0.70 - 1.20</td><td><span class="flag flag-norm">OPTIMAL</span></td></tr>
</tbody>
</table>
<div style="background:#151d30;border-radius:12px;padding:18px;border:1px solid var(--border);margin-top:20px">
<div style="font-size:14px;font-weight:700;color:var(--cyan);margin-bottom:8px">💊 Physician Prescription Rx</div>
<div style="font-size:13px;line-height:1.7;color:#e2e8f0">
1. <b>Metformin HCl 500mg</b> — 1 tablet with breakfast and dinner (Oral)<br>
2. <b>Atorvastatin 10mg</b> — 1 tablet before bedtime (Oral)<br>
3. Dietary advice: Low glycemic index nutrition, 45-minute daily brisk cardio.
</div>
</div>
</div>
</body></html>`,
  },
  {
    id: 'student-attendance-gradebook',
    title: 'School Attendance & Gradebook',
    badge: 'K-12 & Higher Ed',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Gradebook</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--purple:#a855f7;--green:#10b981}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 20% 0%, #2e1065 0%, var(--bg) 45%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
.card{background:rgba(15,21,35,0.9);border:1px solid var(--border);border-radius:20px;padding:32px}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:20px;margin-bottom:24px}
table{width:100%;border-collapse:collapse}
th{background:#151d30;padding:12px 14px;text-align:left;font-size:12px;color:#94a3b8}
td{padding:14px;border-bottom:1px solid var(--border);font-size:13px}
.mono{font-family:'JetBrains Mono',monospace}
</style></head><body>
<div class="card">
<header>
<div><div style="font-size:22px;font-weight:800">🎓 Academic Semester Gradebook & Roll Call</div><div style="font-size:12px;color:#94a3b8;font-family:'JetBrains Mono',monospace">GRADE 11-A • ADVANCED COMPUTING & MATHEMATICS</div></div>
<div><span style="background:rgba(168,85,247,0.15);color:var(--purple);font-size:12px;font-weight:700;padding:6px 14px;border-radius:999px">SEMESTER 1 RESULTS</span></div>
</header>
<table>
<thead><tr><th>Roll #</th><th>Student Name</th><th class="mono">Attendance</th><th class="mono">Calculus</th><th class="mono">AI & CS</th><th class="mono">Physics</th><th>GPA (10.0)</th></tr></thead>
<tbody>
<tr><td class="mono">#101</td><td><b>Aarav Singhania</b></td><td class="mono" style="color:var(--green)">98.5%</td><td class="mono">96</td><td class="mono">98</td><td class="mono">94</td><td><b style="color:var(--green)">9.8 (A+)</b></td></tr>
<tr><td class="mono">#102</td><td><b>Ananya Iyer</b></td><td class="mono" style="color:var(--green)">96.0%</td><td class="mono">92</td><td class="mono">95</td><td class="mono">91</td><td><b style="color:var(--green)">9.4 (A+)</b></td></tr>
<tr><td class="mono">#103</td><td><b>Devansh Mehta</b></td><td class="mono" style="color:#facc15">84.2%</td><td class="mono">81</td><td class="mono">88</td><td class="mono">76</td><td><b>8.2 (B+)</b></td></tr>
</tbody>
</table>
</div></body></html>`,
  },
  {
    id: 'interactive-quiz-builder',
    title: 'Interactive Quiz & Exam Studio',
    badge: 'Examination & Testing',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Exam Studio</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--purple:#a855f7;--green:#10b981}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 50% 0%, #3b0764 0%, var(--bg) 50%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
.exam-wrap{max-width:760px;margin:0 auto;background:rgba(15,21,35,0.9);border:1px solid var(--border);border-radius:20px;padding:36px;box-shadow:0 0 50px rgba(168,85,247,0.15)}
.top-meta{display:flex;justify-content:space-between;color:#94a3b8;font-size:12px;font-weight:700;margin-bottom:16px;font-family:'JetBrains Mono',monospace}
.q-title{font-size:18px;font-weight:800;line-height:1.4;margin-bottom:24px}
.opt{background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;cursor:pointer;display:flex;align-items:center;gap:12px;font-size:14px;font-weight:600}
.opt-correct{background:rgba(16,185,129,0.15);border-color:var(--green);color:#6ee7b7}
</style></head><body>
<div class="exam-wrap">
<div class="top-meta"><span>SECTION B • DISTRIBUTED SYSTEMS (Q4/12)</span><span style="color:#f43f5e">⏱ 01:24 REMAINING</span></div>
<div class="q-title">Which mechanism guarantees that an edge client node never leaks master API keys to third-party devices?</div>
<div class="opt">A) Hardcoding credentials into local Windows client environment variables</div>
<div class="opt opt-correct">B) In-flight zero-knowledge header injection at Seller Central HQ Gateway proxy</div>
<div class="opt">C) Permitting direct unauthenticated outbound HTTPS relays</div>
<div class="opt">D) Storing raw secret keys in plaintext local browser cookies</div>
</div></body></html>`,
  },
  {
    id: 'inventory-pos-dashboard',
    title: 'Inventory & POS Order Desk',
    badge: 'Retail & Warehouse',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>POS Terminal</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--orange:#f97316;--green:#10b981}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 10% 0%, #431407 0%, var(--bg) 45%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
.grid{display:grid;grid-template-columns:2fr 1fr;gap:24px}
.sku-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px}
.sku-card{background:#151d30;border:1px solid var(--border);border-radius:12px;padding:16px}
.cart-card{background:rgba(15,21,35,0.9);border:1px solid var(--border);border-radius:20px;padding:24px}
.mono{font-family:'JetBrains Mono',monospace}
</style></head><body>
<div class="grid">
<div>
<div style="font-size:22px;font-weight:800;margin-bottom:6px">📦 Warehouse SKU Catalog & Barcode Scanner</div>
<div style="font-size:12px;color:#94a3b8;font-family:'JetBrains Mono',monospace">TERMINAL #03 • LIVE STOCK SYNCHRONIZED</div>
<div class="sku-grid">
<div class="sku-card"><div style="font-size:13px;font-weight:700">Edge Inference Server</div><div class="mono" style="color:var(--orange);font-size:16px;font-weight:700;margin:6px 0">$2,400.00</div><div style="font-size:11px;color:#94a3b8">Stock: 14 units</div></div>
<div class="sku-card"><div style="font-size:13px;font-weight:700">RTX-6000 Ada GPU</div><div class="mono" style="color:var(--orange);font-size:16px;font-weight:700;margin:6px 0">$6,800.00</div><div style="font-size:11px;color:#94a3b8">Stock: 6 units</div></div>
<div class="sku-card" style="border-color:rgba(244,63,94,0.4)"><div style="font-size:13px;font-weight:700">10GbE Fiber Switch</div><div class="mono" style="color:var(--orange);font-size:16px;font-weight:700;margin:6px 0">$890.00</div><div style="font-size:11px;color:#f43f5e;font-weight:700">Stock: 1 unit (LOW)</div></div>
</div>
</div>
<div class="cart-card">
<div style="font-size:18px;font-weight:800;border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:14px">🛒 Active POS Cart</div>
<div style="font-size:13px;line-height:2">
<div style="display:flex;justify-content:space-between"><span>Edge Server (x1)</span><span class="mono">$2,400.00</span></div>
<div style="display:flex;justify-content:space-between"><span>Fiber Switch (x1)</span><span class="mono">$890.00</span></div>
<div style="border-top:1px solid var(--border);margin-top:14px;padding-top:14px;display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:var(--green)"><span>Total:</span><span class="mono">$3,290.00</span></div>
</div>
<button style="width:100%;background:linear-gradient(135deg,#ea580c,#f97316);color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;margin-top:20px;cursor:pointer">Collect Payment (NFC / Card)</button>
</div>
</div></body></html>`,
  },
  {
    id: 'product-catalog-storefront',
    title: 'Product Catalog Storefront',
    badge: 'E-Commerce Storefront',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Storefront</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--orange:#ea580c}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 50% 0%, #431407 0%, var(--bg) 50%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:20px}
.prod{background:rgba(15,21,35,0.9);border:1px solid var(--border);border-radius:16px;overflow:hidden}
.prod-img{height:140px;background:linear-gradient(135deg,#1f293d,#0f1523);display:flex;align-items:center;justify-content:center;font-size:36px}
.prod-body{padding:18px}
.mono{font-family:'JetBrains Mono',monospace}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:center">
<div><div style="font-size:22px;font-weight:800">🛍️ Neural Hardware & Appliance Storefront</div><div style="font-size:12px;color:#94a3b8">ENTERPRISE HARDWARE CATALOG</div></div>
<button style="background:var(--orange);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:700">View Cart (2)</button>
</div>
<div class="grid">
<div class="prod"><div class="prod-img">🖥️</div><div class="prod-body"><div style="font-weight:700">Studio Retina Display Pro</div><div class="mono" style="color:#fb923c;font-size:18px;font-weight:700;margin:6px 0">$1,499.00</div><div style="font-size:12px;color:#94a3b8">Factory 5K calibrated IPS panel with dual TB4.</div></div></div>
<div class="prod"><div class="prod-img">🎛️</div><div class="prod-body"><div style="font-weight:700">Audio DSP Broadcast Master</div><div class="mono" style="color:#fb923c;font-size:18px;font-weight:700;margin:6px 0">$899.00</div><div style="font-size:12px;color:#94a3b8">Hardware 32-bit float preamp with zero jitter.</div></div></div>
<div class="prod"><div class="prod-img">⌨️</div><div class="prod-body"><div style="font-weight:700">Custom CNC Mechanical Board</div><div class="mono" style="color:#fb923c;font-size:18px;font-weight:700;margin:6px 0">$340.00</div><div style="font-size:12px;color:#94a3b8">Anodized 6063 aerospace alloy gasket mount.</div></div></div>
</div></body></html>`,
  },
  {
    id: 'legal-case-docket',
    title: 'Case Docket & Hearing Tracker',
    badge: 'Legal & Court Docket',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Case Docket</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--yellow:#eab308;--red:#f43f5e}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 10% 0%, #422006 0%, var(--bg) 45%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
.card{background:rgba(15,21,35,0.9);border:1px solid var(--border);border-radius:20px;padding:32px}
table{width:100%;border-collapse:collapse;margin-top:20px}
th{background:#151d30;padding:12px 14px;text-align:left;font-size:12px;color:#94a3b8}
td{padding:14px;border-bottom:1px solid var(--border);font-size:13px}
.mono{font-family:'JetBrains Mono',monospace}
</style></head><body>
<div class="card">
<div style="display:flex;justify-content:space-between;align-items:center">
<div><div style="font-size:22px;font-weight:800">⚖️ High Court & Tribunal Case Docket</div><div style="font-size:12px;color:#94a3b8;font-family:'JetBrains Mono',monospace">CHAMBERS OF SENIOR ADVOCATE • ACTIVE LITIGATION</div></div>
<button style="background:var(--yellow);color:#07090e;border:none;padding:10px 18px;border-radius:8px;font-weight:800">+ Add Court Matter</button>
</div>
<table>
<thead><tr><th>Suit / Petition #</th><th>Matter Title</th><th>Court / Forum</th><th class="mono">Next Hearing</th><th>Stage & Priority</th></tr></thead>
<tbody>
<tr><td class="mono">WP 1402/2026</td><td><b>Tata Motors vs Union of India</b></td><td>Bombay High Court (DB-1)</td><td class="mono" style="color:var(--red);font-weight:700">22 Nov 2026 (URGENT)</td><td><span style="background:rgba(244,63,94,0.18);color:var(--red);padding:3px 8px;border-radius:4px;font-weight:700;font-size:11px">Final Arguments</span></td></tr>
<tr><td class="mono">ARB 88/2026</td><td><b>Reliance Retail vs Infrastructure Corp</b></td><td>Arbitral Tribunal (New Delhi)</td><td class="mono">28 Nov 2026</td><td>Cross-Examination</td></tr>
<tr><td class="mono">CS 412/2025</td><td><b>Sharma Family Estate Partition</b></td><td>City Civil Court (Court 4)</td><td class="mono">05 Dec 2026</td><td>Evidence Recording</td></tr>
</tbody>
</table>
</div></body></html>`,
  },
  {
    id: 'compliance-audit-checklist',
    title: 'Compliance & Audit Board',
    badge: 'Security & ISO/DPDP',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Compliance</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--teal:#14b8a6}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 90% 0%, #042f2e 0%, var(--bg) 45%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
.card{background:rgba(15,21,35,0.9);border:1px solid var(--border);border-radius:20px;padding:32px}
.bar{height:12px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;margin:16px 0}
.fill{height:100%;width:94%;background:linear-gradient(90deg,#0d9488,#14b8a6)}
.row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);font-size:13px}
</style></head><body>
<div class="card">
<div style="display:flex;justify-content:space-between;align-items:center">
<div><div style="font-size:22px;font-weight:800">🛡️ ISO 27001 & DPDP Act Compliance Readiness</div><div style="font-size:12px;color:#94a3b8">AUDIT AUDIT CERTIFICATION 2026</div></div>
<div style="font-size:24px;font-weight:900;color:var(--teal);font-family:'JetBrains Mono',monospace">94% PASSED</div>
</div>
<div class="bar"><div class="fill"></div></div>
<div style="margin-top:20px">
<div class="row"><span>✅ <b>Physical Tenant Isolation:</b> Dedicated standalone databases verified per client.</span><span style="color:var(--teal);font-weight:700">COMPLIANT</span></div>
<div class="row"><span>✅ <b>Zero Cloud VPS & Zero VPN Directive:</b> Tunnel outbound-only over HTTPS.</span><span style="color:var(--teal);font-weight:700">COMPLIANT</span></div>
<div class="row"><span>✅ <b>Master Credential Protection:</b> Master API keys stripped from edge clients.</span><span style="color:var(--teal);font-weight:700">COMPLIANT</span></div>
<div class="row"><span>⚠️ <b>Quarterly Disaster Recovery Simulation:</b> Scheduled for 26 Nov 2026.</span><span style="color:#facc15;font-weight:700">IN PROGRESS</span></div>
</div>
</div></body></html>`,
  },
  {
    id: 'team-kanban-board',
    title: 'Team Kanban Sprint Board',
    badge: 'Engineering Agile',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Sprint Board</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--blue:#38bdf8}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 50% 0%, #082f49 0%, var(--bg) 45%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:20px}
.col{background:rgba(15,21,35,0.85);border:1px solid var(--border);border-radius:16px;padding:16px}
.task{background:#151d30;border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:center">
<div><div style="font-size:22px;font-weight:800">📋 Engineering Sprint & Kanban Architecture</div><div style="font-size:12px;color:#94a3b8;font-family:'JetBrains Mono',monospace">SPRINT 44 • 12 ENGINEERS • SHIP CYCLE</div></div>
<button style="background:var(--blue);color:#07090e;border:none;padding:8px 16px;border-radius:8px;font-weight:800">+ New Task</button>
</div>
<div class="grid">
<div class="col"><div style="font-weight:700;color:#94a3b8;margin-bottom:12px;font-size:12px">BACKLOG (4)</div>
<div class="task"><div style="font-weight:700;font-size:13px">Multi-Tenant biometric passkey auth</div><div style="color:var(--blue);font-size:11px;margin-top:4px">Security • P1</div></div>
</div>
<div class="col"><div style="font-weight:700;color:var(--blue);margin-bottom:12px;font-size:12px">IN FLIGHT (3)</div>
<div class="task"><div style="font-weight:700;font-size:13px">1-Click Starter Gallery UI engine</div><div style="color:#facc15;font-size:11px;margin-top:4px">Design • High</div></div>
</div>
<div class="col"><div style="font-weight:700;color:#facc15;margin-bottom:12px;font-size:12px">CODE REVIEW (2)</div>
<div class="task"><div style="font-weight:700;font-size:13px">Bifrost ZDR fallback routing</div><div style="color:#c084fc;font-size:11px;margin-top:4px">Gateway • Critical</div></div>
</div>
<div class="col"><div style="font-weight:700;color:#10b981;margin-bottom:12px;font-size:12px">MERGED & LIVE (18)</div>
<div class="task" style="border-color:rgba(16,185,129,0.3)"><div style="font-weight:700;font-size:13px">Zero Cloud VPS Named Tunnels</div><div style="color:#10b981;font-size:11px;margin-top:4px">Infra • Verified</div></div>
</div>
</div></body></html>`,
  },
  {
    id: 'hr-leave-shift-roster',
    title: 'Employee Leave & Shift Roster',
    badge: 'Human Resources',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>HR Roster</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07090e;--card:#0f1523;--border:rgba(255,255,255,0.08);--lime:#84cc16;--green:#10b981}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(circle at 10% 0%, #1a2e05 0%, var(--bg) 45%);color:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;padding:24px 32px;min-height:100vh}
.card{background:rgba(15,21,35,0.9);border:1px solid var(--border);border-radius:20px;padding:32px}
table{width:100%;border-collapse:collapse;margin-top:20px}
th{background:#151d30;padding:12px 14px;text-align:left;font-size:12px;color:#94a3b8}
td{padding:14px;border-bottom:1px solid var(--border);font-size:13px}
.mono{font-family:'JetBrains Mono',monospace}
</style></head><body>
<div class="card">
<div style="display:flex;justify-content:space-between;align-items:center">
<div><div style="font-size:22px;font-weight:800">👥 Shift Allocation & Leave Management Roster</div><div style="font-size:12px;color:#94a3b8;font-family:'JetBrains Mono',monospace">ORGANIZATION WORKFORCE • WEEK 47</div></div>
<button style="background:var(--lime);color:#07090e;border:none;padding:10px 18px;border-radius:8px;font-weight:800">+ Request Time Off</button>
</div>
<table>
<thead><tr><th>Employee Name</th><th>Business Unit</th><th class="mono">Scheduled Shift</th><th>Today Presence</th><th class="mono">Available Leave</th></tr></thead>
<tbody>
<tr><td><b>Kavita Nair</b></td><td>Core Platform Engineering</td><td class="mono">09:00 - 18:00 IST</td><td><span style="color:var(--green);font-weight:700">● On Duty (HQ Floor 3)</span></td><td class="mono">18 Days</td></tr>
<tr><td><b>Rohan Seth</b></td><td>Global Customer Success</td><td class="mono">14:00 - 23:00 IST</td><td><span style="color:var(--green);font-weight:700">● On Duty (Remote)</span></td><td class="mono">14 Days</td></tr>
<tr><td><b>Meera Joshi</b></td><td>Treasury & Compliance</td><td class="mono">09:00 - 18:00 IST</td><td><span style="color:#f43f5e;font-weight:700">○ Casual Leave</span></td><td class="mono">8 Days</td></tr>
</tbody>
</table>
</div></body></html>`,
  },
];

// Write code files to templates directory
for (const tpl of templates) {
  const dir = path.join(baseDir, tpl.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), tpl.html, 'utf8');

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
  fs.writeFileSync(path.join(dir, 'server.mjs'), serverCode, 'utf8');
}
console.log('Saved 14 enterprise starter apps on disk.');

// Render ultra-high resolution screenshots with Playwright
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({
    viewport: { width: 1200, height: 750 },
    deviceScaleFactor: 2,
  });

  for (const tpl of templates) {
    const fileUri = `file://${path.join(baseDir, tpl.id, 'index.html').replace(/\\/g, '/')}`;
    await page.goto(fileUri, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const publicPath = path.join(thumbsDir, `${tpl.id}.png`);
    const distPath = path.join(distThumbsDir, `${tpl.id}.png`);

    await page.screenshot({ path: publicPath });
    fs.copyFileSync(publicPath, distPath);
    console.log(`Rendered & synced high-DPI thumbnail: ${tpl.id}.png`);
  }

  await browser.close();
  console.log('Successfully completed high-DPI rendering for all 14 enterprise templates.');
})();
