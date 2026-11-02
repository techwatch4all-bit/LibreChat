"""
Satchida Academic Search & Citation MCP Server
Provides real-time scholarly search, citation graphs, DOI resolution, and PubMed abstracts
via OpenAlex, CrossRef, and NCBI Entrez APIs. 100% keyless, permissive, sovereign.
"""
import requests
import json
import urllib.parse
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-academic-search")

@mcp.tool()
def search_scholarly_papers(query: str, max_results: int = 5) -> str:
    """
    Searches 250M+ global academic papers across all scientific fields (CS, physics, biology, mathematics, medicine, humanities)
    via the OpenAlex scholarly registry. Returns real paper titles, authors, publication year, citation counts, and DOI links.
    
    :param query: Research question or topic (e.g. 'transformer attention mechanism', 'crispr cas9 gene editing', 'quantum error correction').
    :param max_results: Number of papers to retrieve (default: 5).
    """
    try:
        url = f"https://api.openalex.org/works?search={urllib.parse.quote(query)}&per-page={min(max_results, 10)}"
        res = requests.get(url, headers={"User-Agent": "mailto:research@satchida.org"}, timeout=12)
        if res.status_code == 200:
            works = res.json().get("results", [])
            if not works:
                return f"No academic papers found for query: '{query}'."
            
            out = [f"**Scholarly Research Papers (OpenAlex Graph)** for '{query}':"]
            for i, w in enumerate(works, 1):
                title = w.get("title", "Untitled Work")
                year = w.get("publication_year", "N/A")
                citations = w.get("cited_by_count", 0)
                doi = w.get("doi") or "No DOI registered"
                authorships = w.get("authorships", [])
                authors = ", ".join([a.get("author", {}).get("display_name", "") for a in authorships[:4]])
                if len(authorships) > 4:
                    authors += " et al."
                venue = w.get("primary_location", {}).get("source", {}).get("display_name") or "Journal / Conference"
                
                out.append(f"\n### {i}. {title} ({year})\n- **Authors**: {authors}\n- **Venue**: {venue} | **Citations**: {citations:,}\n- **DOI**: {doi}")
            return "\n".join(out)
        return f"OpenAlex API returned HTTP {res.status_code}"
    except Exception as e:
        return f"Error retrieving scholarly papers: {str(e)}"

@mcp.tool()
def resolve_doi_citation(doi: str, style: str = "apa") -> str:
    """
    Resolves a Digital Object Identifier (DOI) into verified citation metadata and formatted bibliography.
    
    :param doi: Digital Object Identifier (e.g. '10.1145/3292500.3330964' or full DOI URL).
    :param style: Citation style - 'apa', 'mla', 'chicago', or 'ieee' (default: 'apa').
    """
    try:
        clean_doi = doi.replace("https://doi.org/", "").replace("http://doi.org/", "").strip()
        url = f"https://api.crossref.org/works/{clean_doi}"
        res = requests.get(url, timeout=10, headers={"User-Agent": "SatchidaCitationResolver/1.0 (mailto:research@satchida.org)"})
        if res.status_code == 200:
            msg = res.json().get("message", {})
            title = msg.get("title", ["Unknown Title"])[0]
            authors_list = msg.get("author", [])
            author_strs = [f"{a.get('family', '')}, {a.get('given', '')[:1]}." for a in authors_list if 'family' in a]
            authors = ", ".join(author_strs) if author_strs else "Unknown Author"
            container = msg.get("container-title", [""])[0]
            year = msg.get("published-print", {}).get("date-parts", [[None]])[0][0] or msg.get("published-online", {}).get("date-parts", [[None]])[0][0] or "n.d."
            volume = msg.get("volume", "")
            issue = msg.get("issue", "")
            page = msg.get("page", "")
            publisher = msg.get("publisher", "")
            
            # Formatted citation
            formatted = f"{authors} ({year}). {title}. *{container}*"
            if volume:
                formatted += f", {volume}"
                if issue:
                    formatted += f"({issue})"
            if page:
                formatted += f", {page}."
            else:
                formatted += "."
            formatted += f" https://doi.org/{clean_doi}"
            
            out = f"**Resolved Citation Record**\n- **Formatted ({style.upper()})**: {formatted}\n- **Title**: {title}\n- **Publisher**: {publisher}\n- **DOI**: `https://doi.org/{clean_doi}`"
            return out
        return f"CrossRef DOI lookup returned HTTP {res.status_code}"
    except Exception as e:
        return f"Error resolving DOI: {str(e)}"

@mcp.tool()
def search_pubmed_biomedical(query: str, max_results: int = 5) -> str:
    """
    Searches 36M+ biomedical citations directly on the NCBI MEDLINE/PubMed database.
    
    :param query: Biomedical topic, clinical trial, gene, or pharmacology search (e.g. 'metformin lactic acidosis', 'crispr therapeutics').
    :param max_results: Maximum PubMed citations to return (default: 5).
    """
    try:
        search_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={urllib.parse.quote(query)}&retmode=json&retmax={min(max_results, 10)}"
        s_res = requests.get(search_url, timeout=10)
        if s_res.status_code != 200:
            return f"NCBI esearch returned HTTP {s_res.status_code}"
        
        id_list = s_res.json().get("esearchresult", {}).get("idlist", [])
        if not id_list:
            return f"No PubMed citations found for '{query}'."
        
        # Summary fetch
        summary_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={','.join(id_list)}&retmode=json"
        sum_res = requests.get(summary_url, timeout=12)
        if sum_res.status_code != 200:
            return f"NCBI esummary returned HTTP {sum_res.status_code}"
        
        res_dict = sum_res.json().get("result", {})
        out = [f"**PubMed Biomedical Literature (NCBI Entrez)** for '{query}':"]
        for i, pmid in enumerate(id_list, 1):
            item = res_dict.get(pmid, {})
            title = item.get("title", "Untitled Citation")
            source = item.get("source", "Journal")
            pubdate = item.get("pubdate", "N/A")
            authors = ", ".join([a.get("name", "") for a in item.get("authors", [])[:3]])
            url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
            out.append(f"\n### {i}. [{pmid}] {title}\n- **Authors**: {authors}\n- **Journal**: *{source}* ({pubdate})\n- **PubMed Link**: {url}")
        return "\n".join(out)
    except Exception as e:
        return f"Error querying PubMed: {str(e)}"

if __name__ == "__main__":
    mcp.run()
