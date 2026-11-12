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

import ipaddress
import json
import re
import socket
import threading
import time
import urllib.request
import urllib.parse
import urllib.error
from mcp.server.mcpserver import MCPServer

SEARCH_BASE = "http://127.0.0.1:8880/search"

server = MCPServer("satchida-web-search")


# ── Freshness-tiered TTL cache ────────────────────────────────────────────────
#
# Data classes (operator contract, 2026-11-10):
#   dynamic — changes every second (bullion, crypto, stocks, indices, forex)
#   daily   — fixed for the full day (fuel/LPG/E20 rates, vedic panchang)
#   news    — rolling headlines of the day (global, India, sector wires)
# Caching day-static data means N end users asking the same question on the
# same day cost the platform ONE upstream pull instead of N.

_TTL_BY_CLASS = {
    "dynamic": 60,
    "daily": 12 * 3600,
    "news": 90 * 60,
    "default": 10 * 60,
}

_DYNAMIC_RE = re.compile(
    r"\b(gold|silver|bullion|crypto|bitcoin|ethereum|solana|btc|eth|sol|"
    r"stock|share|share market|nifty|sensex|bank nifty|index|forex|"
    r"usd|inr|dollar|rupee|exchange rate|spot|commodity|crude|brent|"
    r"mcx|live price|live rate|share price)\b", re.IGNORECASE)
_DAILY_RE = re.compile(
    r"\b(petrol|diesel|lpg|fuel|e20|xp95|cng|panchang|tithi|nakshatra|"
    r"yoga|karana|rahu|muhurat|abhijit|bank holiday|govt holiday)\b", re.IGNORECASE)
_NEWS_RE = re.compile(
    r"\b(news|headline|headlines|breaking|top stories|happened today|"
    r"bulletin|wire)\b", re.IGNORECASE)


def classify_freshness(text: str) -> str:
    """Classify a query/URL into a freshness class for TTL selection."""
    if _DYNAMIC_RE.search(text):
        return "dynamic"
    if _DAILY_RE.search(text):
        return "daily"
    if _NEWS_RE.search(text):
        return "news"
    return "default"


_CACHE = {}
_CACHE_LOCK = threading.Lock()
_CACHE_MAX = 500


def _cache_key(kind: str, key_text: str) -> str:
    return f"{kind}::{key_text.strip().lower()}"


def _cache_get(kind: str, key_text: str):
    """Return (value, age_seconds, ttl) on a fresh hit, else None."""
    key = _cache_key(kind, key_text)
    with _CACHE_LOCK:
        entry = _CACHE.get(key)
        if entry is None:
            return None
        age = time.monotonic() - entry["stored"]
        if age >= entry["ttl"]:
            del _CACHE[key]
            return None
        entry["last_hit"] = time.monotonic()
        return entry["value"], age, entry["ttl"]


def _cache_put(kind: str, key_text: str, value: str) -> None:
    key = _cache_key(kind, key_text)
    with _CACHE_LOCK:
        if len(_CACHE) >= _CACHE_MAX:
            now = time.monotonic()
            for k in [k for k, v in _CACHE.items() if now - v["stored"] >= v["ttl"]]:
                del _CACHE[k]
            while len(_CACHE) >= _CACHE_MAX:
                oldest = min(_CACHE, key=lambda k: _CACHE[k]["last_hit"])
                del _CACHE[oldest]
        _CACHE[key] = {
            "value": value,
            "stored": time.monotonic(),
            "last_hit": time.monotonic(),
            "ttl": _TTL_BY_CLASS[classify_freshness(key_text)],
        }


def _cached_or_fetch(kind: str, key_text: str, fetch) -> str:
    hit = _cache_get(kind, key_text)
    if hit is not None:
        value, age, ttl = hit
        print(f"[satchida-cache] HIT {kind} age={age:.0f}s ttl={ttl}s key={key_text[:60]!r}",
              flush=True)
        return f"{value}\n\n_[satchida cache: served {int(age)}s-old copy of a {ttl}s-fresh entry]_"
    value = fetch()
    if value and not value.startswith("ERROR"):
        _cache_put(kind, key_text, value)
    return value


# ── URL safety (SSRF guard) ───────────────────────────────────────────────────
#
# fetch_page takes arbitrary URLs: only http/https is allowed, and the host is
# validated against localhost, loopback, private, and reserved addresses
# (DNS-resolved, not just string-matched) before any request is made.

_BLOCKED_HOSTNAMES = {"localhost", "ip6-localhost", "ip6-loopback"}


def _validate_public_url(url: str) -> str | None:
    """Return an error string when the URL must be refused, else None."""
    try:
        parsed = urllib.parse.urlparse(url)
    except ValueError:
        return f"REFUSED: malformed URL: {url!r}"
    if parsed.scheme not in ("http", "https"):
        return f"REFUSED: only http/https URLs are allowed (got {parsed.scheme!r})."
    host = (parsed.hostname or "").strip().lower()
    if not host:
        return "REFUSED: URL has no host."
    if host in _BLOCKED_HOSTNAMES or host.endswith(".local") or host.endswith(".internal"):
        return f"REFUSED: {host} is a local/internal host."
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80),
                                   proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        return f"REFUSED: cannot resolve host {host}: {exc}"
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved
                or ip.is_multicast or ip.is_unspecified):
            return f"REFUSED: {host} resolves to a private/reserved address ({ip})."
    return None


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
    return _cached_or_fetch(
        "search", f"web|{query}|{n}",
        lambda: _search(query, ["duckduckgo", "google", "bing", "wikipedia"], n))


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
    return _cached_or_fetch(
        "search", f"news|{query}|{n}",
        lambda: _search(query, ["google", "bing", "yandex"], n))


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
    return _cached_or_fetch(
        "search", f"academic|{query}|{n}",
        lambda: _search(query, ["duckduckgo", "wikipedia"], n))


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
    refusal = _validate_public_url(url)
    if refusal:
        return refusal
    return _cached_or_fetch("page", url, lambda: _fetch_url(url))


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    server.run()
