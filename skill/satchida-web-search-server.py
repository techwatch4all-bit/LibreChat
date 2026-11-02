"""
satchida-web-search-server.py
MCP server wrapping the existing keyless satchida-search engine (port 8880).
Engines: DuckDuckGo, Google News RSS, Bing News RSS, Yandex RSS, Wikipedia.
Zero API keys. Zero SearxNG. Zero external dependencies beyond stdlib.

Tools exposed:
  web_search          - general web search across all engines (DDG+Google+Bing+Wiki)
  news_search         - news-biased search (Google+Bing+Yandex RSS)
  academic_web_search - DDG + Wikipedia, ideal for educational/academic terms
  fetch_page          - fetch and return plain-text content of a URL
"""

import json
import re
import urllib.request
import urllib.parse
import urllib.error
from mcp.server.mcpserver import MCPServer

SEARCH_BASE = "http://127.0.0.1:8880/search"

server = MCPServer("satchida-web-search")


def _search(query: str, engines: list, num_results: int = 10) -> str:
    """Hit satchida-search HTTP API and return formatted markdown results."""
    params = urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "engines": ",".join(engines),
        "num_results": num_results,
    })
    url = f"{SEARCH_BASE}?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "satchida-mcp/1.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        return f"ERROR: satchida-search unavailable at {SEARCH_BASE}: {exc}"
    except json.JSONDecodeError as exc:
        return f"ERROR: could not parse search response: {exc}"

    results = data.get("results", [])
    if not results:
        return f"No results found for: {query}"

    lines = [f"## Web Search: {query}\n"]
    for i, r in enumerate(results[:num_results], 1):
        title   = r.get("title", "(no title)")
        url_r   = r.get("url", "")
        snippet = r.get("content", r.get("snippet", "")).strip()[:400]
        engine  = r.get("engine", "")
        lines.append(f"**{i}. {title}**")
        if url_r:
            lines.append(f"Source: {url_r}")
        if engine:
            lines.append(f"Engine: {engine}")
        if snippet:
            lines.append(snippet)
        lines.append("")
    return "\n".join(lines)


def _fetch_url(url: str) -> str:
    """Fetch a webpage and return stripped plain text (up to 6000 chars)."""
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,text/plain,*/*",
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        return f"ERROR fetching {url}: {exc}"

    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", raw, flags=re.IGNORECASE)
    text = re.sub(r"<style[^>]*>[\s\S]*?</style>",   "", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&amp;",   "&", text)
    text = re.sub(r"&lt;",    "<", text)
    text = re.sub(r"&gt;",    ">", text)
    text = re.sub(r"&nbsp;",  " ", text)
    text = re.sub(r"\s{3,}", "\n\n", text)
    return text.strip()[:6000]


# ── Tool: web_search ─────────────────────────────────────────────────────────

@server.tool()
def web_search(query: str, num_results: int = 10) -> str:
    """
    Search the web using the keyless Satchida multi-engine search service.
    Fans out across DuckDuckGo, Google News RSS, Bing News RSS, and Wikipedia.
    No API key, no SearxNG. Use for general queries, current events, and research.
    Returns up to 10 ranked results with titles, URLs, and snippets.

    :param query: The search query string.
    :param num_results: Number of results to return, between 1 and 20 (default 10).
    """
    n = max(1, min(20, int(num_results)))
    return _search(query, ["duckduckgo", "google", "bing", "wikipedia"], n)


# ── Tool: news_search ────────────────────────────────────────────────────────

@server.tool()
def news_search(query: str, num_results: int = 8) -> str:
    """
    Search for current news and recent developments using keyless RSS sources.
    Sources: Google News, Bing News, Yandex News — all RSS, no API key, no SearxNG.
    Best for breaking news, current events, and time-sensitive research topics.

    :param query: The news topic or event to search for.
    :param num_results: Number of news items to return, between 1 and 15 (default 8).
    """
    n = max(1, min(15, int(num_results)))
    return _search(query, ["google", "bing", "yandex"], n)


# ── Tool: academic_web_search ────────────────────────────────────────────────

@server.tool()
def academic_web_search(query: str, num_results: int = 8) -> str:
    """
    Search for academic, encyclopaedic, and educational content using DuckDuckGo
    and Wikipedia. No API key, no SearxNG required.
    Best for concepts, definitions, scientific terms, and curriculum topics.
    Complements arxiv-search (for peer-reviewed papers) and satchida-stem-study (for computation).

    :param query: The academic topic, concept, or educational term to look up.
    :param num_results: Number of results to return, between 1 and 15 (default 8).
    """
    n = max(1, min(15, int(num_results)))
    return _search(query, ["duckduckgo", "wikipedia"], n)


# ── Tool: fetch_page ─────────────────────────────────────────────────────────

@server.tool()
def fetch_page(url: str) -> str:
    """
    Fetch and return the readable plain-text content of any webpage URL.
    Use this after web_search or news_search to read the full content of a result.
    HTML tags, scripts, and styles are stripped. Returns up to 6000 characters.
    No API key required.

    :param url: The full URL (starting with http:// or https://) to fetch.
    """
    return _fetch_url(url)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    server.run()
