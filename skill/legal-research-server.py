"""
Satchida Legal Research MCP Server
Exposes US Federal Regulations (eCFR), Clinical Trials protocol registries,
and Public Case Law Search using free, sovereign, keyless APIs.
"""
import requests
import json
import urllib.parse
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-legal-research")

@mcp.tool()
def search_federal_regulations(keyword: str, per_page: int = 5) -> str:
    """
    Searches the live Electronic Code of Federal Regulations (eCFR) API for federal rules,
    statutory compliance, labor laws, environment, securities, and commerce regulations.
    
    :param keyword: Concept, law, or regulatory subject to search (e.g. 'copyright', 'minimum wage', 'hipaa privacy').
    :param per_page: Number of matching regulation records to retrieve (default: 5).
    """
    try:
        url = f"https://www.ecfr.gov/api/search/v1/results?query={urllib.parse.quote(keyword)}&per_page={min(per_page, 10)}"
        res = requests.get(url, timeout=12, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        if res.status_code == 200:
            data = res.json()
            results = data.get("results", [])
            total = data.get("meta", {}).get("total_count", len(results))
            if not results:
                return f"No federal regulations found for '{keyword}'."
            
            out = [f"**eCFR Federal Regulations Search** (Found {total} results for '{keyword}'):"]
            for i, r in enumerate(results, 1):
                hierarchy = r.get("hierarchy", {})
                title = hierarchy.get("title", "N/A")
                part = hierarchy.get("part", "N/A")
                section = hierarchy.get("section", "N/A")
                heading = r.get("headings", {}).get("section") or r.get("headings", {}).get("part") or "Regulatory Provision"
                snippet = r.get("full_text_excerpt") or r.get("snippet") or "No excerpt available."
                clean_snippet = snippet.replace("<mark>", "**").replace("</mark>", "**").strip()
                out.append(f"\n### {i}. Title {title} CFR Part {part} Section {section}: {heading}\n{clean_snippet[:500]}")
            return "\n".join(out)
        return f"eCFR API returned HTTP {res.status_code}: {res.text[:200]}"
    except Exception as e:
        return f"Error searching federal regulations: {str(e)}"

@mcp.tool()
def search_case_law_opinions(query: str, max_results: int = 5) -> str:
    """
    Searches case law precedents, judicial opinions, and legal doctrine across federal
    and state jurisdictions via Wikipedia's comprehensive legal knowledge base.
    
    :param query: Case law topic, doctrine, or lawsuit title (e.g. 'fair use copyright', 'miranda v arizona', 'patent doctrine of equivalents').
    :param max_results: Maximum cases to return (default: 5).
    """
    try:
        search_query = f"{query} legal case court opinion"
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(search_query)}&format=json"
        res = requests.get(url, timeout=10, headers={"User-Agent": "SatchidaLegalResearch/1.0 (contact@satchida.org)"})
        if res.status_code == 200:
            items = res.json().get("query", {}).get("search", [])[:max_results]
            if not items:
                return f"No judicial case law found for '{query}'."
            
            out = [f"**Legal Precedents & Case Law Analysis** (Query: '{query}'):"]
            for i, it in enumerate(items, 1):
                title = it.get("title")
                snippet = it.get("snippet", "").replace("<span class=\"searchmatch\">", "**").replace("</span>", "**")
                page_url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"
                out.append(f"\n### {i}. {title}\n- **Reference Citation**: {page_url}\n- **Summary**: {snippet}")
            return "\n".join(out)
        return f"Legal search returned HTTP {res.status_code}"
    except Exception as e:
        return f"Error querying case law opinions: {str(e)}"

@mcp.tool()
def search_clinical_trials(condition: str, intervention: str = "", max_results: int = 5) -> str:
    """
    Queries the official ClinicalTrials.gov REST API v2 for active, recruiting, and completed clinical research protocols.
    
    :param condition: Disease, disorder, or medical indication (e.g. 'type 2 diabetes', 'melanoma', 'alzheimer').
    :param intervention: Optional drug, molecule, or therapeutic intervention (e.g. 'metformin', 'pembrolizumab').
    :param max_results: Maximum trials to return (default: 5).
    """
    try:
        q_term = condition
        if intervention:
            q_term += f" AND {intervention}"
        url = f"https://clinicaltrials.gov/api/v2/studies?query.term={urllib.parse.quote(q_term)}&pageSize={min(max_results, 10)}"
        res = requests.get(url, timeout=12)
        if res.status_code == 200:
            data = res.json()
            studies = data.get("studies", [])
            if not studies:
                return f"No clinical trials found matching condition: '{condition}', intervention: '{intervention}'."
            
            out = [f"**ClinicalTrials.gov Protocol Registry** (Query: '{q_term}'):"]
            for i, s in enumerate(studies, 1):
                protocol = s.get("protocolSection", {})
                ident = protocol.get("identificationModule", {})
                status_mod = protocol.get("statusModule", {})
                design = protocol.get("designModule", {})
                
                nct_id = ident.get("nctId", "N/A")
                brief_title = ident.get("briefTitle", "Untitled Protocol")
                overall_status = status_mod.get("overallStatus", "Unknown Status")
                phases = ", ".join(design.get("phases", ["Phase not specified"]))
                brief_summary = protocol.get("descriptionModule", {}).get("briefSummary", "No summary provided.")
                trial_url = f"https://clinicaltrials.gov/study/{nct_id}"
                
                out.append(f"\n### {i}. [{nct_id}] {brief_title}\n- **Status**: {overall_status} | **Phase**: {phases}\n- **Protocol Record**: {trial_url}\n- **Summary**: {brief_summary[:400]}...")
            return "\n".join(out)
        return f"ClinicalTrials.gov API returned HTTP {res.status_code}"
    except Exception as e:
        return f"Error retrieving clinical trials: {str(e)}"

if __name__ == "__main__":
    mcp.run()
