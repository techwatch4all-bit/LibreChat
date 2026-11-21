import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const templatesDir = path.resolve('templates/starters');
const publicThumbnailsDir = path.resolve('client/public/templates/thumbnails');
const distThumbnailsDir = path.resolve('client/dist/templates/thumbnails');

[publicThumbnailsDir, distThumbnailsDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Common sleek glassmorphic foundation + dynamic animated mesh gradients
function wrapHtml(title, themeCSS, contentHTML) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
      color: #f8fafc;
    }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .serif { font-family: 'Playfair Display', Georgia, serif; }

    /* Animated Ambient Mesh Glow */
    @keyframes meshFloat {
      0% { transform: translate(0px, 0px) scale(1); }
      33% { transform: translate(30px, -40px) scale(1.1); }
      66% { transform: translate(-25px, 25px) scale(0.95); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    @keyframes pulseGlow {
      0%, 100% { opacity: 0.55; }
      50% { opacity: 0.95; filter: drop-shadow(0 0 16px currentColor); }
    }
    @keyframes shimmerBar {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    ${themeCSS}
  </style>
</head>
<body>
  ${contentHTML}
</body>
</html>`;
}

// DEFINITION OF THE 14 UNIQUE ENTERPRISE DESIGNS
const STARTERS = [
  // 1. CRM & Sales Pipeline -> Dark Luxury Obsidian & Neon Gold/Amber (Private Equity & Enterprise Dealflow)
  {
    id: 'crm-pipeline',
    title: 'Satchida Capital · Dealflow & Pipeline OS',
    theme: `
      body {
        background: radial-gradient(circle at 15% 15%, #2a1b05 0%, #0d0b08 45%, #050403 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .ambient-glow-1 {
        position: fixed; top: -100px; right: -50px; width: 500px; height: 500px;
        background: radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, transparent 70%);
        filter: blur(80px); pointer-events: none; animation: meshFloat 14s infinite ease-in-out;
      }
      .ambient-glow-2 {
        position: fixed; bottom: -120px; left: 10%; width: 550px; height: 550px;
        background: radial-gradient(circle, rgba(217, 119, 6, 0.15) 0%, transparent 70%);
        filter: blur(90px); pointer-events: none;
      }
      .glass-card {
        background: rgba(22, 18, 12, 0.72);
        backdrop-filter: blur(28px) saturate(190%);
        -webkit-backdrop-filter: blur(28px) saturate(190%);
        border: 1px solid rgba(245, 158, 11, 0.22);
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(251, 191, 36, 0.25);
        border-radius: 20px;
      }
      .gold-gradient-text {
        background: linear-gradient(135deg, #fef08a 0%, #f59e0b 50%, #b45309 100%);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .stage-col {
        background: rgba(15, 12, 8, 0.6);
        border: 1px solid rgba(245, 158, 11, 0.12);
        border-radius: 16px; padding: 18px;
      }
    `,
    html: `
      <div class="ambient-glow-1"></div>
      <div class="ambient-glow-2"></div>
      <div style="max-width: 1320px; margin: 0 auto; position: relative; z-index: 2;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #fbbf24; text-transform: uppercase;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 10px #fbbf24;"></span> Private Equity M&A Suite
            </div>
            <h1 class="serif" style="font-size: 34px; margin-top: 10px; letter-spacing: -0.5px;">Global Enterprise Dealflow</h1>
          </div>
          <div style="display: flex; gap: 14px;">
            <button style="padding: 10px 20px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(245, 158, 11, 0.25); color: #fde68a; font-weight: 600; font-size: 13px; cursor: pointer;">Export Model LBO</button>
            <button style="padding: 10px 24px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; font-weight: 800; font-size: 13px; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.35);">+ New Institutional Mandate</button>
          </div>
        </div>

        <!-- KPI Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 28px;">
          <div class="glass-card" style="padding: 22px;">
            <div style="font-size: 12px; font-weight: 600; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.5px;">Weighted Pipeline</div>
            <div class="serif gold-gradient-text" style="font-size: 36px; font-weight: 700; margin: 8px 0;">$48.2M</div>
            <div style="font-size: 12px; color: #34d399; font-weight: 600;">↑ +28.4% vs Q3 target</div>
          </div>
          <div class="glass-card" style="padding: 22px;">
            <div style="font-size: 12px; font-weight: 600; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.5px;">Active LOI Bids</div>
            <div class="mono" style="font-size: 36px; font-weight: 800; color: #fef08a; margin: 8px 0;">18 Mandates</div>
            <div style="font-size: 12px; color: #fbbf24;">4 Awaiting Board Signoff</div>
          </div>
          <div class="glass-card" style="padding: 22px;">
            <div style="font-size: 12px; font-weight: 600; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.5px;">Gross Win Velocity</div>
            <div class="serif" style="font-size: 36px; font-weight: 700; color: #fff; margin: 8px 0;">32 Days</div>
            <div style="font-size: 12px; color: #34d399; font-weight: 600;">⚡ 14 days faster than peer benchmark</div>
          </div>
          <div class="glass-card" style="padding: 22px;">
            <div style="font-size: 12px; font-weight: 600; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.5px;">Q4 Net Closed ARR</div>
            <div class="serif gold-gradient-text" style="font-size: 36px; font-weight: 700; margin: 8px 0;">$14.65M</div>
            <div style="font-size: 12px; color: #38bdf8;">104% Quota Reached</div>
          </div>
        </div>

        <!-- Pipeline Kanban Columns -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <!-- Col 1 -->
          <div class="stage-col">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <span style="font-size: 13px; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 1px;">Term Sheet Executed (3)</span>
              <span class="mono" style="font-size: 12px; color: #a8a29e;">$19.4M</span>
            </div>
            <div class="glass-card" style="padding: 18px; margin-bottom: 14px; border-left: 3px solid #f59e0b;">
              <div style="font-size: 15px; font-weight: 700; color: #fff;">Sovereign Cloud AI Cluster</div>
              <div style="font-size: 12px; color: #a8a29e; margin: 4px 0 12px;">Apollo Global Infrastructure Corp</div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="serif gold-gradient-text" style="font-size: 18px; font-weight: 700;">$9,200,000</span>
                <span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: rgba(52, 211, 153, 0.15); color: #34d399; font-weight: 700;">85% Prob</span>
              </div>
            </div>
            <div class="glass-card" style="padding: 18px; border-left: 3px solid #f59e0b;">
              <div style="font-size: 15px; font-weight: 700; color: #fff;">Fintech Core Banking Migration</div>
              <div style="font-size: 12px; color: #a8a29e; margin: 4px 0 12px;">Standard Mercantile Bank Group</div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="serif gold-gradient-text" style="font-size: 18px; font-weight: 700;">$6,400,000</span>
                <span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 700;">90% Prob</span>
              </div>
            </div>
          </div>

          <!-- Col 2 -->
          <div class="stage-col">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <span style="font-size: 13px; font-weight: 700; color: #34d399; text-transform: uppercase; letter-spacing: 1px;">Due Diligence & Audit (2)</span>
              <span class="mono" style="font-size: 12px; color: #a8a29e;">$14.2M</span>
            </div>
            <div class="glass-card" style="padding: 18px; margin-bottom: 14px; border-left: 3px solid #34d399;">
              <div style="font-size: 15px; font-weight: 700; color: #fff;">Defense Biometric Vault</div>
              <div style="font-size: 12px; color: #a8a29e; margin: 4px 0 12px;">Naval & Aerospace Technologies</div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="serif gold-gradient-text" style="font-size: 18px; font-weight: 700;">$11,500,000</span>
                <span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: rgba(52, 211, 153, 0.15); color: #34d399; font-weight: 700;">95% Prob</span>
              </div>
            </div>
          </div>

          <!-- Col 3 -->
          <div class="stage-col">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <span style="font-size: 13px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px;">Won & Executed (4)</span>
              <span class="mono" style="font-size: 12px; color: #a8a29e;">$14.65M</span>
            </div>
            <div class="glass-card" style="padding: 18px; margin-bottom: 14px; border-left: 3px solid #38bdf8;">
              <div style="font-size: 15px; font-weight: 700; color: #fff;">Quantum Cryptography Lease</div>
              <div style="font-size: 12px; color: #a8a29e; margin: 4px 0 12px;">Equities Clearing Corporation</div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="serif gold-gradient-text" style="font-size: 18px; font-weight: 700;">$8,850,000</span>
                <span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: 800;">CONTRACT SIGNED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  // 2. GST Invoice & Client Billing -> Deep Forest Emerald & Acid Lime Glass (Corporate Taxation & Gov Invoicing)
  {
    id: 'gst-invoice-builder',
    title: 'Satchida Tax · Enterprise GST Portal & e-Way Studio',
    theme: `
      body {
        background: radial-gradient(circle at 85% 15%, #062e1b 0%, #03140c 50%, #010805 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .ambient-glow {
        position: fixed; top: -80px; left: -80px; width: 600px; height: 600px;
        background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%);
        filter: blur(90px); pointer-events: none;
      }
      .emerald-glass {
        background: rgba(6, 28, 18, 0.75);
        backdrop-filter: blur(24px) saturate(200%);
        border: 1px solid rgba(52, 211, 153, 0.28);
        box-shadow: 0 20px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(110, 231, 183, 0.2);
        border-radius: 20px;
      }
      .lime-badge {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(163, 230, 53, 0.15));
        border: 1px solid rgba(163, 230, 53, 0.4);
        color: #bef264;
      }
    `,
    html: `
      <div class="ambient-glow"></div>
      <div style="max-width: 1280px; margin: 0 auto; position: relative; z-index: 2;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;">
          <div>
            <div class="lime-badge" style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
              ✓ NIC e-Invoice Portal Synchronized · 256-Bit Signed IRN
            </div>
            <h1 style="font-size: 32px; font-weight: 800; margin-top: 10px; color: #ecfdf5;">Corporate Tax & GST B2B Bill Desk</h1>
          </div>
          <div style="display: flex; gap: 12px;">
            <button style="padding: 10px 20px; border-radius: 12px; background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); color: #6ee7b7; font-weight: 700; font-size: 13px;">Verify NIC Portal</button>
            <button style="padding: 10px 22px; border-radius: 12px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; font-size: 13px; border: none; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);">⚡ Generate QR & Sign IRN</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
          <div class="emerald-glass" style="padding: 28px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(52, 211, 153, 0.15); padding-bottom: 18px; margin-bottom: 20px;">
              <div>
                <span style="font-size: 11px; color: #6ee7b7; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Recipient Entity</span>
                <div style="font-size: 18px; font-weight: 800; color: #fff; margin-top: 4px;">SunTech Aerospace Engineering Ltd</div>
                <div class="mono" style="font-size: 12px; color: #a7f3d0; margin-top: 2px;">GSTIN: 27AABCS1429B1Z8 · State: Maharashtra (27)</div>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 11px; color: #6ee7b7; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Invoice Series</span>
                <div class="mono" style="font-size: 20px; font-weight: 800; color: #a3e635;">INV-2026-X901</div>
                <div style="font-size: 12px; color: #94a3b8;">Issued: 20-Nov-2026</div>
              </div>
            </div>

            <!-- Line Items Table -->
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
              <thead>
                <tr style="color: #6ee7b7; border-bottom: 1px solid rgba(52, 211, 153, 0.2); font-weight: 700;">
                  <th style="padding: 10px 0;">Item & Specification</th>
                  <th style="padding: 10px 0;">HSN/SAC</th>
                  <th style="padding: 10px 0;">Qty</th>
                  <th style="padding: 10px 0;">Rate (₹)</th>
                  <th style="padding: 10px 0; text-align: right;">Taxable (₹)</th>
                </tr>
              </thead>
              <tbody class="mono" style="color: #e2e8f0;">
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 14px 0; font-family:'Plus Jakarta Sans'; font-weight: 600; color: #fff;">Quantum Sovereign GPU Blade Tier-4</td>
                  <td style="color: #94a3b8;">8471</td>
                  <td>2</td>
                  <td>₹45,00,000</td>
                  <td style="text-align: right; color: #6ee7b7; font-weight: 700;">₹90,00,000</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 14px 0; font-family:'Plus Jakarta Sans'; font-weight: 600; color: #fff;">Mission-Critical SLA Maintenance</td>
                  <td style="color: #94a3b8;">9983</td>
                  <td>1</td>
                  <td>₹12,50,000</td>
                  <td style="text-align: right; color: #6ee7b7; font-weight: 700;">₹12,50,000</td>
                </tr>
                <tr>
                  <td style="padding: 14px 0; font-family:'Plus Jakarta Sans'; font-weight: 600; color: #fff;">Zero-Trust Encryption Controller</td>
                  <td style="color: #94a3b8;">8517</td>
                  <td>4</td>
                  <td>₹6,25,000</td>
                  <td style="text-align: right; color: #6ee7b7; font-weight: 700;">₹25,00,000</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tax Calculation Summary -->
          <div class="emerald-glass" style="padding: 28px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #a3e635; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 18px;">Tax Split Breakdown</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px;">
                <span style="color: #94a3b8;">Taxable Base Total</span>
                <span class="mono" style="font-weight: 700; color: #fff;">₹1,27,50,000.00</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px;">
                <span style="color: #94a3b8;">CGST (9.0%)</span>
                <span class="mono" style="font-weight: 600; color: #6ee7b7;">₹11,47,500.00</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 13px;">
                <span style="color: #94a3b8;">SGST (9.0%)</span>
                <span class="mono" style="font-weight: 600; color: #6ee7b7;">₹11,47,500.00</span>
              </div>
              <div style="border-top: 1px solid rgba(52, 211, 153, 0.25); padding-top: 16px;">
                <span style="font-size: 11px; text-transform: uppercase; color: #a3e635; font-weight: 800; letter-spacing: 1px;">Gross Invoice Value</span>
                <div class="mono" style="font-size: 32px; font-weight: 800; color: #ecfdf5; margin-top: 4px;">₹1,50,45,000</div>
              </div>
            </div>
            <div style="background: rgba(16, 185, 129, 0.12); border: 1px dashed rgba(52, 211, 153, 0.35); border-radius: 12px; padding: 12px; text-align: center; margin-top: 20px;">
              <span class="mono" style="font-size: 11px; color: #a7f3d0; word-break: break-all;">IRN: e7a92c45f891b0cde2419087abcdf145781a... [DIGITALLY SIGNED]</span>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  // 3. Live Market & Metals Monitor -> Midnight Sapphire, 24K Gold & Silver Glow (Real-Time Pit Trading)
  {
    id: 'live-web-price-monitor',
    title: 'Satchida Terminal · High-Frequency Metals & FX Wire',
    theme: `
      body {
        background: radial-gradient(circle at 50% 10%, #03152e 0%, #020914 55%, #01040a 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .ambient-glow-sapphire {
        position: fixed; top: -100px; left: 30%; width: 700px; height: 500px;
        background: radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, transparent 70%);
        filter: blur(100px); pointer-events: none;
      }
      .gold-box {
        background: rgba(10, 25, 47, 0.75);
        backdrop-filter: blur(28px) saturate(210%);
        border: 1px solid rgba(251, 191, 36, 0.45);
        box-shadow: 0 16px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(254, 240, 138, 0.35);
        border-radius: 20px;
      }
      .silver-box {
        background: rgba(10, 25, 47, 0.75);
        backdrop-filter: blur(28px) saturate(210%);
        border: 1px solid rgba(148, 163, 184, 0.4);
        box-shadow: 0 16px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3);
        border-radius: 20px;
      }
      .live-pulse {
        width: 8px; height: 8px; border-radius: 50%; background: #22c55e;
        box-shadow: 0 0 14px #22c55e; animation: pulseGlow 1.8s infinite;
      }
    `,
    html: `
      <div class="ambient-glow-sapphire"></div>
      <div style="max-width: 1320px; margin: 0 auto; position: relative; z-index: 2;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <h1 style="font-size: 32px; font-weight: 800; letter-spacing: -0.5px; color: #fff;">Precious Metals Real-Time Ticker</h1>
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.4); font-size: 11px; font-weight: 700; color: #4ade80;">
              <span class="live-pulse"></span> WSS STREAM: wss://cws-gateway.abaxx.exchange
            </div>
          </div>
          <div class="mono" style="font-size: 13px; color: #93c5fd; background: rgba(30, 58, 138, 0.4); padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(59, 130, 246, 0.3);">
            LATENCY: 8.4ms · CME / MCX TICK FEED
          </div>
        </div>

        <!-- 4 Major Metals Tickers -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 28px;">
          <!-- Gold USD -->
          <div class="gold-box" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 800; color: #fbbf24; letter-spacing: 1px; text-transform: uppercase;">GOLD SPOT · XAU/USD</span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(34, 197, 94, 0.2); color: #4ade80; font-weight: 700;">+1.42%</span>
            </div>
            <div class="mono" style="font-size: 38px; font-weight: 800; color: #fef08a; margin: 12px 0 6px; text-shadow: 0 0 20px rgba(251, 191, 36, 0.4);">$2,642.80</div>
            <div style="font-size: 12px; color: #94a3b8;">High: $2,654.10 · Low: $2,628.00</div>
          </div>

          <!-- Silver USD -->
          <div class="silver-box" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 800; color: #e2e8f0; letter-spacing: 1px; text-transform: uppercase;">SILVER SPOT · XAG/USD</span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(34, 197, 94, 0.2); color: #4ade80; font-weight: 700;">+2.85%</span>
            </div>
            <div class="mono" style="font-size: 38px; font-weight: 800; color: #f8fafc; margin: 12px 0 6px; text-shadow: 0 0 20px rgba(255, 255, 255, 0.35);">$31.45</div>
            <div style="font-size: 12px; color: #94a3b8;">Volume: 42,890 Contracts</div>
          </div>

          <!-- Gold INR -->
          <div class="gold-box" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 800; color: #fbbf24; letter-spacing: 1px; text-transform: uppercase;">GOLD MCX (10G)</span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(34, 197, 94, 0.2); color: #4ade80; font-weight: 700;">+₹890</span>
            </div>
            <div class="mono" style="font-size: 38px; font-weight: 800; color: #fef08a; margin: 12px 0 6px; text-shadow: 0 0 20px rgba(251, 191, 36, 0.4);">₹78,420</div>
            <div style="font-size: 12px; color: #94a3b8;">Closing Prev: ₹77,530</div>
          </div>

          <!-- Silver INR -->
          <div class="silver-box" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 800; color: #e2e8f0; letter-spacing: 1px; text-transform: uppercase;">SILVER MCX (1KG)</span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(34, 197, 94, 0.2); color: #4ade80; font-weight: 700;">+₹1,450</span>
            </div>
            <div class="mono" style="font-size: 38px; font-weight: 800; color: #f8fafc; margin: 12px 0 6px; text-shadow: 0 0 20px rgba(255, 255, 255, 0.35);">₹92,800</div>
            <div style="font-size: 12px; color: #94a3b8;">High of Day: ₹93,120</div>
          </div>
        </div>

        <!-- Wire News Feed & Depth -->
        <div class="gold-box" style="padding: 24px;">
          <div style="font-size: 13px; font-weight: 700; color: #60a5fa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">Breaking Institutional Market Wires</div>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <div>
                <span class="mono" style="font-size: 11px; color: #fbbf24; font-weight: 700; margin-right: 12px;">14:32:05 UTC</span>
                <span style="font-size: 14px; font-weight: 600; color: #fff;">Central Banks Expand Sovereign Gold Reserves by 45 Tonnes in October</span>
              </div>
              <span style="font-size: 12px; color: #94a3b8;">Reuters Wire</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <div>
                <span class="mono" style="font-size: 11px; color: #fbbf24; font-weight: 700; margin-right: 12px;">14:15:42 UTC</span>
                <span style="font-size: 14px; font-weight: 600; color: #fff;">Silver Industrial Off-Take Climbs 14% on Next-Gen Photovoltaic Cell Demand</span>
              </div>
              <span style="font-size: 12px; color: #94a3b8;">Bloomberg Terminal</span>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  // 4. Expense & Cashflow Analytics -> Dark Velvet Violet, Rose Gold & Amethyst (VC & Treasury)
  {
    id: 'expense-cashflow-tracker',
    title: 'Satchida Treasury · VC Runway & GAAP Cashflow Dashboard',
    theme: `
      body {
        background: radial-gradient(circle at 80% 20%, #2e0854 0%, #150326 50%, #080110 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .ambient-glow-amethyst {
        position: fixed; top: -100px; right: 10%; width: 600px; height: 600px;
        background: radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, transparent 70%);
        filter: blur(100px); pointer-events: none;
      }
      .violet-glass {
        background: rgba(30, 10, 52, 0.72);
        backdrop-filter: blur(28px) saturate(200%);
        border: 1px solid rgba(192, 132, 252, 0.28);
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(233, 213, 255, 0.25);
        border-radius: 20px;
      }
    `,
    html: `
      <div class="ambient-glow-amethyst"></div>
      <div style="max-width: 1280px; margin: 0 auto; position: relative; z-index: 2;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px; background: rgba(192, 132, 252, 0.15); border: 1px solid rgba(192, 132, 252, 0.35); font-size: 11px; font-weight: 700; color: #d8b4fe;">
              Series B Runway Engine · SOC-1 Audited Ledger
            </div>
            <h1 style="font-size: 32px; font-weight: 800; margin-top: 10px; color: #fff;">GAAP Cashflow & Cloud Outlay Treasury</h1>
          </div>
          <button style="padding: 10px 22px; border-radius: 12px; background: linear-gradient(135deg, #a855f7, #7e22ce); color: #fff; font-weight: 700; font-size: 13px; border: none; box-shadow: 0 8px 24px rgba(168, 85, 247, 0.35);">Export GAAP CSV</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 28px;">
          <div class="violet-glass" style="padding: 24px;">
            <div style="font-size: 12px; font-weight: 700; color: #c084fc; text-transform: uppercase;">Available Liquid Runway</div>
            <div class="mono" style="font-size: 36px; font-weight: 800; color: #f3e8ff; margin: 10px 0;">26.4 Months</div>
            <div style="font-size: 12px; color: #4ade80;">Net Burn: $82,400/month</div>
          </div>
          <div class="violet-glass" style="padding: 24px;">
            <div style="font-size: 12px; font-weight: 700; color: #c084fc; text-transform: uppercase;">Current Cash Balance</div>
            <div class="mono" style="font-size: 36px; font-weight: 800; color: #fff; margin: 10px 0;">$2,175,000</div>
            <div style="font-size: 12px; color: #38bdf8;">Across JPMorgan & Silicon Valley Bank</div>
          </div>
          <div class="violet-glass" style="padding: 24px;">
            <div style="font-size: 12px; font-weight: 700; color: #c084fc; text-transform: uppercase;">GPU & Cloud Infrastructure</div>
            <div class="mono" style="font-size: 36px; font-weight: 800; color: #f43f5e; margin: 10px 0;">$34,250</div>
            <div style="font-size: 12px; color: #94a3b8;">14% decrease vs previous cycle</div>
          </div>
        </div>

        <div class="violet-glass" style="padding: 24px;">
          <div style="font-size: 13px; font-weight: 700; color: #d8b4fe; text-transform: uppercase; margin-bottom: 16px;">November 2026 Outlay Schedule</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="color: #c084fc; border-bottom: 1px solid rgba(192, 132, 252, 0.2); text-align: left;">
                <th style="padding: 10px 0;">Date</th>
                <th>Category</th>
                <th>Vendor / Allocation</th>
                <th>Type</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody class="mono" style="color: #e2e8f0;">
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px 0;">20-Nov-2026</td>
                <td style="font-family:'Plus Jakarta Sans';">Dedicated Compute</td>
                <td style="font-family:'Plus Jakarta Sans'; color: #fff; font-weight: 600;">8x NVIDIA H100 SXM5 Cluster</td>
                <td><span style="padding: 2px 8px; border-radius: 4px; background: rgba(244, 63, 94, 0.15); color: #fb7185; font-size: 11px;">OPEX</span></td>
                <td style="text-align: right; color: #fb7185; font-weight: 700;">-$18,400.00</td>
              </tr>
              <tr>
                <td style="padding: 12px 0;">18-Nov-2026</td>
                <td style="font-family:'Plus Jakarta Sans';">Enterprise ARR</td>
                <td style="font-family:'Plus Jakarta Sans'; color: #fff; font-weight: 600;">Lockheed Intelligence Contract</td>
                <td><span style="padding: 2px 8px; border-radius: 4px; background: rgba(52, 211, 153, 0.15); color: #34d399; font-size: 11px;">REVENUE</span></td>
                <td style="text-align: right; color: #34d399; font-weight: 700;">+$142,500.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `,
  },

  // 5. Clinic Appointment & Patient Queue -> Dark Titanium, Neon Fuchsia & Electric Cyan (Triage)
  {
    id: 'clinic-queue-manager',
    title: 'Satchida Health · Emergency & Clinical Triage Queue',
    theme: `
      body {
        background: radial-gradient(circle at 20% 20%, #24051a 0%, #10020c 50%, #050004 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .ambient-glow-fuchsia {
        position: fixed; top: -80px; left: 10%; width: 550px; height: 550px;
        background: radial-gradient(circle, rgba(236, 72, 153, 0.22) 0%, transparent 70%);
        filter: blur(90px); pointer-events: none;
      }
      .triage-card {
        background: rgba(26, 6, 20, 0.75);
        backdrop-filter: blur(28px) saturate(210%);
        border: 1px solid rgba(244, 114, 182, 0.35);
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(251, 207, 232, 0.25);
        border-radius: 20px;
      }
    `,
    html: `
      <div class="ambient-glow-fuchsia"></div>
      <div style="max-width: 1280px; margin: 0 auto; position: relative; z-index: 2;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.4); font-size: 11px; font-weight: 700; color: #f472b6;">
              ● Level-1 Trauma & Super-Speciality Triage Board
            </div>
            <h1 style="font-size: 32px; font-weight: 800; margin-top: 10px; color: #fff;">Patient Flow & Token Dispatch Deck</h1>
          </div>
          <button style="padding: 10px 22px; border-radius: 12px; background: linear-gradient(135deg, #ec4899, #be185d); color: #fff; font-weight: 700; font-size: 13px; border: none; box-shadow: 0 8px 24px rgba(236, 72, 153, 0.4);">+ Issue Emergency Token</button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 24px;">
          <!-- Active Token Calling -->
          <div class="triage-card" style="padding: 32px; text-align: center; border: 2px solid #ec4899;">
            <div style="font-size: 12px; font-weight: 800; color: #f472b6; letter-spacing: 2px; text-transform: uppercase;">Now In Consultation</div>
            <div class="mono" style="font-size: 72px; font-weight: 900; color: #fff; text-shadow: 0 0 35px rgba(236, 72, 153, 0.6); margin: 16px 0;">#024</div>
            <div style="font-size: 18px; font-weight: 700; color: #fbcfe8;">Dr. Rajesh Mehta, MD</div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Cabin 3 · Cardiology & Echo Lab</div>
            <div style="margin-top: 24px; padding: 12px; background: rgba(236, 72, 153, 0.15); border-radius: 12px; font-size: 12px; color: #f472b6; font-weight: 600;">
              Duration: 12m 45s · Patient Vitals Stable (BP 124/82)
            </div>
          </div>

          <!-- Queue Table -->
          <div class="triage-card" style="padding: 24px;">
            <div style="font-size: 13px; font-weight: 700; color: #f472b6; text-transform: uppercase; margin-bottom: 16px;">Next In Queue (Walk-in & Scheduled)</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="color: #f472b6; border-bottom: 1px solid rgba(244, 114, 182, 0.2); text-align: left;">
                  <th style="padding: 10px 0;">Token</th>
                  <th>Patient Name</th>
                  <th>Age/Gender</th>
                  <th>Department</th>
                  <th style="text-align: right;">Status</th>
                </tr>
              </thead>
              <tbody class="mono" style="color: #e2e8f0;">
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 14px 0; font-weight: 800; color: #38bdf8;">#025</td>
                  <td style="font-family:'Plus Jakarta Sans'; font-weight: 700; color: #fff;">Ananya Deshmukh</td>
                  <td>34 / F</td>
                  <td style="font-family:'Plus Jakarta Sans';">Cardiology</td>
                  <td style="text-align: right;"><span style="padding: 3px 8px; border-radius: 6px; background: rgba(34, 197, 94, 0.2); color: #4ade80; font-weight: 700;">NEXT CALL</span></td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 14px 0; font-weight: 800; color: #f472b6;">#026</td>
                  <td style="font-family:'Plus Jakarta Sans'; font-weight: 700; color: #fff;">Vikram Malhotra</td>
                  <td>58 / M</td>
                  <td style="font-family:'Plus Jakarta Sans';">Neurology</td>
                  <td style="text-align: right;"><span style="padding: 3px 8px; border-radius: 6px; background: rgba(234, 179, 8, 0.2); color: #facc15; font-weight: 700;">WAITING</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
  },

  // 6. Diagnostics & Lab Panel -> Deep Marine Navy & Electric Teal (Genomic & Pathology Biomarkers)
  {
    id: 'lab-prescription-portal',
    title: 'Satchida Pathology · Genomic & Biomarker Lab Suite',
    theme: `
      body {
        background: radial-gradient(circle at 10% 80%, #03252e 0%, #021217 55%, #01080a 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .ambient-glow-teal {
        position: fixed; top: -100px; right: -50px; width: 600px; height: 600px;
        background: radial-gradient(circle, rgba(20, 184, 166, 0.25) 0%, transparent 70%);
        filter: blur(100px); pointer-events: none;
      }
      .teal-glass {
        background: rgba(4, 28, 36, 0.75);
        backdrop-filter: blur(28px) saturate(200%);
        border: 1px solid rgba(45, 212, 191, 0.35);
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(204, 251, 241, 0.25);
        border-radius: 20px;
      }
    `,
    html: `
      <div class="ambient-glow-teal"></div>
      <div style="max-width: 1280px; margin: 0 auto; position: relative; z-index: 2;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px; background: rgba(20, 184, 166, 0.15); border: 1px solid rgba(45, 212, 191, 0.4); font-size: 11px; font-weight: 700; color: #2dd4bf;">
              NABL & CAP Accredited High-Complexity Pathology
            </div>
            <h1 style="font-size: 32px; font-weight: 800; margin-top: 10px; color: #fff;">Automated Biomarker & Diagnostic Panel</h1>
          </div>
          <button style="padding: 10px 22px; border-radius: 12px; background: linear-gradient(135deg, #14b8a6, #0d9488); color: #fff; font-weight: 700; font-size: 13px; border: none; box-shadow: 0 8px 24px rgba(20, 184, 166, 0.35);">Print Verified PDF</button>
        </div>

        <div class="teal-glass" style="padding: 28px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(45, 212, 191, 0.2); padding-bottom: 16px; margin-bottom: 20px;">
            <div>
              <div style="font-size: 18px; font-weight: 800; color: #fff;">Patient: Mr. Arvind Kulkarni</div>
              <div class="mono" style="font-size: 12px; color: #99f6e4;">UHID: 9812-4019 · Sample: Whole Blood EDTA (Fasting)</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: #2dd4bf; font-weight: 700;">Analyzed: Roche Cobas 8000</div>
              <div class="mono" style="font-size: 12px; color: #94a3b8;">Ref Doctor: Dr. S. K. Joshi</div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="color: #2dd4bf; border-bottom: 1px solid rgba(45, 212, 191, 0.3); text-align: left;">
                <th style="padding: 12px 0;">Biomarker Test</th>
                <th>Observed Value</th>
                <th>Units</th>
                <th>Biological Reference Interval</th>
                <th style="text-align: right;">Clinical Flag</th>
              </tr>
            </thead>
            <tbody class="mono" style="color: #e2e8f0;">
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 14px 0; font-family:'Plus Jakarta Sans'; font-weight: 700; color: #fff;">Fasting Plasma Glucose (Hexokinase)</td>
                <td style="color: #f43f5e; font-weight: 800; font-size: 15px;">138</td>
                <td style="color: #94a3b8;">mg/dL</td>
                <td>70 - 99</td>
                <td style="text-align: right;"><span style="padding: 3px 8px; border-radius: 6px; background: rgba(244, 63, 94, 0.2); color: #fb7185; font-weight: 800;">HIGH ALERT</span></td>
              </tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 14px 0; font-family:'Plus Jakarta Sans'; font-weight: 700; color: #fff;">Glycated Hemoglobin (HbA1c) HPLC</td>
                <td style="color: #fbbf24; font-weight: 800; font-size: 15px;">6.8</td>
                <td style="color: #94a3b8;">%</td>
                <td>&lt; 5.7</td>
                <td style="text-align: right;"><span style="padding: 3px 8px; border-radius: 6px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; font-weight: 800;">ELEVATED</span></td>
              </tr>
              <tr>
                <td style="padding: 14px 0; font-family:'Plus Jakarta Sans'; font-weight: 700; color: #fff;">Serum Creatinine (Enzymatic)</td>
                <td style="color: #2dd4bf; font-weight: 800; font-size: 15px;">0.92</td>
                <td style="color: #94a3b8;">mg/dL</td>
                <td>0.70 - 1.20</td>
                <td style="text-align: right;"><span style="padding: 3px 8px; border-radius: 6px; background: rgba(45, 212, 191, 0.2); color: #2dd4bf; font-weight: 800;">NORMAL</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `,
  },

  // 7. School Attendance & Gradebook -> Deep Royal Cobalt & Warm Sunset Ochre (Prestigious Academy)
  {
    id: 'student-attendance-gradebook',
    title: 'Satchida Academy · K-12 Honors Transcript & Attendance Engine',
    theme: `
      body {
        background: radial-gradient(circle at 80% 80%, #0f1c3f 0%, #070e24 55%, #020512 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .cobalt-glass {
        background: rgba(12, 24, 60, 0.75);
        backdrop-filter: blur(28px) saturate(200%);
        border: 1px solid rgba(96, 165, 250, 0.35);
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(191, 219, 254, 0.25);
        border-radius: 20px;
      }
    `,
    html: `
      <div style="max-width: 1280px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px; background: rgba(96, 165, 250, 0.15); border: 1px solid rgba(96, 165, 250, 0.4); font-size: 11px; font-weight: 700; color: #93c5fd;">
              Grade 12 Advanced STEM Cohort · Term-1 Official Roster
            </div>
            <h1 style="font-size: 32px; font-weight: 800; margin-top: 10px; color: #fff;">Student Performance & Attendance Registry</h1>
          </div>
          <button style="padding: 10px 22px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; font-weight: 700; font-size: 13px; border: none; box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);">+ Mark Daily Roll Call</button>
        </div>

        <div class="cobalt-glass" style="padding: 28px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="color: #93c5fd; border-bottom: 1px solid rgba(96, 165, 250, 0.25); text-align: left;">
                <th style="padding: 12px 0;">Roll #</th>
                <th>Student Full Name</th>
                <th>Term Attendance</th>
                <th>Maths (100)</th>
                <th>Physics (100)</th>
                <th>Computer Science (100)</th>
                <th style="text-align: right;">Cumulative GPA</th>
              </tr>
            </thead>
            <tbody class="mono" style="color: #e2e8f0;">
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 14px 0; color: #93c5fd; font-weight: 700;">#101</td>
                <td style="font-family:'Plus Jakarta Sans'; font-weight: 700; color: #fff;">Aarav Patil</td>
                <td style="color: #4ade80;">96% (Present)</td>
                <td>95</td>
                <td>92</td>
                <td>98</td>
                <td style="text-align: right; color: #fbbf24; font-weight: 800; font-size: 15px;">9.8 / 10 (A+)</td>
              </tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 14px 0; color: #93c5fd; font-weight: 700;">#102</td>
                <td style="font-family:'Plus Jakarta Sans'; font-weight: 700; color: #fff;">Bhavna Sen</td>
                <td style="color: #4ade80;">94% (Present)</td>
                <td>88</td>
                <td>90</td>
                <td>94</td>
                <td style="text-align: right; color: #fbbf24; font-weight: 800; font-size: 15px;">9.4 / 10 (A)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `,
  },

  // 8. Interactive Quiz & Exam Studio -> Dark Nebula Plum & Cyber Mint (High-Stakes Examination Arena)
  {
    id: 'interactive-quiz-builder',
    title: 'Satchida Exam · High-Stakes Certification Arena',
    theme: `
      body {
        background: radial-gradient(circle at 50% 20%, #1e0933 0%, #0d0217 55%, #05000a 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .exam-glass {
        background: rgba(22, 5, 38, 0.75);
        backdrop-filter: blur(28px) saturate(210%);
        border: 1px solid rgba(167, 139, 250, 0.35);
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(221, 214, 254, 0.25);
        border-radius: 20px;
      }
      .choice-btn {
        background: rgba(30, 10, 52, 0.6);
        border: 1px solid rgba(167, 139, 250, 0.25);
        border-radius: 14px; padding: 16px 20px;
        color: #fff; font-size: 14px; text-align: left; cursor: pointer;
        transition: all 0.2s ease;
      }
      .choice-btn.selected {
        background: rgba(52, 211, 153, 0.2);
        border-color: #34d399; color: #6ee7b7; font-weight: 700;
        box-shadow: 0 0 20px rgba(52, 211, 153, 0.3);
      }
    `,
    html: `
      <div style="max-width: 900px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <div style="font-size: 11px; font-weight: 800; color: #a78bfa; text-transform: uppercase; letter-spacing: 1px;">Sovereign AI Architect Certification</div>
            <h1 style="font-size: 26px; font-weight: 800; margin-top: 6px; color: #fff;">Question 04 of 25</h1>
          </div>
          <div class="mono" style="padding: 8px 18px; border-radius: 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; font-weight: 800; font-size: 16px;">
            ⏱ 14:38 REMAINING
          </div>
        </div>

        <div class="exam-glass" style="padding: 32px;">
          <div style="font-size: 17px; font-weight: 600; line-height: 1.6; color: #f8fafc; margin-bottom: 24px;">
            When deploying a multi-tenant sovereign inference node behind symmetric CGNAT without VPS relays, which physical transport invariant guarantees zero credential leak to client endpoints?
          </div>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div class="choice-btn">A) Wireguard site-to-site bridge with public static IP forwarding</div>
            <div class="choice-btn selected">B) Cloudflare Zero Trust Named Tunnel (cloudflared) terminating on a local proxy with runtime JWT bearer injection</div>
            <div class="choice-btn">C) Client-side direct OpenAI API key configuration in browser localStorage</div>
            <div class="choice-btn">D) Public Dynamic DNS with UPnP automatic port-mapping</div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 32px;">
            <button style="padding: 10px 20px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #94a3b8; font-weight: 600; font-size: 13px;">Previous Question</button>
            <button style="padding: 10px 24px; border-radius: 10px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; font-size: 13px; border: none; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);">Lock Answer & Proceed →</button>
          </div>
        </div>
      </div>
    `,
  },

  // 9. Inventory & POS Desk -> Dark Slate & Safety Orange (Industrial Retail Flagship Desk)
  {
    id: 'inventory-pos-dashboard',
    title: 'Satchida Retail · Industrial Barcode POS & SKU Cash Desk',
    theme: `
      body {
        background: radial-gradient(circle at 75% 25%, #291503 0%, #120901 55%, #050300 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .orange-glass {
        background: rgba(28, 14, 3, 0.75);
        backdrop-filter: blur(28px) saturate(200%);
        border: 1px solid rgba(249, 115, 22, 0.35);
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(254, 215, 170, 0.25);
        border-radius: 20px;
      }
    `,
    html: `
      <div style="max-width: 1280px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px; background: rgba(249, 115, 22, 0.15); border: 1px solid rgba(249, 115, 22, 0.4); font-size: 11px; font-weight: 700; color: #fb923c;">
              Terminal #04 · Flagship Hardware Checkout
            </div>
            <h1 style="font-size: 32px; font-weight: 800; margin-top: 10px; color: #fff;">High-Throughput Inventory & Barcode POS</h1>
          </div>
          <div class="mono" style="font-size: 13px; color: #fdba74;">BARCODE SCANNER READY [HID USB]</div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
          <!-- SKU Table -->
          <div class="orange-glass" style="padding: 24px;">
            <div style="font-size: 13px; font-weight: 700; color: #fb923c; text-transform: uppercase; margin-bottom: 16px;">Active In-Store SKU Catalog</div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
              <div style="padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(249, 115, 22, 0.2); border-radius: 12px;">
                <div style="font-size: 14px; font-weight: 700; color: #fff;">USB-C 100W GaN Charging Dock</div>
                <div class="mono" style="font-size: 12px; color: #94a3b8; margin: 4px 0 10px;">SKU: CHG-100-PRO · Stock: 84 units</div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span class="mono" style="font-size: 18px; font-weight: 800; color: #fb923c;">$49.99</span>
                  <button style="padding: 6px 14px; border-radius: 8px; background: #ea580c; color: #fff; font-weight: 700; font-size: 12px; border: none;">+ Add</button>
                </div>
              </div>
              <div style="padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(249, 115, 22, 0.2); border-radius: 12px;">
                <div style="font-size: 14px; font-weight: 700; color: #fff;">Gasket Mechanical Studio Keyboard</div>
                <div class="mono" style="font-size: 12px; color: #94a3b8; margin: 4px 0 10px;">SKU: KEY-MECH-98 · Stock: 16 units</div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span class="mono" style="font-size: 18px; font-weight: 800; color: #fb923c;">$129.00</span>
                  <button style="padding: 6px 14px; border-radius: 8px; background: #ea580c; color: #fff; font-weight: 700; font-size: 12px; border: none;">+ Add</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Checkout Cart -->
          <div class="orange-glass" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #fb923c; text-transform: uppercase; margin-bottom: 16px;">Current Register Order (2 Items)</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px;">
                <span>1x GaN 100W Dock</span>
                <span class="mono" style="font-weight: 700;">$49.99</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 13px;">
                <span>1x Gasket Studio Keyboard</span>
                <span class="mono" style="font-weight: 700;">$129.00</span>
              </div>
              <div style="border-top: 1px solid rgba(249, 115, 22, 0.3); padding-top: 16px;">
                <span style="font-size: 11px; text-transform: uppercase; color: #fb923c; font-weight: 800;">Total Payable (incl. Sales Tax)</span>
                <div class="mono" style="font-size: 34px; font-weight: 800; color: #fff; margin-top: 4px;">$178.99</div>
              </div>
            </div>
            <button style="width: 100%; padding: 14px; border-radius: 12px; background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; font-weight: 800; font-size: 14px; border: none; box-shadow: 0 8px 24px rgba(249, 115, 22, 0.4); margin-top: 24px;">Charge Customer via UPI / Card</button>
          </div>
        </div>
      </div>
    `,
  },

  // 10. Product Catalog & Order Storefront -> Pure Minimalist Carbon & Brushed Bronze (Boutique Hardware)
  {
    id: 'product-catalog-storefront',
    title: 'Satchida Atelier · High-Craft Architectural Studio Storefront',
    theme: `
      body {
        background: #080808;
        min-height: 100vh;
        padding: 32px;
      }
      .carbon-card {
        background: #111111;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.8);
      }
    `,
    html: `
      <div style="max-width: 1280px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px;">
          <div>
            <span class="mono" style="font-size: 11px; color: #a1a1aa; letter-spacing: 2px;">EDITION 2026 // ATELIER HARDWARE</span>
            <h1 class="serif" style="font-size: 38px; color: #fff; margin-top: 6px;">Precision Acoustic & Display Engineering</h1>
          </div>
          <div style="display: flex; gap: 10px;">
            <button style="padding: 8px 18px; border-radius: 999px; background: #fff; color: #000; font-weight: 700; font-size: 12px; border: none;">Curated Releases</button>
            <button style="padding: 8px 18px; border-radius: 999px; background: transparent; color: #a1a1aa; font-weight: 600; font-size: 12px; border: 1px solid rgba(255,255,255,0.15);">Technical Specs</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;">
          <div class="carbon-card" style="padding: 24px;">
            <div style="height: 180px; background: linear-gradient(135deg, #1c1917, #292524); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 48px;">🖥️</div>
            <div style="margin-top: 18px;">
              <h3 style="font-size: 18px; font-weight: 700; color: #fff;">27" 5K Retina Reference Monitor</h3>
              <p style="font-size: 12px; color: #a1a1aa; margin: 6px 0 16px;">True 10-bit IPS panel, 99% DCI-P3 color calibration for digital colorists.</p>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="mono" style="font-size: 20px; font-weight: 800; color: #fff;">$1,299.00</span>
                <button style="padding: 8px 16px; border-radius: 8px; background: #fff; color: #000; font-weight: 700; font-size: 12px; border: none;">Order</button>
              </div>
            </div>
          </div>

          <div class="carbon-card" style="padding: 24px;">
            <div style="height: 180px; background: linear-gradient(135deg, #1c1917, #292524); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 48px;">🎧</div>
            <div style="margin-top: 18px;">
              <h3 style="font-size: 18px; font-weight: 700; color: #fff;">Planar Magnetic Studio Cans</h3>
              <p style="font-size: 12px; color: #a1a1aa; margin: 6px 0 16px;">Open-back precision diaphragms tuned for spatial audio mixing.</p>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="mono" style="font-size: 20px; font-weight: 800; color: #fff;">$549.00</span>
                <button style="padding: 8px 16px; border-radius: 8px; background: #fff; color: #000; font-weight: 700; font-size: 12px; border: none;">Order</button>
              </div>
            </div>
          </div>

          <div class="carbon-card" style="padding: 24px;">
            <div style="height: 180px; background: linear-gradient(135deg, #1c1917, #292524); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 48px;">⌨️</div>
            <div style="margin-top: 18px;">
              <h3 style="font-size: 18px; font-weight: 700; color: #fff;">Solid Brass Split Macro Deck</h3>
              <p style="font-size: 12px; color: #a1a1aa; margin: 6px 0 16px;">CNC milled from solid billet C360 brass with haptic rotary dials.</p>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="mono" style="font-size: 20px; font-weight: 800; color: #fff;">$380.00</span>
                <button style="padding: 8px 16px; border-radius: 8px; background: #fff; color: #000; font-weight: 700; font-size: 12px; border: none;">Order</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  // 11. Case Docket & Hearing Tracker -> Warm Dark Mahogany, Parchment & Crimson (Barrister Chambers)
  {
    id: 'legal-case-docket',
    title: 'Satchida Juris · High Court Litigation & Hearing Docket',
    theme: `
      body {
        background: radial-gradient(circle at 20% 20%, #2e0808 0%, #170404 55%, #080101 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .juris-card {
        background: rgba(32, 8, 8, 0.75);
        backdrop-filter: blur(28px) saturate(200%);
        border: 1px solid rgba(239, 68, 68, 0.35);
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(254, 202, 202, 0.25);
        border-radius: 20px;
      }
    `,
    html: `
      <div style="max-width: 1280px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); font-size: 11px; font-weight: 700; color: #f87171;">
              Senior Counsel Chambers · Supreme Court & High Court Registry
            </div>
            <h1 class="serif" style="font-size: 34px; margin-top: 10px; color: #fff;">Litigation Docket & Hearing Calendar</h1>
          </div>
          <button style="padding: 10px 22px; border-radius: 12px; background: linear-gradient(135deg, #dc2626, #991b1b); color: #fff; font-weight: 700; font-size: 13px; border: none; box-shadow: 0 8px 24px rgba(220, 38, 38, 0.4);">+ File Fresh Special Leave Petition</button>
        </div>

        <div class="juris-card" style="padding: 28px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="color: #fca5a5; border-bottom: 1px solid rgba(239, 68, 68, 0.25); text-align: left;">
                <th style="padding: 12px 0;">Case Suit #</th>
                <th>Matter Title</th>
                <th>Court / Bench</th>
                <th>Next Hearing Date</th>
                <th>Presiding Judge</th>
                <th style="text-align: right;">Matter Stage</th>
              </tr>
            </thead>
            <tbody class="mono" style="color: #f8fafc;">
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 14px 0; color: #f87171; font-weight: 800;">WP 1402/2026</td>
                <td style="font-family:'Plus Jakarta Sans'; font-weight: 700; color: #fff;">Tata Motors vs Union of India</td>
                <td style="font-family:'Plus Jakarta Sans';">Bombay High Court (Bench 1)</td>
                <td style="color: #facc15; font-weight: 700;">22 Nov 2026 (Urgent)</td>
                <td style="font-family:'Plus Jakarta Sans';">Hon. Justice D. Y. Patil</td>
                <td style="text-align: right;"><span style="padding: 3px 8px; border-radius: 6px; background: rgba(239, 68, 68, 0.2); color: #fca5a5; font-weight: 800;">FINAL ARGUMENTS</span></td>
              </tr>
              <tr>
                <td style="padding: 14px 0; color: #f87171; font-weight: 800;">ARB 83/2026</td>
                <td style="font-family:'Plus Jakarta Sans'; font-weight: 700; color: #fff;">Reliance Retail vs Infra Ltd</td>
                <td style="font-family:'Plus Jakarta Sans';">Arbitral Tribunal</td>
                <td style="color: #e2e8f0;">28 Nov 2026</td>
                <td style="font-family:'Plus Jakarta Sans';">Sole Arbitrator (Retd. SCJ)</td>
                <td style="text-align: right;"><span style="padding: 3px 8px; border-radius: 6px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: 800;">CROSS-EXAMINATION</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `,
  },

  // 12. Compliance & Policy Audit Board -> Deep Stealth Charcoal, Electric Purple & Neon Green (ISO 27001 & DPDPA SOC)
  {
    id: 'compliance-audit-checklist',
    title: 'Satchida Trust · ISO 27001 & DPDPA Readiness Center',
    theme: `
      body {
        background: radial-gradient(circle at 80% 20%, #150626 0%, #090212 55%, #020005 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .audit-glass {
        background: rgba(18, 5, 30, 0.75);
        backdrop-filter: blur(28px) saturate(200%);
        border: 1px solid rgba(168, 85, 247, 0.35);
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(233, 213, 255, 0.25);
        border-radius: 20px;
      }
    `,
    html: `
      <div style="max-width: 1280px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.4); font-size: 11px; font-weight: 700; color: #c084fc;">
              Zero-Trust Audit Framework · 92% Ready
            </div>
            <h1 style="font-size: 32px; font-weight: 800; margin-top: 10px; color: #fff;">ISO 27001 & DPDPA Act Compliance Board</h1>
          </div>
          <button style="padding: 10px 22px; border-radius: 12px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; font-size: 13px; border: none; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);">Run Automated Evidence Audit</button>
        </div>

        <div class="audit-glass" style="padding: 28px;">
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: rgba(255,255,255,0.03); border-radius: 12px; border-left: 4px solid #10b981;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: #fff;">A.12.1.2 Physical Tenant Isolation & Bare-Metal MongoDB Verification</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Dedicated SQLite/Mongo instance per customer verified with zero commingling.</div>
              </div>
              <span style="font-size: 12px; padding: 4px 12px; border-radius: 999px; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 800;">PASS (100%)</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: rgba(255,255,255,0.03); border-radius: 12px; border-left: 4px solid #10b981;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: #fff;">A.9.2.1 Zero-Knowledge Master Credential Protection</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">No cloud API keys exist on edge client nodes. Runtime injection verified via Seller Central.</div>
              </div>
              <span style="font-size: 12px; padding: 4px 12px; border-radius: 999px; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 800;">PASS (100%)</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: rgba(255,255,255,0.03); border-radius: 12px; border-left: 4px solid #f59e0b;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: #fff;">A.17.1.1 Disaster Recovery Drill (Scheduled for 25 Nov 2026)</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Live failover drill from primary node to secondary local standby node.</div>
              </div>
              <span style="font-size: 12px; padding: 4px 12px; border-radius: 999px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-weight: 800;">PENDING SIGN-OFF</span>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  // 13. Team Kanban Board -> Deep Space Indigo & Coral Pink (High-Velocity Sprint)
  {
    id: 'team-kanban-board',
    title: 'Satchida Sprint · Autonomous Agent & Team Kanban',
    theme: `
      body {
        background: radial-gradient(circle at 50% 10%, #15103a 0%, #09061c 55%, #03020a 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .kanban-glass {
        background: rgba(17, 12, 45, 0.75);
        backdrop-filter: blur(28px) saturate(200%);
        border: 1px solid rgba(129, 140, 248, 0.35);
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(199, 210, 254, 0.25);
        border-radius: 20px;
      }
    `,
    html: `
      <div style="max-width: 1320px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px; background: rgba(129, 140, 248, 0.15); border: 1px solid rgba(129, 140, 248, 0.4); font-size: 11px; font-weight: 700; color: #a5b4fc;">
              Sprint 42 · 18 Story Points Committed
            </div>
            <h1 style="font-size: 32px; font-weight: 800; margin-top: 10px; color: #fff;">Distributed Engineering & Agent Kanban</h1>
          </div>
          <button style="padding: 10px 22px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; font-weight: 700; font-size: 13px; border: none; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);">+ Dispatch Autonomous Agent Task</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <div class="kanban-glass" style="padding: 20px;">
            <div style="font-size: 13px; font-weight: 700; color: #a5b4fc; text-transform: uppercase; margin-bottom: 14px;">In Progress (Agent Subswarms)</div>
            <div style="padding: 16px; background: rgba(255,255,255,0.04); border-radius: 12px; margin-bottom: 12px; border-left: 3px solid #6366f1;">
              <div style="font-size: 14px; font-weight: 700; color: #fff;">Llama-server Flash Attention Kernel Optimization</div>
              <div style="font-size: 12px; color: #94a3b8; margin: 4px 0 10px;">Subagent: CUDA-Optimizer · Port :8080</div>
              <span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: rgba(99, 102, 241, 0.2); color: #a5b4fc; font-weight: 700;">DEV COMPLETE</span>
            </div>
          </div>
          <div class="kanban-glass" style="padding: 20px;">
            <div style="font-size: 13px; font-weight: 700; color: #34d399; text-transform: uppercase; margin-bottom: 14px;">Under Verification & Lighthouse</div>
            <div style="padding: 16px; background: rgba(255,255,255,0.04); border-radius: 12px; margin-bottom: 12px; border-left: 3px solid #34d399;">
              <div style="font-size: 14px; font-weight: 700; color: #fff;">Multi-Tenant Seat Token Rate Admission</div>
              <div style="font-size: 12px; color: #94a3b8; margin: 4px 0 10px;">Zero 503 Policy Verification on One-API</div>
              <span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: rgba(52, 211, 153, 0.2); color: #34d399; font-weight: 700;">PASSING CI</span>
            </div>
          </div>
          <div class="kanban-glass" style="padding: 20px;">
            <div style="font-size: 13px; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 14px;">Shipped to Production</div>
            <div style="padding: 16px; background: rgba(255,255,255,0.04); border-radius: 12px; border-left: 3px solid #38bdf8;">
              <div style="font-size: 14px; font-weight: 700; color: #fff;">1-Click Multi-Domain Starter Gallery (14 Apps)</div>
              <div style="font-size: 12px; color: #94a3b8; margin: 4px 0 10px;">Retina 2x Thumbnails & Full-Stack Runners</div>
              <span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: 700;">LIVE IN FLEET</span>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  // 14. HR Leave & Shift Roster -> Dark Nordic Spruce, Copper & Powder Sage (Workforce Dispatch)
  {
    id: 'hr-leave-shift-roster',
    title: 'Satchida People · Enterprise 24/7 Shift & Leave Roster',
    theme: `
      body {
        background: radial-gradient(circle at 10% 20%, #0a2118 0%, #04100b 55%, #010503 100%);
        min-height: 100vh;
        padding: 32px;
      }
      .hr-glass {
        background: rgba(8, 26, 18, 0.75);
        backdrop-filter: blur(28px) saturate(200%);
        border: 1px solid rgba(52, 211, 153, 0.35);
        box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(167, 243, 208, 0.25);
        border-radius: 20px;
      }
    `,
    html: `
      <div style="max-width: 1280px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px; background: rgba(52, 211, 153, 0.15); border: 1px solid rgba(52, 211, 153, 0.4); font-size: 11px; font-weight: 700; color: #6ee7b7;">
              Critical Operations Shift Roster · 3 Shifts / 24 Hours
            </div>
            <h1 style="font-size: 32px; font-weight: 800; margin-top: 10px; color: #fff;">Workforce Attendance & Shift Dispatch</h1>
          </div>
          <button style="padding: 10px 22px; border-radius: 12px; background: linear-gradient(135deg, #059669, #047857); color: #fff; font-weight: 700; font-size: 13px; border: none; box-shadow: 0 8px 24px rgba(5, 150, 105, 0.4);">+ Approve Shift Swap</button>
        </div>

        <div class="hr-glass" style="padding: 28px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="color: #6ee7b7; border-bottom: 1px solid rgba(52, 211, 153, 0.25); text-align: left;">
                <th style="padding: 12px 0;">Staff ID</th>
                <th>Employee Name</th>
                <th>Assigned Role</th>
                <th>Shift Window</th>
                <th>On-Call Status</th>
                <th style="text-align: right;">Coverage Check</th>
              </tr>
            </thead>
            <tbody class="mono" style="color: #e2e8f0;">
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 14px 0; color: #6ee7b7; font-weight: 700;">EMP-892</td>
                <td style="font-family:'Plus Jakarta Sans'; font-weight: 700; color: #fff;">Suresh Narang</td>
                <td style="font-family:'Plus Jakarta Sans';">Senior SRE Lead</td>
                <td>Morning (07:00 - 15:30)</td>
                <td><span style="padding: 3px 8px; border-radius: 6px; background: rgba(34, 197, 94, 0.2); color: #4ade80; font-weight: 700;">ON DUTY</span></td>
                <td style="text-align: right; color: #4ade80; font-weight: 700;">✓ 100% Manning</td>
              </tr>
              <tr>
                <td style="padding: 14px 0; color: #6ee7b7; font-weight: 700;">EMP-904</td>
                <td style="font-family:'Plus Jakarta Sans'; font-weight: 700; color: #fff;">Priya Shenoy</td>
                <td style="font-family:'Plus Jakarta Sans';">Security Incident Analyst</td>
                <td>Evening (15:00 - 23:30)</td>
                <td><span style="padding: 3px 8px; border-radius: 6px; background: rgba(234, 179, 8, 0.2); color: #facc15; font-weight: 700;">UPCOMING</span></td>
                <td style="text-align: right; color: #38bdf8; font-weight: 700;">Confirmed</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `,
  },
];

// Write out all 14 files and take high-DPI screenshots
async function generateAll() {
  console.log('Writing 14 standalone enterprise templates to disk...');
  for (const item of STARTERS) {
    const dir = path.join(templatesDir, item.id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const fullHtml = wrapHtml(item.title, item.theme, item.html);
    fs.writeFileSync(path.join(dir, 'index.html'), fullHtml, 'utf8');

    // server.mjs
    const serverCode = `import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4100;

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Error loading template');
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`[Starter] \${path.basename(__dirname)} listening on http://0.0.0.0:\${PORT}\`);
});
`;
    fs.writeFileSync(path.join(dir, 'server.mjs'), serverCode, 'utf8');
  }

  console.log('Launching Playwright for ultra-crisp 2x high-DPI thumbnail rendering...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 860 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  for (const item of STARTERS) {
    const htmlPath = path.join(templatesDir, item.id, 'index.html');
    const fileUrl = 'file:///' + htmlPath.replace(/\\\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.waitForTimeout(300); // Allow font rendering

    const publicOut = path.join(publicThumbnailsDir, `${item.id}.png`);
    const distOut = path.join(distThumbnailsDir, `${item.id}.png`);

    const imgBuffer = await page.screenshot({ type: 'png', fullPage: false });
    fs.writeFileSync(publicOut, imgBuffer);
    fs.writeFileSync(distOut, imgBuffer);
    console.log(`Rendered & synced high-DPI thumbnail: ${item.id}.png`);
  }

  await browser.close();
  console.log('Successfully completed high-DPI rendering for all 14 enterprise templates.');
}

generateAll().catch((err) => {
  console.error('Fatal generation error:', err);
  process.exit(1);
});
