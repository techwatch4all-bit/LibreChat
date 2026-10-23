# Satchida AI Platform — Client Proposal

**Prepared for:** Residential Welfare Associations, Small & Medium Businesses, Schools, and Institutions
**Prepared by:** Satchida · Privacy-first AI infrastructure for organisations and their communities

---

## 1. The problem we solve

Your residents, employees, and students need access to modern AI tools. The problem is that every
widely available AI assistant comes with a trade-off your committee has already had to consider:

- **Your users' data goes to a third-party company.** Prompts, documents and personal information
  are transmitted to an external provider and retained under that provider's policies.
- **The provider knows exactly who your users are.** They hold the account, the email address and
  the full interaction history.
- **It is expensive and unpredictable**, and you have no control over it.
- **There is no audit.** You cannot tell your residents where their data went.

For a housing society, a school, or an SMB handling personal data of staff and customers, these
are not acceptable constraints.

---

## 2. What we propose

A **private AI platform installed on your own hardware, inside your own premises and network.**

Your organisation buys one server. The platform runs entirely on it. Conversations, documents and
user accounts stay on your infrastructure and on your internet connection. We supply the software,
the installation, the maintenance, and the updates — the same model by which you would engage any
managed service provider, and directly analogous to how you deploy CCTV.

**There is no per-user licence fee. There is one fixed annual service charge.**

---

## 3. What your users experience

Users sign in from any device — phone, tablet or laptop — over your network, using a browser or an
installable app. There is nothing to install on their device.

They choose how they want to work:

| Mode | For | Where it runs |
|---|---|---|
| **Chat** | Everyday questions, drafting, summaries | Your server, with optional cloud assist |
| **Work** | Difficult tasks needing the strongest available answer | Your server, with optional cloud assist |
| **Privacy** | Confidential material — personal, financial, legal, medical | **Your server only. Nothing leaves your premises.** |

Users never see which model answered, never see a provider name, and never need to configure
anything. They type and press enter.

**No user needs to create an account with any external AI provider.** Authentication happens on
your infrastructure.

---

## 4. What we commit to

These are commitments, not marketing. They are written into the service agreement.

1. **Your conversations are stored on hardware you own and operate. We do not access them.**
   Satchida holds a support administrator account on your instance so that we can resolve faults.
   That account is named in this agreement, every use of it is written to an access log, and that
   log is provided to you after each engagement. **In normal operation it is never used.**
2. **Your users' identity is never disclosed to any third-party AI provider.** No provider is
   told who your users are.
3. **Prompts are never used to train any model**, by us or by any provider we route to.
4. **We do not sell, share, or monetise your data** or that of your users. Ever.
5. **We do not advertise or display any AI provider or model name** to your users, and we do not
   sell your users' data to anyone.
6. **In privacy mode, your users' content is never delivered to any AI provider.** It is processed
   only on infrastructure you operate. Nothing is sent to an AI company for inference or training.
   *We should be clear: your users' browser traffic reaches your server through our network
   provider's edge, as any HTTPS traffic does. That provider proxies the connection but is
   never given a user's identity by us.*
7. **You can request deletion of any user or conversation** at any time, and we will action it
   within the agreed window.

### What we ask in return

Even in Privacy mode, users should not submit passwords, API keys, access tokens, bank or card
details, government identifiers, or medical records. A privacy-focused platform is not a channel for
confidential secrets, and the user guidance appears in the application itself. Users are
responsible for what they type — as they are with any system you operate.

---

## 5. Hardware requirements

### 5.1 Reference configuration

| Component | Minimum | Recommended |
|---|---|---|
| **Graphics card (GPU)** | NVIDIA GeForce RTX 4060 Ti 16 GB | NVIDIA RTX 5090 32 GB, or RTX 6000 Ada |
| **Processor (CPU)** | AMD Ryzen 5 7500F / 7600 (6-core) | AMD Ryzen 7 7700 / Intel Core i5-14600K |
| **Motherboard** | MSI PRO B650M-A WIFI / ASRock B650M-HDV/M.2 | MSI MAG B650 TOMAHAWK / ASUS TUF B650 |
| **Memory (RAM)** | 32 GB (2 × 16 GB) DDR5-6000 | **64 GB (2 × 32 GB) DDR5-6000** |
| **Primary storage** | 1 TB NVMe PCIe 4.0 M.2 | 2 TB NVMe PCIe 4.0 M.2 |
| **Secondary storage** | — | 1 TB SATA SSD (models, backups, logs) |
| **Power supply (PSU)** | 650 W, 80+ Bronze | 750 W, 80+ Gold |
| **Cabinet** | Mid-tower ATX, 4+ fans | Mid-tower ATX, mesh front, 4+ fans |
| **CPU cooler** | DeepCool AG400 / Thermalright Assassin X 120 | DeepCool AG620 / Thermalright PA120 |
| **Operating system** | **Windows 11 Pro (licensed)** | Windows 11 Pro (licensed) |
| **Power backup** | 1 KVA online UPS | 2 KVA online UPS |
| **Network** | Wired Ethernet, 100 Mbps | Wired Ethernet, 1 Gbps |

**Indicative hardware cost: ₹1.9 – 2.6 lakh** (excluding Windows licence and installation).

### 5.2 Notes on this specification

- **16 GB of VRAM is the true constraint**, not CPU or storage. It determines how many users can
  be served at once and which models can run locally. 16 GB is a working minimum; 32 GB is
  materially better.
- **The GPU occupies three expansion slots.** The cabinet must be a mid-tower ATX, not a compact
  or SFF case.
- **Wired Ethernet is required. Wi-Fi is not acceptable** for a server. A society or school Wi-Fi
  will not hold a stable AI service for a full working day.
- **A UPS is not optional in India.** Power cuts during an inference request corrupt the database.
  Minimum 1 KVA online.
- **Storage endurance matters.** Conversation databases write continuously. Use a decent NVMe
  drive, not a budget one.
- **Windows 11 Pro must be licensed.** Home edition cannot run the platform correctly and cannot
  join a domain for administration.
- **Do not use a laptop or all-in-one.** Sustained GPU load requires desktop cooling and a
  dedicated GPU.

### 5.3 Capacity on the minimum configuration

| Configuration | Concurrent users | Notes |
|---|---|---|
| RTX 4060 Ti 16 GB | **~6 – 10** | Comfortable for a society in off-peak hours |
| RTX 5090 32 GB | **~15 – 25** | Recommended for schools and busy SMBs |
| RTX 6000 Ada 48 GB | **~30 – 50** | Enterprise tier |

This is simultaneous active conversations, not registered users. A society with 300 flats will
comfortably serve its residents on the minimum configuration, because residents do not all chat at
the same moment. Where peak demand exceeds the figure, requests queue briefly rather than failing.

### 5.4 Important: this platform does not run on this hardware out of the box

The high-performance serving engine used in data centres is not available on Windows. The platform
therefore uses a **different, equally capable inference engine purpose-built for Windows desktop
hardware**, which we install and tune as part of the deployment.

Practically: it runs on your machine, with your hardware, to a quality standard your users will
find indistinguishable. The difference is invisible to your users and irrelevant to your
operations. We mention it only so you are not misled by third-party benchmarks.

---

## 6. Division of responsibility

| You provide | We provide |
|---|---|
| The server hardware and Windows licence | The Satchida platform, licensed and configured |
| The premises, power, and internet connection | Installation, model tuning, and performance setup |
| A named administrator to receive updates | Maintenance, monitoring, and remote support |
| Local policy on who may register as a user | The user application for phone, tablet, and laptop |
| Backups of your own choice, if you want one | Security updates and platform updates |

---

## 7. Commercial terms

### 7.1 One-time charges

| Item | Charge |
|---|---|
| Installation, configuration and commissioning | **₹75,000** |
| User onboarding and administrator training | Included |

### 7.2 Recurring service charge (AMC) — fixed, not per user

| Platform size | Monthly | **Annual (preferred)** |
|---|---|---|
| Up to 100 active users | ₹12,000 | **₹1,20,000** |
| Up to 500 active users | ₹25,000 | **₹2,50,000** |
| Up to 1,000 active users | ₹50,000 | **₹5,00,000** |
| Unlimited (education / enterprise) | Quoted | Quoted |

**The charge is fixed and does not vary with how many of your users actually use the platform.**
There is no per-seat metering, no token billing, and no surprise invoices at month end.

### 7.3 What's included in the AMC

- Hosting equipment is yours; we maintain the software
- Remote monitoring and health reporting
- Security and platform updates
- Telephone and remote support during business hours
- One scheduled on-site visit per year
- Compliance documentation, privacy policy, and user guidance
- Restoration of service if a fault arises

### 7.4 End-user subscriptions

Your users may subscribe to additional Satchida services directly. **This is arranged entirely
between Satchida and the individual user.** Your organisation is not a reseller, is not involved
in those transactions, and receives no commission.

If you would prefer not to offer this at all, tell us and we will not enable it on your platform.

### 7.5 Payment terms

- Annual, paid in advance — preferred, and carries the discount above
- Monthly, paid in advance by standing instruction or UPI
- Services commence on payment. Hardware and OS licence are procured separately by you.

---

## 8. Implementation

| Phase | Duration | What happens |
|---|---|---|
| **1. Site survey** | 2–3 days | Power, network, location, rack/desk space |
| **2. Delivery & base setup** | 1 day | Server received, OS and network configured |
| **3. Platform install** | 1 day | Platform, database, and local model installed and tuned |
| **4. Integration & test** | 1 day | Cloud assist routed, privacy mode verified, load tested |
| **5. Handover & training** | 1 day | Administrator training, user registration, go-live |
| **Total** | **5–7 working days** | |

Go-live target: within two weeks of hardware arrival.

---

## 9. What this service is not

Stated plainly, because a proposal that oversells is worse than one that under-sells.

- **It is not a guarantee of anonymity from us.** We know who your paying users are — we must, in
  order to bill them and provide support. We do not use that knowledge to read your users'
  conversations, and in the on-premise architecture we do not receive them at all.
- **It is not a guarantee that no third party ever sees any content.** In Chat and Work modes,
  requests may be passed to external AI infrastructure so that users get the best available answer.
  **Privacy mode exists precisely for when that is not acceptable.**
- **Your users' traffic passes through a network provider's servers**, because your connection
  is behind carrier-grade NAT and cannot be reached directly. That provider proxies the
  connection and sees the network metadata of it. It is not given your users' identities by us,
  and it is not an AI provider. If your legal advisers require a data processing agreement with
  that network provider, you may run the tunnel from your own account instead — we will set it up
  for you at no extra charge.
- **It does not remove the user's responsibility** for what they type or upload.
- **It is not a substitute for your organisation's own policies** on what users may do with it.

---

## 10. Why not simply install a free open-source version?

Because it is only the software. It is not the service.

| | Free open-source install | Satchida as proposed |
|---|---|---|
| Installation and tuning | Your team, or a freelancer who may never have done it | Included |
| Which model runs, and how well | Unknown — you get whatever default ships | Tuned and load-tested for your hardware |
| Privacy commitments | **None.** No promises, nobody accountable | Written into the service agreement |
| Updates and security patches | Unmaintained, and nobody is watching | Included in the AMC |
| Something to call when it breaks | Nobody | A named party, with an SLA |
| Legal exposure if it leaks | Falls on you | Shared, with us accountable |

The free version is genuinely good software. On a committee member's laptop it will run. It will
also be unconfigured, unmonitored, and unsupported — and when a resident's data is exposed, there
is no one to call.

---

## 11. Next step

We propose a **no-obligation demonstration**. We install and configure a platform on a machine of
your choosing for a trial period. Your committee and a representative group of users try it under
real conditions. You decide afterwards.

There is no cost and no commitment to proceed.

---

**Satchida** · Privacy-first AI for organisations and the communities they serve

---

<!-- MERGED-DISTRIBUTED-PART -->
## Part II - Distributed Cloudflare-Tunnel edition (supersedes any VPN/Headscale/VPS wording above)

### Satchida Managed AI Platform — Client Solution Brief

On-premises, privacy-first AI assistant built for schools, colleges, and business enterprises in India.

---

## 1. What You Get

1. **Dedicated AI Workstation (In Your Office or Campus):**
   - Runs directly on your Windows 11 desktop computer.
   - 100% private: your student records, proprietary files, and confidential queries remain on your premises.
2. **Instant Multi-Device Access:**
   - Available to your staff and students at your dedicated link (e.g., `https://yourschool.yourdomain.com`).
   - Accessible from laptops, tablets, and mobile phones (via browser or 1-tap Progressive Web App).
   - Zero software or VPN installation required for end-users.
3. **Integrated Knowledge Search (RAG):**
   - Upload internal curriculum, school circulars, employee manuals, or reference textbooks.
   - Ask questions and get citations with exact page references.
4. **Autonomous Management:**
   - Administrator controls to manage user accounts, assign roles, and request additional seat or token quotas with one click.