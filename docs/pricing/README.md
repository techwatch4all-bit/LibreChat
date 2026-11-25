# Satchida Architecture, Pricing & Governance Documentation Index

This directory centralizes the authoritative documentation, unit economics, tier quotas, and operational audit reports for the Satchida platform.

---

## 1. Pricing, Rate Cards & Unit Economics (`docs/pricing/`)

* **[Satchida_Tier_Pricing_And_Rolling_Windows.md](file:///D:/LAN-AI-Infra/LibreChat/docs/pricing/Satchida_Tier_Pricing_And_Rolling_Windows.md)**  
  Authoritative rate card, unit economics, competitive benchmarking (Midjourney, Runway, Luma, Kling), canonical seat tier quotas (Basic, Standard, Family, Pro, Pro Family, Privacy, Enterprise), 3-hour priority rolling windows, and standalone media generation pack economics.

* **[One_API_UI_Application_And_Field_Audit.md](file:///D:/LAN-AI-Infra/LibreChat/docs/pricing/One_API_UI_Application_And_Field_Audit.md)**  
  Audit and mapping of tier quotas, rolling windows, and MGU media fields into One-API's database tables (`license_tiers`, `tenant_account_plans`) and the React admin interface.

* **[Satchida_HQ_Analytics_Fix_Report.md](file:///D:/LAN-AI-Infra/LibreChat/docs/pricing/Satchida_HQ_Analytics_Fix_Report.md)**  
  Detailed resolution report on fixing the Satchida HQ tenant analytics: mode normalization (`vibecoding`, `motion`, `chat`, `work`, `privacy`, `study`), removal of `Other`/`unknown` modes, and clean seat mapping (`seat_Tenant_Admin_1e6cca`, `admin_privacy_seat_001`, `seat_Golu_8aaeab`, `seat_Mani_8aae24`).

* **[AI_Audit_And_Verification_Prompt.md](file:///D:/LAN-AI-Infra/LibreChat/docs/pricing/AI_Audit_And_Verification_Prompt.md)**  
  Autonomous verification prompt for cross-checking financial ledger sync, header propagation, and model classification across One-API, LibreChat, and Bifrost.

---

## 2. Platform Architecture & Production Plans (`docs/plans/`)

* **[PRODUCTION_PLAN.md](file:///D:/LAN-AI-Infra/LibreChat/docs/plans/PRODUCTION_PLAN.md)**  
  Production deployment and execution plan for LAN and cloud multi-tenant infrastructure.

* **[SATCHIDA_ECOSYSTEM_INVENTORY.md](file:///D:/LAN-AI-Infra/LibreChat/docs/plans/SATCHIDA_ECOSYSTEM_INVENTORY.md)**  
  Comprehensive inventory of ecosystem repositories, ports, services, processes, and network topologies.

* **[SATCHIDA-END-TO-END-ROUTING.md](file:///D:/LAN-AI-Infra/LibreChat/docs/SATCHIDA-END-TO-END-ROUTING.md)**  
  End-to-end request routing architecture from LibreChat $\rightarrow$ One-API $\rightarrow$ Bifrost $\rightarrow$ Providers.
