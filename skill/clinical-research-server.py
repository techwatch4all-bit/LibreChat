"""
Satchida Clinical Research & Pharmacology MCP Server
Provides real-time clinical trial protocols, FDA drug label warnings,
and biomedical literature abstracts via ClinicalTrials.gov v2, openFDA, and NCBI APIs.
"""
import requests
import json
import urllib.parse
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-clinical-research")

@mcp.tool()
def search_clinical_trials(condition: str, intervention: str = "", max_results: int = 5) -> str:
    """
    Searches active, recruiting, and completed clinical research protocols on ClinicalTrials.gov REST API v2.
    
    :param condition: Disease or clinical indication (e.g. 'type 2 diabetes', 'lung cancer', 'rheumatoid arthritis').
    :param intervention: Therapeutic drug or medical device (e.g. 'metformin', 'semaglutide', 'keytruda').
    :param max_results: Maximum trials to retrieve (default: 5).
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
            
            out = [f"**ClinicalTrials.gov Protocol Registry** (Found {len(studies)} matches for '{q_term}'):"]
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

@mcp.tool()
def get_fda_drug_label_warnings(drug_name: str) -> str:
    """
    Retrieves official FDA-approved prescribing label information: Boxed Warnings,
    Adverse Reactions, Drug Interactions, and Contraindications from openFDA.
    
    :param drug_name: Generic or brand drug name (e.g. 'warfarin', 'metformin', 'ozempic', 'lisinopril').
    """
    try:
        clean_name = drug_name.strip().lower()
        url = f"https://api.fda.gov/drug/label.json?search=openfda.generic_name:{clean_name}+openfda.brand_name:{clean_name}&limit=1"
        res = requests.get(url, timeout=12)
        if res.status_code != 200:
            # Fallback to single field
            url = f"https://api.fda.gov/drug/label.json?search={clean_name}&limit=1"
            res = requests.get(url, timeout=12)
            
        if res.status_code == 200:
            results = res.json().get("results", [])
            if not results:
                return f"No FDA label records found for '{drug_name}'."
            r = results[0]
            brand_name = ", ".join(r.get("openfda", {}).get("brand_name", [clean_name.title()]))
            generic_name = ", ".join(r.get("openfda", {}).get("generic_name", ["N/A"]))
            boxed_warning = " ".join(r.get("boxed_warning", ["No boxed warning specified on label."]))
            interactions = " ".join(r.get("drug_interactions", ["No specific interaction section indexed."]))
            contraindications = " ".join(r.get("contraindications", ["Refer to clinical guidance."]))
            
            out = [
                f"**FDA Approved Drug Label Record: {brand_name} ({generic_name})**",
                f"\n### ⚠️ Boxed Warning\n{boxed_warning[:600]}...",
                f"\n### 💊 Clinical Drug Interactions\n{interactions[:600]}...",
                f"\n### 🚫 Contraindications\n{contraindications[:400]}..."
            ]
            return "\n".join(out)
        return f"openFDA label search returned HTTP {res.status_code}"
    except Exception as e:
        return f"Error retrieving FDA drug label: {str(e)}"

@mcp.tool()
def search_pubmed_abstracts(query: str, max_results: int = 5) -> str:
    """
    Searches peer-reviewed clinical studies and randomized controlled trials on PubMed / NCBI MEDLINE.
    
    :param query: Medical inquiry or drug trial topic (e.g. 'semaglutide cardiovascular outcomes', 'sglt2 inhibitors heart failure').
    :param max_results: Number of peer-reviewed articles to retrieve (default: 5).
    """
    try:
        search_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={urllib.parse.quote(query)}&retmode=json&retmax={min(max_results, 10)}"
        s_res = requests.get(search_url, timeout=10)
        if s_res.status_code != 200:
            return f"NCBI esearch returned HTTP {s_res.status_code}"
        
        id_list = s_res.json().get("esearchresult", {}).get("idlist", [])
        if not id_list:
            return f"No PubMed citations found for query: '{query}'."
            
        summary_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={','.join(id_list)}&retmode=json"
        sum_res = requests.get(summary_url, timeout=12)
        if sum_res.status_code != 200:
            return f"NCBI esummary returned HTTP {sum_res.status_code}"
            
        res_dict = sum_res.json().get("result", {})
        out = [f"**PubMed Peer-Reviewed Clinical Abstracts** for '{query}':"]
        for i, pmid in enumerate(id_list, 1):
            item = res_dict.get(pmid, {})
            title = item.get("title", "Untitled Clinical Paper")
            source = item.get("source", "Medical Journal")
            pubdate = item.get("pubdate", "N/A")
            authors = ", ".join([a.get("name", "") for a in item.get("authors", [])[:3]])
            url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
            out.append(f"\n### {i}. [{pmid}] {title}\n- **Investigators**: {authors}\n- **Journal**: *{source}* ({pubdate})\n- **PubMed Link**: {url}")
        return "\n".join(out)
    except Exception as e:
        return f"Error retrieving PubMed literature: {str(e)}"

if __name__ == "__main__":
    mcp.run()
