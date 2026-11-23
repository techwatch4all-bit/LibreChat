# Satchida Internal Documentation (HQ Only)

> **CONFIDENTIAL — NOT FOR TENANT / CLIENT DEPLOYMENTS**
> Everything in `docs/internal/` is internal to Satchida HQ (sales, contracts, pricing, architecture, operations, and planning). Tenant deployment and packaging scripts must exclude `docs/internal/`.

## Directory Structure

### `sales/` — Customer Pitch, Pricing & Commercials
- `SALES-PROPOSAL-FLAGSHIP.md` (+ `SATCHIDA-FLAGSHIP-SALES-DECK.html/.pdf`, `SATCHIDA-FLAGSHIP-A4.html/.pdf`) — Flagship Sovereign AI pitch deck & A4 brochure
- `SALES-PROPOSAL-VALUE.md` (+ `SATCHIDA-VALUE-SALES-DECK.html/.pdf`, `SATCHIDA-VALUE-A4.html/.pdf`) — Team & Productivity Value pitch deck & A4 brochure
- `SALES-OBJECTIONS.md` — Sales objection handling & competitive counter-playbooks (including BYOK / Nov 2026 OpenRouter-GMI Cloud breach)
- `PRICING-AND-COMMERCIALS.md` — Consolidated pricing, unit economics, ROI model, GST/AMC structure, and dual-revenue accountability
- `CLIENT-PROPOSAL.md` — Consolidated client solution brief, finalised technical decisions, and RAG/educational offerings

### `contracts-legal/` — Agreements & Regulatory Compliance
- `TENANT-SERVICE-AGREEMENT.md` — Signable Tenant Service Agreement + supporting contract clauses appendix
- `BILLING-PARTNER-AGREEMENT.md` — Signable Billing Agency / Partner Agreement
- `TERMS.md` & `PRIVACY.md` — User-facing Terms of Service and Privacy Policy
- `Satchida_Legal.md` — Consolidated legal & regulatory reference (DPDP Act 2023, CERT-In, GST, operator liability)
- `CHILDREN-SAFETY.md` — Consolidated POCSO Act (2012) & DPDP 2023 Rule 10 verifiable child consent & safety design

### `architecture/` — System, Security & Inference Design
- `ARCHITECTURE.md`, `CONTROL-MODEL.md`, `SECURITY-DESIGN.md` *(includes security policies)*, `VULNERABILITIES.md`
- `INFERENCE.md`, `MODEL-CATALOG.md`, `RAG-SERVICE.md`, `INDIAN-ACTS-RAG.md`, `CLOUDFLARE-ACCESS.md`
- `satchida-dashboard-design.md`, `tool-intent-spec.md`, `Tenant_prerequisite.md`

### `operations/` — Build, Deployment & Maintenance
- `DEPLOYMENT.md`, `LIBRECHAT-BUILD.md`, `RELEASE.md`, `UPSTREAM-UPDATE-PROCEDURE.md` *(includes upgrade notes)*
- `Customizations.md`, `Changes.md`, `Bugs.md` *(includes working issues & open questions)*

### `planning/` — Active Roadmaps
- `Implementation-plan.md`, `SATCHIDA-IMPROVEMENT-PLAN.md`, `todo.md`
