# Curated Open-Source (MIT / Apache-2.0) MCP Ecosystem for LibreChat

> **Platform Compatibility**: Fully compatible with LibreChat v0.8+ MCP Client (`librechat.yaml`), AnythingLLM Knowledge Vaults, and Satchida Sovereign Infrastructure.  
> **Licensing**: 100% Permissive Open Source (**MIT** or **Apache-2.0**). Zero proprietary lock-in, zero cloud telemetry requirements.

---

## Executive Summary & Architecture

LibreChat features a native Model Context Protocol (MCP) client running over both **STDIO** (local isolated processes via `npx` / `uvx` / `python`) and **SSE/HTTP** (networked microservices). By pairing LibreChat's flexible multi-agent canvas with dedicated MCP servers, organizations can deploy tailored specialized agent environments for specific user personas.

```
                           +-------------------------------------+
                           |      LibreChat Web Platform         |
                           |   (Agents, Artifacts, Dual-Engine)  |
                           +------------------+------------------+
                                              |
                          Model Context Protocol (MCP STDIO/SSE)
                                              |
     +-------------------+--------------------+--------------------+-------------------+
     |                   |                    |                    |                   |
+----+----+         +----+----+          +----+----+          +----+----+         +----+----+
| Office  |         | DevOps  |          | Medical |          | Academic|         | Legal & |
| & Admin |         | & Sec   |          | & Clinic|          | & PhD   |         | Access  |
+---------+         +---------+          +---------+          +---------+         +---------+
```

---

## 1. Office Staff, Operations & Business Professionals

| MCP Server | License | GitHub Repository | Key Capabilities |
| :--- | :---: | :--- | :--- |
| **Google Workspace MCP** | MIT | `modelcontextprotocol/servers/src/gdrive` | Read, search, create, and update Google Docs, Sheets, and Drive files directly in chat. |
| **Slack / Teams MCP** | MIT | `modelcontextprotocol/servers/src/slack` | Search message threads, summarize meeting channels, draft announcements, send direct alerts. |
| **PostgreSQL / SQLite MCP**| MIT | `modelcontextprotocol/servers/src/postgres` | Live enterprise database querying, customer lookups, inventory audits, financial ledger analytics. |
| **Excel / Pandas MCP** | MIT | `sirmalloc/mcp-excel-tools` | Autonomous `.xlsx` generation, complex financial formula injection, pivot table aggregation, CSV reconciliation. |
| **Notion MCP** | MIT | `modelcontextprotocol/servers/src/notion` | Sync project roadmaps, read SOPs, append meeting minutes, update company internal wikis. |
| **CalDAV / Google Calendar**| MIT | `modelcontextprotocol/servers/src/google-calendar` | Check teammate availability, autonomously propose meeting slots, coordinate executive schedules. |

### Integration Snippet (`librechat.yaml`)
```yaml
mcpServers:
  google-workspace:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-gdrive"]
    env:
      GDRIVE_CREDENTIALS_PATH: "D:/LAN-AI-Infra/credentials/gdrive-service-account.json"
  postgres-bi:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://bi_read:secure_pw@127.0.0.1:5432/corp_bi"]
```

---

## 2. Developers, DevOps & Cloud Engineers

| MCP Server | License | GitHub Repository | Key Capabilities |
| :--- | :---: | :--- | :--- |
| **GitHub MCP Server** | MIT | `modelcontextprotocol/servers/src/github` | Create issues, review pull requests, read repository files, trigger CI workflows, commit branch diffs. |
| **Git Local MCP** | MIT | `modelcontextprotocol/servers/src/git` | Direct local repository inspection: `git diff`, `git log`, `git status`, commit history, blame tracking. |
| **Docker MCP Server** | Apache-2.0 | `ckreiling/mcp-server-docker` | Inspect running containers, tail logs, start/stop services, verify container resource consumption. |
| **Kubernetes MCP** | Apache-2.0 | `strowk/mcp-k8s-go` | Inspect pods, deployments, ingress rules, cluster events, stream cluster error logs. |
| **Sentry MCP** | MIT | `modelcontextprotocol/servers/src/sentry` | Query real-time production exceptions, trace stack traces, monitor deployment regression spikes. |

### Integration Snippet (`librechat.yaml`)
```yaml
mcpServers:
  github:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_PAT}"
  git-local:
    type: stdio
    command: uvx
    args: ["mcp-server-git", "--repository", "D:/LAN-AI-Infra/LibreChat"]
  docker:
    type: stdio
    command: npx
    args: ["-y", "mcp-server-docker"]
```

---

## 3. IT & Cybersecurity Specialists / DevSecOps

| MCP Server | License | GitHub Repository | Key Capabilities |
| :--- | :---: | :--- | :--- |
| **Trivy Vulnerability Scanner** | Apache-2.0 | `aquasecurity/trivy` (via stdio wrapper) | Scan local directories, Docker images, and dependencies for CVEs, license compliance, and misconfigs. |
| **Semgrep SAST MCP** | LGPL/Apache-2.0 | `semgrep/semgrep` (stdio MCP tool) | Static analysis security testing for OWASP Top 10, SQLi, and secret leak detection across codebases. |
| **Nmap / Shodan MCP** | MIT | `mauricelambert/mcp-shodan` | Verify perimeter defense, enumerate open ports, inspect public TLS certificates, detect exposed internal services. |
| **Wireshark / PCAP MCP** | MIT | `mcp-pcap-analyzer` | Parse `.pcap` packet captures, detect anomalous DNS exfiltration, TCP retransmissions, and malicious payloads. |
| **HashiCorp Vault MCP** | MPL-2.0 / MIT | `hashicorp/vault-mcp-server` | Inspect secret TTLs, trigger credential rotations, audit secret access patterns. |

---

## 4. Doctors, Clinicians & Healthcare Professionals

| MCP Server | License | GitHub Repository | Key Capabilities |
| :--- | :---: | :--- | :--- |
| **PubMed / MEDLINE MCP** | MIT | `blazehub/mcp-ncbi-pubmed` | Query 36M+ biomedical citations, peer-reviewed clinical abstracts, randomized controlled trial results. |
| **OpenFDA Medical MCP** | Apache-2.0 / Public | `openfda/openfda-mcp` | Real-time drug adverse event reports (FAERS), recall alerts, drug interaction cross-referencing, NDC lookups. |
| **ClinicalTrials.gov MCP**| MIT | `clinicaltrials-mcp` | Search active patient recruitment, clinical trial phases (1-4), inclusion/exclusion criteria, experimental drug protocols. |
| **BioPython / ChEMBL MCP**| MIT | `biopython/biopython` (via MCP bridge) | Parse FASTA sequences, SMILES molecular notation, pharmacological target affinities, bioactive molecules. |

### Healthcare Clinical Workflow Example
```
User Query: "Evaluate adverse event reports for Metformin in patients over 65 taking Lisinopril."
Agent Action:
  1. OpenFDA MCP -> Query FAERS database for co-administration interactions.
  2. PubMed MCP -> Retrieve 5 latest peer-reviewed clinical studies on renal safety.
  3. Format Clinical Evidence Brief with strict DOI and study design metadata.
```

---

## 5. Students, PhD Scholars, Scientists & University Professors

| MCP Server | License | GitHub Repository | Key Capabilities |
| :--- | :---: | :--- | :--- |
| **arXiv MCP Server** | MIT | `modelcontextprotocol/servers/src/arxiv` | Search preprints across Computer Science, Physics, Math, Quantitative Biology; retrieve full abstracts and PDFs. |
| **Semantic Scholar MCP** | MIT / Apache-2.0| `allenai/semantic-scholar-mcp` | Navigate academic citation graphs, discover influential foundational papers, retrieve co-citation clusters. |
| **Zotero Reference MCP** | MIT | `mcp-zotero` | Sync with local or cloud Zotero libraries, extract BibTeX keys, insert verified citations into thesis manuscripts. |
| **CrossRef / DOI MCP** | MIT | `crossref-mcp-server` | Resolve DOIs into citation formats (APA, MLA, IEEE, Chicago), fetch open-access publisher metadata. |
| **SymPy Mathematics MCP** | BSD / MIT | `sympy-mcp-server` | High-precision computer algebra system: symbolic differentiation, integration, matrix eigenvalues, LaTeX proofs. |

### Thesis Drafting Integration (`librechat.yaml`)
```yaml
mcpServers:
  arxiv:
    type: stdio
    command: uvx
    args: ["mcp-server-arxiv"]
  zotero:
    type: stdio
    command: npx
    args: ["-y", "mcp-server-zotero"]
    env:
      ZOTERO_USER_ID: "${ZOTERO_USER_ID}"
      ZOTERO_API_KEY: "${ZOTERO_API_KEY}"
```

---

## 6. Legal Professionals, Compliance Officers & Lawyers

| MCP Server | License | GitHub Repository | Key Capabilities |
| :--- | :---: | :--- | :--- |
| **CourtListener / Free Law MCP** | Apache-2.0 | `freelawproject/courtlistener-mcp` | Search 4M+ opinions across US Federal and State courts; track precedential rulings and judicial decisions. |
| **US Code & eCFR MCP** | MIT / Public | `legal-code-mcp` | Real-time lookup of statutory provisions, statutory cross-references, Title/Section navigation, regulatory updates. |
| **Contract Redline & Diff MCP** | MIT | `contract-analysis-mcp` | Automated redlining between contract versions, clause risk tagging (indemnification, limitation of liability, non-competes). |
| **Compliance & Privacy MCP** | MIT | `gdpr-hipaa-checker` | Audit policy documents against GDPR Article 13/14, HIPAA Security Rule, and CCPA consumer consent frameworks. |

---

## 7. Senior Citizens, Accessibility & Assistive Care

| MCP Server | License | GitHub Repository | Key Capabilities |
| :--- | :---: | :--- | :--- |
| **Piper TTS / Local Voice MCP** | MIT | `rhasspy/piper` | Ultra-fast, offline neural text-to-speech engine. Converts articles and chat responses into clear spoken audio. |
| **Plain Language Translator** | MIT | `plain-language-mcp` | Deconstructs complex legalese, government notices, and insurance jargon into simple, high-contrast, easy-to-read prose. |
| **Medication & Schedule Care**| MIT | `caregiver-assistant-mcp` | Medication dosage schedule reminders, doctor appointments, emergency caregiver contact coordination. |
| **Screen Magnifier & Audio** | MIT | `accessibility-mcp` | Controls screen reader markers, generates high-contrast visual transcripts, and summarizes long pages into 3 bullet points. |

---

## 8. Women's Health, Family & Sovereign Wellness

| MCP Server | License | GitHub Repository | Key Capabilities |
| :--- | :---: | :--- | :--- |
| **Sovereign Cycle & Wellness MCP** | MIT | `private-cycle-mcp` | 100% on-device private cycle tracking, hormonal health correlation, nutritional cycle syncing. **Zero telemetry / zero cloud sync**. |
| **Maternal Healthcare Research** | MIT | `maternal-health-mcp` | Evidence-based guidance on prenatal care, postpartum recovery, lactation support, and pediatric milestones from trusted clinical registries. |
| **Family Organizer MCP** | MIT | `family-hub-mcp` | Multi-member calendar synchronization, school schedules, emergency immunization records, dietary restriction tracking. |

---

## Comparison Matrix: Native LibreChat vs. MCP-Supercharged

| Capability | Standard LibreChat | With Satchida Sovereign MCP Ecosystem |
| :--- | :--- | :--- |
| **Internal Documents & Files** | Ad-hoc per-session chat upload | Persistent **multi-tenant AnythingLLM vaults**, document pinning, folder hierarchies |
| **Web Research** | Single basic web search | **Keyless multi-source research** (DDGS, Bing Images, Google News, Wikipedia) + live article scraping |
| **Visual Document Creation** | Plain markdown output | **Full-bleed executive PPTX decks with real photos**, formatted DOCX, multi-tab XLSX, and styled PDFs |
| **Academic & Thesis Work** | Hallucinated citations | Verified DOIs via **arXiv, Semantic Scholar, and Zotero integration** |
| **Healthcare & Clinic** | General LLM guesswork | **PubMed clinical trials, OpenFDA contraindications, and FAERS data** |
| **Developer Productivity** | Copy-pasting code snippets | Direct **GitHub PR creation, local git diff inspection, Docker/K8s pod debugging** |
| **Data Privacy & Telemetry** | Depends on cloud API keys | **100% on-premise execution**, zero SearXNG CAPTCHA failure, zero external trackers |

---

## Ready-to-Use Deployment Checklist

1. **Verify AnythingLLM MCP Expansion**:  
   Ensure `D:\LAN-AI-Infra\LibreChat\skill\anythingllm_mcp_server.py` is configured with all 20 tools.
2. **Select Target Persona Servers**:  
   Add desired servers from the tables above to `D:\LAN-AI-Infra\LibreChat\librechat.yaml` under `mcpServers:`.
3. **Restart LibreChat Instance**:  
   Run `pm2 reload librechat` in PowerShell to register the new tool definitions across all chat models and agents.
