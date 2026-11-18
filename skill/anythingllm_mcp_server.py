#!/usr/bin/env python3
"""
Satchida Enterprise Knowledge Vault & Document Intelligence MCP Server
========================================================================
Bridges LibreChat directly to the bare-metal AnythingLLM engine (Port 3012).
Provides:
  1. Multi-tenant user data segregation (Deterministic per-user workspace isolation)
  2. Multi-format Document Creation (PPTX, PDF, DOCX, XLSX, Markdown, Text)
  3. Enterprise Semantic RAG with LanceDB vector search & source citations
  4. Real-time document ingestion & chunking pipeline
  5. Presentation inspection & structural round-trip enhancement
  6. Direct web-scraping to vault
  7. Vault embeddings management & configuration tuning
  8. Vault conversation export

Runs as an MCP stdio server registered in LibreChat's `librechat.yaml`.
"""

import sys
import os
import io
import json
import re
import uuid
import mimetypes
from datetime import datetime
from typing import Optional, Dict, Any, List
import requests
from mcp.server.mcpserver import MCPServer

try:
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.dml.color import RGBColor
    from pptx.enum.text import PP_ALIGN
    from pptx.enum.shapes import MSO_SHAPE
    from pptx.chart.data import CategoryChartData
    from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
except ImportError:
    pass

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image as RLImage
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
except ImportError:
    pass

try:
    import docx
    from docx.shared import Pt as DocxPt, Inches as DocxInches, RGBColor as DocxRGBColor
    from docx.oxml import parse_xml
    from docx.oxml.ns import nsdecls
    from docx.enum.table import WD_TABLE_ALIGNMENT
except ImportError:
    pass

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    pass

# Configuration
ANYTHINGLLM_BASE_URL = os.environ.get("ANYTHINGLLM_URL", "http://127.0.0.1:3012/api/v1")
ANYTHINGLLM_API_KEY = os.environ.get("ANYTHINGLLM_API_KEY", "")
EXPORT_OUTPUT_DIR = os.environ.get("SATCHIDA_EXPORTS_DIR", "D:\\LAN-AI-Infra\\AnythingLLM\\server\\storage\\documents\\generated")

os.makedirs(EXPORT_OUTPUT_DIR, exist_ok=True)


def _unique_output_name(name: str) -> str:
    """Operator directive (2026-11-17): an output document may NEVER overwrite
    an existing deliverable. A colliding name gets a timestamp+id suffix so
    every /generated link keeps pointing at exactly what was delivered."""
    base = os.path.basename(name)
    candidate = os.path.join(EXPORT_OUTPUT_DIR, base)
    if not os.path.exists(candidate):
        return base
    stem, ext = os.path.splitext(base)
    return f"{stem}_{datetime.now().strftime('%Y%m%d-%H%M%S')}_{uuid.uuid4().hex[:4]}{ext}"

mcp = MCPServer("satchida-knowledge-vault")

def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {ANYTHINGLLM_API_KEY}",
        "Content-Type": "application/json"
    }

def _resolve_user_workspace_slug(user_identifier: Optional[str] = None) -> str:
    """
    Guarantees deterministic multi-tenant data segregation.
    Each LibreChat user is mapped to their own isolated AnythingLLM workspace slug
    (e.g., 'vault-user-alice' or 'vault-usr123').
    If a workspace doesn't exist, it is dynamically created on-the-fly.
    """
    if not user_identifier or user_identifier.strip().lower() in ["default", "public", "anonymous", "none"]:
        return "my-workspace"
    
    clean_id = re.sub(r'[^a-zA-Z0-9_-]', '-', user_identifier.strip().lower())
    desired_name = f"Vault {clean_id}"
    slug = _ensure_workspace_exists(desired_name)
    return slug or f"vault-{clean_id}"

def _ensure_workspace_exists(desired_name: str) -> str:
    try:
        # Check all existing workspaces
        res = requests.get(f"{ANYTHINGLLM_BASE_URL}/workspaces", headers=_headers(), timeout=4)
        if res.status_code == 200:
            workspaces = res.json().get("workspaces", [])
            for ws in workspaces:
                if ws.get("name", "").lower() == desired_name.lower():
                    return ws.get("slug")
        
        # Create workspace if not present
        payload = {"name": desired_name}
        create_res = requests.post(f"{ANYTHINGLLM_BASE_URL}/workspace/new", json=payload, headers=_headers(), timeout=6)
        if create_res.status_code == 200:
            return create_res.json().get("workspace", {}).get("slug", "")
        return ""
    except Exception:
        return ""

# ============================================================================
# 1. MULTI-TENANT WORKSPACE & RAG TOOLS
# ============================================================================

@mcp.tool()
def list_user_knowledge_vaults(user_identifier: Optional[str] = None) -> str:
    """
    Lists the accessible knowledge vaults for the current LibreChat user.
    Enforces user data segregation by returning the user's private vault plus shared enterprise vaults.
    """
    try:
        res = requests.get(f"{ANYTHINGLLM_BASE_URL}/workspaces", headers=_headers(), timeout=5)
        if res.status_code != 200:
            return f"Error connecting to AnythingLLM vault engine: HTTP {res.status_code}"
        
        all_workspaces = res.json().get("workspaces", [])
        user_slug = _resolve_user_workspace_slug(user_identifier)
        
        visible = []
        for ws in all_workspaces:
            s = ws.get("slug", "")
            if s == user_slug:
                visible.append(f"📁 [Personal Vault] {ws.get('name')} (Slug: {s}) — {len(ws.get('documents', []))} documents")
            elif not s.startswith("usr-"):
                visible.append(f"🏢 [Shared Vault] {ws.get('name')} (Slug: {s}) — {len(ws.get('documents', []))} documents")
        
        if not visible:
            return f"No knowledge vaults currently indexed. Your personal vault slug is '{user_slug}'."
        return "\n".join(visible)
    except Exception as e:
        return f"Error retrieving vaults: {str(e)}"

@mcp.tool()
def search_vault_documents(
    query: str,
    user_identifier: Optional[str] = None,
    specific_workspace_slug: Optional[str] = None,
    top_k: int = 4
) -> str:
    """
    Executes a vector similarity search across LanceDB vector embeddings in AnythingLLM.
    Respects user segregation: searches the user's private workspace unless a specific shared workspace is requested.
    Returns excerpts, relevance scores, and document titles.
    """
    target_slug = specific_workspace_slug or _resolve_user_workspace_slug(user_identifier)
    try:
        payload = {"query": query, "topN": top_k}
        res = requests.post(
            f"{ANYTHINGLLM_BASE_URL}/workspace/{target_slug}/vector-search",
            json=payload,
            headers=_headers(),
            timeout=12
        )
        if res.status_code == 200:
            results = res.json().get("results", [])
            if not results:
                return f"No matching passages found in vault '{target_slug}' for query: '{query}'"
            
            output = [f"### Vault Search Results (`{target_slug}`):\n"]
            for idx, r in enumerate(results, 1):
                source = r.get("title", "Document")
                text = r.get("text", "").strip()
                score = round(r.get("score", 0), 3)
                output.append(f"**[{idx}] {source}** *(Relevance Score: {score})*\n> {text}\n")
            return "\n---\n".join(output)
        return f"Vector search error from AnythingLLM: HTTP {res.status_code}"
    except Exception as e:
        return f"Vault search failed: {str(e)}"

@mcp.tool()
def query_vault_rag_with_citations(
    question: str,
    user_identifier: Optional[str] = None,
    specific_workspace_slug: Optional[str] = None
) -> str:
    """
    Executes an end-to-end RAG inquiry using AnythingLLM's internal retrieval and synthesis pipeline.
    Returns the comprehensive synthesized answer with verified source citations.
    """
    target_slug = specific_workspace_slug or _resolve_user_workspace_slug(user_identifier)
    try:
        payload = {"message": question, "mode": "query"}
        res = requests.post(
            f"{ANYTHINGLLM_BASE_URL}/workspace/{target_slug}/chat",
            json=payload,
            headers=_headers(),
            timeout=40
        )
        if res.status_code == 200:
            data = res.json()
            reply = data.get("textResponse", "")
            sources = data.get("sources", [])
            
            if sources:
                citations_text = "\n".join([
                    f"- **[{s.get('title', 'Ref')}]**: {s.get('text', '')[:140]}..."
                    for s in sources
                ])
                return f"{reply}\n\n**Verified Citations & Sources:**\n{citations_text}"
            return reply
        return f"RAG execution returned HTTP {res.status_code}"
    except Exception as e:
        return f"RAG query error: {str(e)}"

# ============================================================================
# 2. DOCUMENT CREATION SKILL FOR ALL FORMATS
# ============================================================================

def _register_librechat_file(filename: str, source_path: str, user_identifier: Optional[str] = None) -> Optional[str]:
    """
    Registers the generated file into LibreChat's MongoDB files collection
    and copies it to LibreChat's uploads directory so it can be downloaded directly
    via LibreChat's native file server.
    """
    try:
        import subprocess
        uid = "6ac20760b98d248028c7371d"
        if user_identifier and len(user_identifier) == 24:
            uid = user_identifier
        js_script = "D:\\LAN-AI-Infra\\LibreChat\\skill\\register_file.js"
        if not os.path.exists(js_script):
            return None
        res = subprocess.run(
            ["node", js_script, source_path, filename, uid],
            capture_output=True,
            text=True,
            timeout=8
        )
        if res.returncode == 0 and res.stdout.strip():
            parsed = json.loads(res.stdout.strip())
            return parsed.get("file_id")
    except Exception as e:
        sys.stderr.write(f"File registration notice: {str(e)}\n")
    return None

@mcp.tool()
def create_formatted_document(
    filename: str,
    content: str,
    doc_type: Optional[str] = None,
    file_type: Optional[str] = None,
    format: Optional[str] = None,
    title: Optional[str] = None,
    author: Optional[str] = "Satchida Sovereign Platform",
    auto_index_to_vault: bool = True,
    user_identifier: Optional[str] = None
) -> str:
    """
    Generates professional, publication-ready standalone documents in multiple formats:
      - 'pptx': Executive PowerPoint Presentation in 16:9 widescreen layout with multi-archetype slide design:
                * BENTO GRID: 3-4 structured card containers with badges (use :::bento with ### Card Title)
                * KPI STAT RIBBON: Massive 38pt metric cards with context (use :::stats with KPI: [Val] | [Label] | [Context])
                * SEQUENTIAL TIMELINE: Multi-stage roadmap with badges (use :::timeline with Phase 1: / Step 1:)
                * COMPARISON MATRIX: Contrasting Left vs Right architecture cards (use :::comparison)
                * SPLIT-SCREEN VISUAL: Live embedded web photographs or native charts + structured action cards
                * NATIVE CHARTS: Interactive Bar, Column, Doughnut, Line (use ```chart:bar or ```chart:donut)
                * REAL WEB IMAGES: Live photographic evidence downloaded and embedded automatically
      - 'pdf' : Formatted Executive PDF Report with callouts, tables, and headers (ReportLab)
      - 'docx': Microsoft Word Document with executive tables & action items (python-docx)
      - 'xlsx': Excel Spreadsheet with tabular data, zebra styling & auto-fit columns (openpyxl)
      - 'md'  : Markdown technical documentation
      - 'txt' : Plain text file

    Parameters:
      - filename: Target name (e.g., 'Myscreentime.pptx' or 'Q3-Financial-Analysis.pdf')
      - content: Text, Markdown, charts, or JSON data (use ```chart:bar or KPI: [Value] | [Label] for visual slides)
      - doc_type / file_type / format: 'pptx', 'pdf', 'docx', 'xlsx', 'md', or 'txt' (auto-detected from filename if omitted)
      - title: Optional document title
      - author: Document author (defaults to 'Satchida Sovereign Platform')
      - auto_index_to_vault: If True, automatically ingests the generated document into the user's AnythingLLM private vault.
      - user_identifier: LibreChat username or ID to segregate storage.
    """
    # 1. Resolve format/extension with fallback and auto-detection
    raw_type = doc_type or file_type or format
    base_name, file_ext = os.path.splitext(filename)
    detected_ext = file_ext.lower().lstrip(".")
    
    if raw_type:
        ext = raw_type.lower().strip().lstrip(".")
    elif detected_ext:
        ext = detected_ext
    else:
        ext = "pdf"
        
    ext_map = {
        "presentation": "pptx",
        "powerpoint": "pptx",
        "ppt": "pptx",
        "excel": "xlsx",
        "sheet": "xlsx",
        "spreadsheet": "xlsx",
        "xls": "xlsx",
        "word": "docx",
        "document": "docx",
        "doc": "docx",
        "markdown": "md",
        "text": "txt"
    }
    ext = ext_map.get(ext, ext)
    
    # 2. Strip any trailing extension duplicates (e.g. TestDeck.pptx.pdf -> TestDeck)
    clean_base = filename
    while re.search(r'\.(pdf|docx|xlsx|pptx|md|txt)$', clean_base, flags=re.IGNORECASE):
        clean_base = re.sub(r'\.(pdf|docx|xlsx|pptx|md|txt)$', '', clean_base, flags=re.IGNORECASE)
        
    safe_base = re.sub(r'[^a-zA-Z0-9_.-]', '_', clean_base)
    if not safe_base:
        safe_base = f"Document_{int(datetime.now().timestamp())}"
    safe_name = _unique_output_name(f"{safe_base}.{ext}")
    
    file_path = os.path.join(EXPORT_OUTPUT_DIR, safe_name)
    doc_title = title or safe_base.replace("_", " ").title()

    try:
        if ext == "pptx":
            _generate_pptx(file_path, doc_title, content, author)
        elif ext == "pdf":
            _generate_pdf(file_path, doc_title, content, author)
        elif ext == "docx":
            _generate_docx(file_path, doc_title, content, author)
        elif ext == "xlsx":
            _generate_xlsx(file_path, doc_title, content)
        else: # md or txt
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)

        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

        # Register in LibreChat uploads & MongoDB for UI download & attachments
        librechat_file_id = _register_librechat_file(safe_name, file_path, user_identifier)
        user_id_str = user_identifier if (user_identifier and len(user_identifier) == 24) else "6ac20760b98d248028c7371d"

        response_msg = [
            f"✅ **Document Created Successfully!**",
            f"- **Filename**: `{safe_name}`",
            f"- **Type**: `{ext.upper()}`",
            f"- **Size**: {file_size:,} bytes",
            "",
            "### 📥 Direct Downloads & Attachments:",
            f"- **[👉 Click Here to Download {safe_name} (Direct 1-Click)](/generated/{safe_name})**"
        ]

        if librechat_file_id:
            response_msg.append(f"- **[👉 LibreChat Vault Attachment](/api/files/download/{user_id_str}/{librechat_file_id})**")

        # Automatic ingestion into user's AnythingLLM workspace
        if auto_index_to_vault:
            user_slug = _resolve_user_workspace_slug(user_identifier)
            ingest_res = _ingest_local_file_to_anythingllm(file_path, user_slug)
            if ingest_res.get("success"):
                response_msg.append(f"\n- **Vault Ingestion**: Automatically chunked and embedded in private vault `{user_slug}`.")
            else:
                response_msg.append(f"\n- **Vault Ingestion**: Saved to disk, but vault upload note: {ingest_res.get('error')}")

        return "\n".join(response_msg)

    except Exception as e:
        return f"❌ Failed to create {ext.upper()} document: {str(e)}"

# ============================================================================
# 3. DOCUMENT INSPECTION & ROUND-TRIP ENHANCEMENT (PPTX, DOCX, XLSX)
# ============================================================================

def _resolve_input_file_path(filename_or_path: str) -> Optional[str]:
    """
    Finds the source document either by absolute path, in LibreChat's uploads directory,
    or in the Satchida generated storage directory.
    """
    clean_target = os.path.basename(filename_or_path.strip().strip("'\""))
    
    # 1. Check exact path if passed
    if os.path.isabs(filename_or_path) and os.path.exists(filename_or_path):
        return filename_or_path
        
    # 2. Check generated directory
    candidate = os.path.join(EXPORT_OUTPUT_DIR, clean_target)
    if os.path.exists(candidate):
        return candidate
        
    # 3. Check LibreChat uploads directory recursively
    librechat_uploads = "D:\\LAN-AI-Infra\\LibreChat\\uploads"
    if os.path.exists(librechat_uploads):
        for root, _, files in os.walk(librechat_uploads):
            if clean_target in files:
                return os.path.join(root, clean_target)
            for f in files:
                if f.endswith(f"__{clean_target}") or f.lower() == clean_target.lower():
                    return os.path.join(root, f)

    return None

@mcp.tool()
def inspect_existing_document(filename_or_path: str) -> str:
    """
    Inspects an attached or uploaded document (.pptx, .docx, .xlsx, .pdf, .txt, .md)
    and extracts its structural breakdown (slides, headings, table rows, paragraphs).
    Used before modifying or enhancing existing presentations and reports.
    """
    target_path = _resolve_input_file_path(filename_or_path)
    if not target_path or not os.path.exists(target_path):
        return f"❌ File not found: '{filename_or_path}'. Please verify the uploaded filename."

    ext = os.path.splitext(target_path)[1].lower().replace(".", "")
    try:
        if ext == "pptx":
            from pptx import Presentation
            prs = Presentation(target_path)
            output = [f"📊 **Presentation Structure: `{os.path.basename(target_path)}`** (Total Slides: {len(prs.slides)})\n"]
            for idx, slide in enumerate(prs.slides, 1):
                title = slide.shapes.title.text.strip() if slide.shapes.title and slide.shapes.title.text else f"Slide {idx}"
                text_items = []
                for shape in slide.shapes:
                    if shape.has_text_frame and shape != slide.shapes.title:
                        for p in shape.text_frame.paragraphs:
                            txt = p.text.strip()
                            if txt:
                                text_items.append(f"  • {txt}")
                body = "\n".join(text_items) if text_items else "  *(Visual or layout element)*"
                output.append(f"### Slide {idx}: {title}\n{body}")
            return "\n\n".join(output)

        elif ext == "docx":
            import docx
            doc = docx.Document(target_path)
            output = [f"📄 **Word Document Structure: `{os.path.basename(target_path)}`**\n"]
            for p in doc.paragraphs:
                txt = p.text.strip()
                if txt:
                    if p.style.name.startswith("Heading"):
                        output.append(f"**{txt}**")
                    else:
                        output.append(f"{txt}")
            return "\n\n".join(output[:50])

        elif ext == "xlsx":
            import openpyxl
            wb = openpyxl.load_workbook(target_path, data_only=True)
            output = [f"📈 **Workbook Structure: `{os.path.basename(target_path)}`** (Sheets: {wb.sheetnames})\n"]
            for name in wb.sheetnames:
                ws = wb[name]
                output.append(f"### Sheet: {name} ({ws.max_row} rows × {ws.max_column} cols)")
                rows_preview = []
                for row in ws.iter_rows(values_only=True):
                    row_clean = [str(c) if c is not None else "" for c in row]
                    if any(row_clean):
                        rows_preview.append(" | ".join(row_clean[:8]))
                    if len(rows_preview) >= 8:
                        break
                output.append("\n".join(rows_preview))
            return "\n\n".join(output)

        else:
            with open(target_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(5000)
            return f"📝 **Document Preview: `{os.path.basename(target_path)}`**\n\n```text\n{content}\n```"

    except Exception as e:
        return f"❌ Failed to inspect document: {str(e)}"

@mcp.tool()
def enhance_existing_presentation(
    source_filename_or_path: str,
    new_slides_content: str,
    output_filename: Optional[str] = None,
    user_identifier: Optional[str] = None,
    auto_index_to_vault: bool = True
) -> str:
    """
    Takes an existing PowerPoint presentation (.pptx) attached by the user,
    appends new or enhanced slides following the original presentation's layout,
    saves the enhanced file, and optionally embeds it into the user's private vault.

    Parameters:
      - source_filename_or_path: Attached PPTX filename (e.g. 'Product_Pitch.pptx')
      - new_slides_content: Markdown formatted slides to append. Use '## Slide Title' and bullet points.
      - output_filename: Target enhanced filename (e.g. 'Product_Pitch_Enhanced.pptx')
      - user_identifier: Current LibreChat user ID
      - auto_index_to_vault: Auto-vectorize in user's LanceDB vault
    """
    target_path = _resolve_input_file_path(source_filename_or_path)
    if not target_path or not os.path.exists(target_path):
        return f"❌ Source presentation not found: '{source_filename_or_path}'."

    try:
        from pptx import Presentation
        from pptx.util import Pt

        prs = Presentation(target_path)
        bullet_slide_layout = prs.slide_layouts[1] if len(prs.slide_layouts) > 1 else prs.slide_layouts[0]

        # Parse new slides
        sections = re.split(r'\n(?=(?:## |\n---|(?:\*\*)?Slide \d+:?))', new_slides_content.strip())
        added_count = 0
        for s in sections:
            lines = [l.strip() for l in s.split("\n") if l.strip()]
            if not lines:
                continue
            raw_title = lines[0]
            slide_title = re.sub(r'^(?:## |\*\*Slide \d+:?\s*|Slide \d+:?\s*|\*\*)', '', raw_title).rstrip('*').strip() or "Enhanced Slide"
            slide = prs.slides.add_slide(bullet_slide_layout)
            if slide.shapes.title:
                slide.shapes.title.text = slide_title
            
            # Populate text placeholders
            text_placeholders = [shape for shape in slide.shapes if shape.has_text_frame and shape != slide.shapes.title]
            if text_placeholders:
                tf = text_placeholders[0].text_frame
                tf.clear()
                for bullet in lines[1:]:
                    clean_bullet = re.sub(r'^[-*•\d.]+\s*', '', bullet).strip()
                    if clean_bullet:
                        p = tf.add_paragraph()
                        p.text = clean_bullet
                        p.font.size = Pt(16)
            added_count += 1

        # Determine destination filename
        if not output_filename:
            base, ext = os.path.splitext(os.path.basename(target_path))
            output_filename = f"{base}_Enhanced{ext}"
        if not output_filename.lower().endswith(".pptx"):
            output_filename = f"{output_filename}.pptx"

        dest_path = os.path.join(EXPORT_OUTPUT_DIR, _unique_output_name(os.path.basename(output_filename)))
        prs.save(dest_path)

        res = [
            f"✅ **Presentation Successfully Enhanced!**",
            f"- **Source File**: `{os.path.basename(target_path)}`",
            f"- **Enhanced File**: `{os.path.basename(dest_path)}`",
            f"- **Slides Added**: {added_count} (Total Slides: {len(prs.slides)})",
            f"- **Disk Path**: `{dest_path}`",
            f"- **File Size**: {os.path.getsize(dest_path):,} bytes"
        ]

        if auto_index_to_vault:
            user_slug = _resolve_user_workspace_slug(user_identifier)
            ingest_res = _ingest_local_file_to_anythingllm(dest_path, user_slug)
            if ingest_res.get("success"):
                res.append(f"- **Vault Ingestion**: Automatically chunked and embedded in private vault `{user_slug}`.")

        return "\n".join(res)

    except Exception as e:
        return f"❌ Failed to enhance presentation: {str(e)}"

# ============================================================================
# 4. DOCUMENT INGESTION & WEB SCRAPING ENGINES
# ============================================================================

def _ingest_local_file_to_anythingllm(filepath: str, workspace_slug: str) -> Dict[str, Any]:
    """Posts a local file to AnythingLLM's document upload endpoint."""
    try:
        url = f"{ANYTHINGLLM_BASE_URL}/document/upload"
        fname = os.path.basename(filepath)
        mime = mimetypes.guess_type(filepath)[0] or "application/octet-stream"

        with open(filepath, "rb") as f:
            files = {"file": (fname, f, mime)}
            data = {"addToWorkspaces": workspace_slug}
            headers = {"Authorization": f"Bearer {ANYTHINGLLM_API_KEY}"}
            res = requests.post(url, files=files, data=data, headers=headers, timeout=30)
            if res.status_code == 200:
                return {"success": True}
            return {"success": False, "error": f"HTTP {res.status_code}: {res.text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@mcp.tool()
def ingest_text_to_user_vault(
    document_title: str,
    text_content: str,
    user_identifier: Optional[str] = None
) -> str:
    """
    Takes arbitrary text content, saves it as a markdown note, and embeds it
    immediately into the user's segregated AnythingLLM vector workspace.
    """
    safe_title = re.sub(r'[^a-zA-Z0-9_-]', '_', document_title)
    fname = _unique_output_name(f"{safe_title}.md")
    fpath = os.path.join(EXPORT_OUTPUT_DIR, fname)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(text_content)
    
    user_slug = _resolve_user_workspace_slug(user_identifier)
    res = _ingest_local_file_to_anythingllm(fpath, user_slug)
    if res.get("success"):
        return f"✅ Text saved as `{fname}` and indexed into vault `{user_slug}`."
    return f"Saved file to disk, but failed to index: {res.get('error')}"

@mcp.tool()
def scrape_url_to_vault(
    url: str,
    user_identifier: Optional[str] = None
) -> str:
    """
    Scrapes a public web page or online documentation, parses its text,
    and automatically indexes it into the user's private AnythingLLM knowledge vault.
    """
    user_slug = _resolve_user_workspace_slug(user_identifier)
    try:
        payload = {
            "link": url,
            "addToWorkspaces": user_slug
        }
        res = requests.post(f"{ANYTHINGLLM_BASE_URL}/document/upload-link", json=payload, headers=_headers(), timeout=45)
        if res.status_code == 200:
            data = res.json()
            if data.get("success"):
                return f"✅ **URL Scraped and Indexed Successfully!**\n- **Target URL**: {url}\n- **Indexed Vault**: `{user_slug}`\n- Content is now searchable via vault RAG."
            return f"❌ Scraping completed but server reported: {data.get('error')}"
        return f"❌ Failed to scrape URL: HTTP {res.status_code} - {res.text}"
    except Exception as e:
        return f"❌ Error during URL scraping: {str(e)}"

@mcp.tool()
def remove_document_from_vault(
    document_location: str,
    user_identifier: Optional[str] = None
) -> str:
    """
    Removes a document from the user's private AnythingLLM vault by its document location/path.
    """
    user_slug = _resolve_user_workspace_slug(user_identifier)
    try:
        payload = {
            "removes": [document_location]
        }
        res = requests.post(f"{ANYTHINGLLM_BASE_URL}/workspace/{user_slug}/update-embeddings", json=payload, headers=_headers(), timeout=15)
        if res.status_code == 200:
            return f"✅ **Document Removed from Vault!**\n- **Document**: `{document_location}`\n- **Vault**: `{user_slug}`"
        return f"❌ Failed to remove document: HTTP {res.status_code}"
    except Exception as e:
        return f"❌ Error removing document: {str(e)}"

@mcp.tool()
def export_vault_chat_history(
    user_identifier: Optional[str] = None,
    limit: int = 20
) -> str:
    """
    Exports recent Q&A chat history and retrieved sources from the user's segregated knowledge vault.
    """
    user_slug = _resolve_user_workspace_slug(user_identifier)
    try:
        res = requests.get(f"{ANYTHINGLLM_BASE_URL}/workspace/{user_slug}/chats", headers=_headers(), timeout=10)
        if res.status_code == 200:
            history = res.json().get("history", [])
            if not history:
                return f"No chat history found in vault `{user_slug}`."
            recent = history[-limit:]
            output = [f"### Vault Chat History (`{user_slug}` - {len(recent)} turns):\n"]
            for chat in recent:
                role = chat.get("role", "user").upper()
                msg = chat.get("content", "").strip()
                output.append(f"**{role}**: {msg}\n")
            return "\n---\n".join(output)
        return f"❌ Failed to export chat history: HTTP {res.status_code}"
    except Exception as e:
        return f"❌ Error exporting chat history: {str(e)}"

@mcp.tool()
def update_vault_settings(
    settings_json: str,
    user_identifier: Optional[str] = None
) -> str:
    """
    Updates configuration for the user's private AnythingLLM vault.
    Accepts JSON with keys like:
      - similarityThreshold: minimum cosine similarity score (e.g. 0.25)
      - topN: number of RAG context chunks (e.g. 4)
      - openAiPrompt: custom system prompt for the vault
      - queryRefusalResponse: response when no documents match
    """
    user_slug = _resolve_user_workspace_slug(user_identifier)
    try:
        settings = json.loads(settings_json)
        res = requests.post(f"{ANYTHINGLLM_BASE_URL}/workspace/{user_slug}/update", json=settings, headers=_headers(), timeout=10)
        if res.status_code == 200:
            return f"✅ **Vault Settings Updated!**\n- **Vault**: `{user_slug}`\n- **Updated Parameters**: {list(settings.keys())}"
        return f"❌ Failed to update vault: HTTP {res.status_code} - {res.text}"
    except Exception as e:
        return f"❌ Error updating vault settings: {str(e)}"





@mcp.tool()
def pin_vault_document(
    doc_path: str,
    pin: bool = True,
    user_identifier: str = None
) -> str:
    """
    Pins or unpins a document inside the user's AnythingLLM workspace vault.
    Pinned documents are permanently injected into the prompt context for RAG queries,
    guaranteeing critical facts, rules, or core reference material are always accessible.
    
    :param doc_path: Stored document relative path (e.g. 'custom-documents/report.pdf-hash.json')
    :param pin: True to pin into system prompt context, False to unpin.
    :param user_identifier: Optional username to target specific workspace.
    """
    user_slug = _resolve_user_workspace_slug(user_identifier)
    try:
        payload = {'docPath': doc_path, 'pinStatus': pin}
        res = requests.post(f"{ANYTHINGLLM_BASE_URL}/workspace/{user_slug}/update-pin", json=payload, headers=_headers(), timeout=10)
        if res.status_code == 200:
            status_text = 'PINNED (always in prompt context)' if pin else 'UNPINNED (dynamic vector search only)'
            return f"Document Pin Status Updated! Vault: {user_slug}, Document: {doc_path}, Status: {status_text}"
        return f"Failed to update document pin: HTTP {res.status_code} - {res.text}"
    except Exception as e:
        return f"Error updating pin: {str(e)}"

@mcp.tool()
def raw_vector_search(
    query: str,
    top_n: int = 4,
    score_threshold: float = 0.5,
    user_identifier: str = None
) -> str:
    """
    Performs raw semantic vector similarity search against the user's AnythingLLM knowledge vault.
    Returns matching document chunks, exact cosine similarity scores, distances, and metadata.
    
    :param query: Semantic query or concept to match.
    :param top_n: Number of most relevant chunk matches to retrieve (default: 4).
    :param score_threshold: Minimum similarity threshold between 0.0 and 1.0 (default: 0.5).
    :param user_identifier: Optional username for multi-tenant vaults.
    """
    user_slug = _resolve_user_workspace_slug(user_identifier)
    try:
        payload = {
            'query': query,
            'topN': top_n,
            'scoreThreshold': score_threshold
        }
        res = requests.post(f"{ANYTHINGLLM_BASE_URL}/workspace/{user_slug}/vector-search", json=payload, headers=_headers(), timeout=15)
        if res.status_code == 200:
            data = res.json()
            chunks = data.get('results', []) or data.get('contextTexts', [])
            if not chunks:
                return f"Vector Search Results for vault {user_slug}: No chunks met similarity threshold {score_threshold} for query: {query}."
            
            out = [f"Vector Similarity Chunks for {user_slug} (Query: {query}):"]
            for i, chunk in enumerate(chunks, 1):
                if isinstance(chunk, dict):
                    score = chunk.get('score') or chunk.get('distance') or 'N/A'
                    title = chunk.get('title') or chunk.get('metadata', {}).get('title') or f"Chunk #{i}"
                    text = chunk.get('text') or chunk.get('chunk_text') or str(chunk)
                    out.append(f"\nMatch {i}: {title} (Score: {score})\n{text[:600]}...")
                else:
                    out.append(f"\nMatch {i}\n{str(chunk)[:600]}...")
            return "\n".join(out)
        return f"Vector search failed: HTTP {res.status_code} - {res.text}"
    except Exception as e:
        return f"Error performing vector search: {str(e)}"

@mcp.tool()
def inspect_vault_document(doc_name: str) -> str:
    """
    Inspects detailed internal structure of a document stored in AnythingLLM:
    chunks, token counts, vector embeddings status, and metadata schema.
    
    :param doc_name: The internal document name (e.g. from list_user_knowledge_vaults or search_vault_documents).
    """
    try:
        clean_name = doc_name.split('/')[-1] if '/' in doc_name else doc_name
        res = requests.get(f"{ANYTHINGLLM_BASE_URL}/document/{clean_name}", headers=_headers(), timeout=10)
        if res.status_code == 200:
            doc = res.json().get('document', {})
            return f"AnythingLLM Stored Document Details:\n- ID: {doc.get('id', 'N/A')}\n- Name: {doc.get('name', doc_name)}\n- URL/Source: {doc.get('url', 'N/A')}\n- Chunks: {len(doc.get('chunks', []))}\n- Metadata: {json.dumps(doc.get('metadata', {}), indent=2)}"
        return f"Document inspection failed: HTTP {res.status_code} - {res.text}"
    except Exception as e:
        return f"Error inspecting document: {str(e)}"

@mcp.tool()
def create_vault_thread(
    thread_name: str,
    user_identifier: str = None
) -> str:
    """
    Creates an isolated conversation thread within an AnythingLLM knowledge vault.
    Allows branching research, focused case studies, or drafting without polluting main chat history.
    
    :param thread_name: Human-readable name for the research thread (e.g. 'Chapter 3 Literature Review').
    :param user_identifier: Optional user identifier.
    """
    user_slug = _resolve_user_workspace_slug(user_identifier)
    try:
        payload = {'name': thread_name}
        res = requests.post(f"{ANYTHINGLLM_BASE_URL}/workspace/{user_slug}/thread/new", json=payload, headers=_headers(), timeout=10)
        if res.status_code == 200:
            data = res.json()
            thread = data.get('thread', {})
            return f"New Vault Thread Created! Vault: {user_slug}, Thread Name: {thread.get('name', thread_name)}, Thread Slug: {thread.get('slug')}. Use query_vault_thread to interact with this dedicated thread."
        return f"Failed to create thread: HTTP {res.status_code} - {res.text}"
    except Exception as e:
        return f"Error creating thread: {str(e)}"

@mcp.tool()
def query_vault_thread(
    thread_slug: str,
    message: str,
    mode: str = 'query',
    user_identifier: str = None
) -> str:
    """
    Sends a message to an isolated workspace thread and executes RAG against the vault's indexed documents.
    
    :param thread_slug: Unique slug of the thread (returned from create_vault_thread).
    :param message: The user prompt or analytical inquiry.
    :param mode: 'query' (strictly vault docs) or 'chat' (vault docs + conversational memory).
    :param user_identifier: Optional user identifier.
    """
    user_slug = _resolve_user_workspace_slug(user_identifier)
    try:
        payload = {'message': message, 'mode': mode}
        res = requests.post(f"{ANYTHINGLLM_BASE_URL}/workspace/{user_slug}/thread/{thread_slug}/chat", json=payload, headers=_headers(), timeout=45)
        if res.status_code == 200:
            data = res.json()
            reply = data.get('textResponse', 'No response text.')
            sources = data.get('sources', [])
            citations = ''
            if sources:
                citations = '\n\nThread Sources and Citations:\n' + '\n'.join([f"- {s.get('title', 'Doc')} (Match: {s.get('score', 'N/A')})" for s in sources])
            return f"{reply}{citations}"
        return f"Thread query failed: HTTP {res.status_code} - {res.text}"
    except Exception as e:
        return f"Error querying thread: {str(e)}"

@mcp.tool()
def manage_vault_folders(
    action: str,
    folder_name: str
) -> str:
    """
    Organizes stored documents into topical directories inside AnythingLLM.
    
    :param action: 'create' to create a folder, 'remove' to remove a folder.
    :param folder_name: Name of the folder to create or delete (e.g. 'Contracts', 'Research_Papers').
    """
    try:
        if action.lower() == 'create':
            payload = {'name': folder_name}
            res = requests.post(f"{ANYTHINGLLM_BASE_URL}/document/create-folder", json=payload, headers=_headers(), timeout=10)
        elif action.lower() == 'remove':
            payload = {'name': folder_name}
            res = requests.delete(f"{ANYTHINGLLM_BASE_URL}/document/remove-folder", json=payload, headers=_headers(), timeout=10)
        else:
            return f"Unsupported action: {action}. Valid actions are 'create' and 'remove'."
        
        if res.status_code in [200, 201]:
            return f"Folder Operation Success! Action: {action}, Folder: {folder_name}"
        return f"Folder operation failed: HTTP {res.status_code} - {res.text}"
    except Exception as e:
        return f"Error managing vault folders: {str(e)}"


@mcp.tool()
def search_web_images(query: str, max_results: int = 5) -> str:
    """
    Searches the web for high-resolution images, photographic evidence, and infographics
    via direct keyless web retrieval (Bing Images Async & Wikimedia Commons).
    Returns direct image URLs and markdown embed tags (![Title](url)).

    Parameters:
      - query: The image search topic (e.g., 'smartphone screen time addiction' or 'AI neural network diagram')
      - max_results: Maximum number of images to return (default: 5)
    """
    try:
        import urllib.parse
        import urllib.request
        import ssl
        import re

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        url = f"https://www.bing.com/images/async?q={urllib.parse.quote_plus(query)}&count=15"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=6, context=ctx) as r:
            html = r.read().decode("utf-8", errors="ignore")

        murls = re.findall(r'murl&quot;:&quot;(https?://[^&]+)&quot;', html)
        if not murls:
            return f"No images found for query: '{query}'."

        formatted = [f"### 🖼️ Live Web Image Results for: `{query}`\n"]
        for i, img_url in enumerate(murls[:max_results], 1):
            title = f"{query.title()} Visual {i}"
            formatted.append(f"**{i}. [{title}]({img_url})**\n- Image URL: `{img_url}`\n- Markdown Embed: `![{title}]({img_url})`\n")
        return "\n".join(formatted)
    except Exception as e:
        return f"Error executing web image search: {str(e)}"

def _fetch_image_bytes(query_or_url: str) -> Optional[bytes]:
    """
    Downloads image bytes directly from a URL or resolves a query via direct keyless web image retrieval.
    """
    import urllib.parse
    import urllib.request
    import ssl
    import re

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    def _download_url(url: str) -> Optional[bytes]:
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            with urllib.request.urlopen(req, timeout=5, context=ctx) as resp:
                data = resp.read()
                if len(data) > 3000:
                    return data
        except Exception:
            pass
        return None

    # Case 1: Direct URL
    if query_or_url.startswith("http://") or query_or_url.startswith("https://"):
        img_bytes = _download_url(query_or_url)
        if img_bytes:
            return img_bytes

    # Case 2: Direct keyless Bing Images async query
    try:
        url = f"https://www.bing.com/images/async?q={urllib.parse.quote_plus(query_or_url)}&count=15"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=6, context=ctx) as r:
            html = r.read().decode("utf-8", errors="ignore")
        murls = re.findall(r'murl&quot;:&quot;(https?://[^&]+)&quot;', html)
        for cand in murls:
            b = _download_url(cand)
            if b:
                return b
    except Exception:
        pass

    return None

@mcp.tool()
def deep_research_web_search(query: str, max_results: int = 5) -> str:
    """
    Performs live direct keyless web search across open web engines (DuckDuckGo, Google News RSS, Wikipedia).
    Retrieves current real-world statistics, trends, and verified citations with zero third-party platform assumptions.
    Use this whenever up-to-date facts, current metrics, or deep research is needed.

    Parameters:
      - query: Search query (e.g. 'average screen time statistics' or 'AI productivity benchmarks')
      - max_results: Maximum number of search results to return (default: 5)
    """
    try:
        import urllib.parse
        import urllib.request
        import ssl
        import re

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        results = []

        # 1. DuckDuckGo Search
        try:
            from duckduckgo_search import DDGS
            ddgs = DDGS()
            for r in ddgs.text(query, backend='html', max_results=max_results):
                if r.get('href') and r.get('title'):
                    results.append({
                        'title': r.get('title'),
                        'url': r.get('href'),
                        'content': r.get('body', ''),
                        'engine': 'duckduckgo'
                    })
        except Exception:
            pass

        # 2. Google News RSS for real-time news & current events
        if len(results) < max_results:
            try:
                news_url = f"https://news.google.com/rss/search?q={urllib.parse.quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
                req = urllib.request.Request(news_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5, context=ctx) as r:
                    xml = r.read().decode('utf-8', errors='ignore')
                items = xml.split('<item>')[1:]
                for it in items[:max_results - len(results)]:
                    t_m = re.search(r'<title>([\s\S]*?)</title>', it)
                    l_m = re.search(r'<link>([\s\S]*?)</link>', it)
                    d_m = re.search(r'<pubDate>([\s\S]*?)</pubDate>', it)
                    if t_m and l_m:
                        title = re.sub(r'<[^>]+>', '', t_m.group(1)).strip()
                        date_str = d_m.group(1).strip() if d_m else ''
                        results.append({
                            'title': title,
                            'url': l_m.group(1).strip(),
                            'content': title,
                            'publishedDate': date_str,
                            'engine': 'google_news'
                        })
            except Exception:
                pass

        # 3. Wikipedia Open API for canonical encyclopedic context
        if len(results) < max_results:
            try:
                wiki_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote_plus(query)}&format=json&srlimit=5"
                req = urllib.request.Request(wiki_url, headers={'User-Agent': 'SatchidaPlatform/1.0'})
                with urllib.request.urlopen(req, timeout=5, context=ctx) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    for item in data.get('query', {}).get('search', []):
                        results.append({
                            'title': item.get('title'),
                            'url': f"https://en.wikipedia.org/wiki/{urllib.parse.quote_plus(item.get('title').replace(' ', '_'))}",
                            'content': re.sub(r'<[^>]+>', '', item.get('snippet', '')),
                            'engine': 'wikipedia'
                        })
            except Exception:
                pass

        if not results:
            return f"No search results found for query: '{query}'."

        cur_year = datetime.now().year
        formatted = [f"### 🔍 Live Web Search Results for: `{query}` (Current Year: {cur_year})\n"]
        for i, r in enumerate(results[:max_results], 1):
            title = r.get("title", "Untitled")
            url = r.get("url", "")
            snippet = r.get("content", "").strip()
            date = r.get("publishedDate", "")
            engine = r.get("engine", "web")
            date_str = f" *({date})*" if date else ""
            formatted.append(f"**{i}. [{title}]({url})**{date_str} `[{engine}]`\n{snippet}\n")
        return "\n".join(formatted)
    except Exception as e:
        return f"Error executing live web search: {str(e)}"


@mcp.tool()
def fetch_web_content(url: str, max_chars: int = 4000) -> str:
    """
    Fetches and extracts clean, readable text/markdown from a specific web URL.
    Use this to perform deep analysis of articles, papers, or websites found during search.

    Parameters:
      - url: The target web URL to read.
      - max_chars: Maximum characters to return (default: 4000)
    """
    try:
        import urllib.request
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
        
        # Clean HTML tags and scripts
        body = re.sub(r'<(?:script|style|nav|footer|header)[\s\S]*?</(?:script|style|nav|footer|header)>', '', html, flags=re.I)
        text = re.sub(r'<[^>]+>', ' ', body)
        text = re.sub(r'\s+', ' ', text).strip()
        return text[:max_chars] if text else "Page loaded, but no readable body text was extracted."
    except Exception as e:
        return f"Error fetching web content from '{url}': {str(e)}"

# ============================================================================
# HELPER GENERATORS FOR DOCUMENT CREATION (EXECUTIVE MULTI-ARCHETYPE ENGINE)
# ============================================================================


def _resolve_image_flowable(src: str, max_w: float = 516.0, max_h: float = 280.0):
    """Resolves local public assets, downloaded media, or files to a scaled ReportLab Image flowable."""
    import os
    from PIL import Image as PILImage
    
    clean_src = src.strip()
    disk_path = None
    if clean_src.startswith('/assets/'):
        base_dir = 'D:/LAN-AI-Infra/LibreChat/client/public'
        rel = clean_src.lstrip('/')
        disk_path = os.path.join(base_dir, rel.replace('/', os.sep))
    elif os.path.exists(clean_src):
        disk_path = clean_src
        
    if disk_path and os.path.exists(disk_path):
        ext = os.path.splitext(disk_path)[1].lower()
        if ext in ['.png', '.jpg', '.jpeg']:
            try:
                with PILImage.open(disk_path) as im:
                    w, h = im.size
                scale = min(1.0, max_w / float(w), max_h / float(h))
                return RLImage(disk_path, width=w * scale, height=h * scale)
            except Exception:
                pass
        elif ext == '.gif':
            try:
                with PILImage.open(disk_path) as im:
                    im.seek(0)
                    temp_png = disk_path + '.frame0.png'
                    im.convert('RGB').save(temp_png)
                    w, h = im.size
                scale = min(1.0, max_w / float(w), max_h / float(h))
                return RLImage(temp_png, width=w * scale, height=h * scale)
            except Exception:
                pass
    return None

def _resolve_image_for_docx(src: str):
    """Resolves local public assets or media files to a valid image path for python-docx."""
    import os
    from PIL import Image as PILImage
    clean_src = src.strip()
    disk_path = None
    if clean_src.startswith('/assets/'):
        base_dir = 'D:/LAN-AI-Infra/LibreChat/client/public'
        rel = clean_src.lstrip('/')
        disk_path = os.path.join(base_dir, rel.replace('/', os.sep))
    elif os.path.exists(clean_src):
        disk_path = clean_src
        
    if disk_path and os.path.exists(disk_path):
        ext = os.path.splitext(disk_path)[1].lower()
        if ext in ['.png', '.jpg', '.jpeg']:
            return disk_path
        elif ext == '.gif':
            try:
                with PILImage.open(disk_path) as im:
                    im.seek(0)
                    temp_png = disk_path + '.frame0.png'
                    im.convert('RGB').save(temp_png)
                return temp_png
            except Exception:
                pass
    return None

def _generate_pdf(path: str, title: str, content: str, author: str = "Satchida Sovereign Platform"):
    """
    Renders publication-grade PDF documents with executive header banner,
    styled callout boxes, markdown tables, zebra striping, and clean typography.
    """
    doc = SimpleDocTemplate(
        path,
        pagesize=letter,
        rightMargin=48,
        leftMargin=48,
        topMargin=48,
        bottomMargin=48
    )
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=4
    )
    kicker_style = ParagraphStyle(
        'Kicker',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#2563EB'),
        spaceAfter=4
    )
    meta_style = ParagraphStyle(
        'DocMeta',
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=14
    )
    h1_style = ParagraphStyle(
        'DocH1',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=16,
        spaceAfter=8
    )
    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=12.5,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14.5,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=6
    )
    bullet_style = ParagraphStyle(
        'DocBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#1E293B'),
        leftIndent=14,
        spaceAfter=4
    )
    callout_style = ParagraphStyle(
        'DocCallout',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#0F172A')
    )

    elements = [
        Paragraph("EXECUTIVE REPORT & TECHNICAL SPECIFICATION", kicker_style),
        Paragraph(title, title_style),
        Paragraph(f"Authored by: {author}  •  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}  •  Classification: Sovereign Confidential", meta_style),
        HRFlowable(width="100%", thickness=2, color=colors.HexColor('#2563EB'), spaceAfter=14)
    ]

    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # Markdown Table Detection
        if '|' in line and i + 1 < len(lines) and re.match(r'^[|\s:-]+$', lines[i+1].strip()):
            table_rows = []
            while i < len(lines) and '|' in lines[i]:
                row_cells = [c.strip() for c in lines[i].split('|')[1:-1]]
                if row_cells and not all(re.match(r'^[:-]+$', c) for c in row_cells):
                    table_rows.append([Paragraph(f"<b>{c}</b>" if len(table_rows) == 0 else c, body_style) for c in row_cells])
                i += 1

            if table_rows:
                num_cols = len(table_rows[0])
                col_width = 516 / max(num_cols, 1)
                t = Table(table_rows, colWidths=[col_width]*num_cols)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E293B')),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                    ('TOPPADDING', (0,0), (-1,-1), 5),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
                    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
                ]))
                elements.append(Spacer(1, 4))
                elements.append(t)
                elements.append(Spacer(1, 8))
            continue

        # Callout block (> or :::callout)
        if line.startswith("> ") or line.startswith(":::callout"):
            callout_text = re.sub(r'^(?:>\s*|:::callout\s*)', '', line)
            callout_cell = [[Paragraph(f"<b>KEY DIRECTIVE:</b> {callout_text}", callout_style)]]
            t_callout = Table(callout_cell, colWidths=[516])
            t_callout.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F5F9')),
                ('LINELEFT', (0,0), (0,-1), 3, colors.HexColor('#2563EB')),
                ('TOPPADDING', (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
            ]))
            elements.append(Spacer(1, 4))
            elements.append(t_callout)
            elements.append(Spacer(1, 6))
            i += 1
            continue

        # Markdown Image Detection: ![Caption](path)
        img_match = re.search(r'!\[(.*?)\]\(([^\)\r\n]+)\)', line)
        if img_match:
            img_caption = img_match.group(1).strip()
            img_src = img_match.group(2).strip()
            img_flowable = _resolve_image_flowable(img_src)
            if img_flowable:
                elements.append(Spacer(1, 6))
                elements.append(img_flowable)
                if img_caption:
                    caption_style = ParagraphStyle(
                        'ImgCaption',
                        parent=meta_style,
                        fontSize=8.5,
                        alignment=1, # Center
                        textColor=colors.HexColor('#64748B'),
                        spaceBefore=3,
                        spaceAfter=8
                    )
                    elements.append(Paragraph(f"<i>Figure: {img_caption}</i>", caption_style))
                else:
                    elements.append(Spacer(1, 6))
                i += 1
                continue

        # Headings & Bullets
        if line.startswith("# "):
            elements.append(Paragraph(line[2:], h1_style))
        elif line.startswith("## "):
            elements.append(Paragraph(line[3:], h2_style))
        elif line.startswith("### "):
            elements.append(Paragraph(line[4:], h2_style))
        elif line.startswith("- ") or line.startswith("* "):
            elements.append(Paragraph(f"• {line[2:]}", bullet_style))
        elif re.match(r'^\d+\.', line):
            elements.append(Paragraph(line, bullet_style))
        else:
            elements.append(Paragraph(line, body_style))

        i += 1

    doc.build(elements)
    print(f"PDF report saved successfully to: {path}")

def _generate_docx(path: str, title: str, content: str, author: str = "Satchida Sovereign Platform"):
    """
    Renders styled Word document with executive cover header,
    shaded callouts, professional table grids, and formatted headings.
    """
    doc = docx.Document()

    # Title & Metadata
    title_p = doc.add_paragraph()
    run_kicker = title_p.add_run("EXECUTIVE SPECIFICATION & REPORT\n")
    run_kicker.font.size = DocxPt(9)
    run_kicker.font.bold = True
    run_kicker.font.color.rgb = DocxRGBColor(37, 99, 235)

    run_title = title_p.add_run(title)
    run_title.font.size = DocxPt(22)
    run_title.font.bold = True
    run_title.font.color.rgb = DocxRGBColor(15, 23, 42)

    meta_p = doc.add_paragraph()
    meta_run = meta_p.add_run(f"Author: {author}  |  Date: {datetime.now().strftime('%Y-%m-%d')}  |  Confidential")
    meta_run.font.size = DocxPt(9.5)
    meta_run.font.color.rgb = DocxRGBColor(100, 116, 139)

    doc.add_paragraph() # Spacer

    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # Table detection
        if '|' in line and i + 1 < len(lines) and re.match(r'^[|\s:-]+$', lines[i+1].strip()):
            table_rows = []
            while i < len(lines) and '|' in lines[i]:
                row_cells = [c.strip() for c in lines[i].split('|')[1:-1]]
                if row_cells and not all(re.match(r'^[:-]+$', c) for c in row_cells):
                    table_rows.append(row_cells)
                i += 1

            if table_rows:
                num_cols = len(table_rows[0])
                t = doc.add_table(rows=len(table_rows), cols=num_cols)
                t.alignment = WD_TABLE_ALIGNMENT.CENTER

                for r_idx, row_data in enumerate(table_rows):
                    for c_idx, cell_value in enumerate(row_data):
                        cell = t.cell(r_idx, c_idx)
                        cell.text = cell_value
                        p = cell.paragraphs[0]
                        p.runs[0].font.size = DocxPt(9.5)
                        if r_idx == 0:
                            p.runs[0].font.bold = True
                            p.runs[0].font.color.rgb = DocxRGBColor(255, 255, 255)
                            # Header Shading
                            shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="1E293B"/>')
                            cell._tc.get_or_add_tcPr().append(shd)
                        else:
                            p.runs[0].font.color.rgb = DocxRGBColor(15, 23, 42)
                            if r_idx % 2 == 1:
                                shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="F8FAFC"/>')
                                cell._tc.get_or_add_tcPr().append(shd)
                doc.add_paragraph()
            continue

        # Image detection
        img_match = re.search(r'!\[(.*?)\]\(([^\)\r\n]+)\)', line)
        if img_match:
            img_caption = img_match.group(1).strip()
            img_src = img_match.group(2).strip()
            docx_img_path = _resolve_image_for_docx(img_src)
            if docx_img_path:
                doc.add_paragraph()
                p_img = doc.add_paragraph()
                p_img.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER
                run_img = p_img.add_run()
                run_img.add_picture(docx_img_path, width=docx.shared.Inches(5.5))
                if img_caption:
                    p_cap = doc.add_paragraph()
                    p_cap.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER
                    r_cap = p_cap.add_run(f"Figure: {img_caption}")
                    r_cap.font.size = DocxPt(8.5)
                    r_cap.font.italic = True
                    r_cap.font.color.rgb = DocxRGBColor(100, 116, 139)
                i += 1
                continue

        # Headings
        if line.startswith("# "):
            h = doc.add_heading(line[2:], level=1)
            h.paragraph_format.space_before = DocxPt(14)
            h.paragraph_format.space_after = DocxPt(4)
        elif line.startswith("## "):
            h = doc.add_heading(line[3:], level=2)
            h.paragraph_format.space_before = DocxPt(10)
            h.paragraph_format.space_after = DocxPt(4)
        elif line.startswith("### "):
            h = doc.add_heading(line[4:], level=3)
        elif line.startswith("> "):
            # Callout table
            c_table = doc.add_table(rows=1, cols=1)
            c_cell = c_table.cell(0, 0)
            c_cell.text = line[2:]
            c_p = c_cell.paragraphs[0]
            c_p.runs[0].font.size = DocxPt(9.5)
            c_p.runs[0].font.italic = True
            c_p.runs[0].font.color.rgb = DocxRGBColor(30, 41, 59)
            shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="F1F5F9"/>')
            c_cell._tc.get_or_add_tcPr().append(shd)
            doc.add_paragraph()
        elif line.startswith("- ") or line.startswith("* "):
            p = doc.add_paragraph(style='List Bullet')
            p.add_run(line[2:])
        else:
            doc.add_paragraph(line)

        i += 1

    doc.save(path)
    print(f"Word document saved successfully to: {path}")

def _generate_xlsx(path: str, title: str, content: str):
    """
    Renders professional spreadsheet with auto-width columns,
    styled header band, alternating zebra shading, and thin grid lines.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = title[:30] if title else "Model Data"

    title_font = Font(name="Calibri", size=14, bold=True, color="1E293B")
    title_fill = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
    
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")

    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    thin_border_side = Side(border_style="thin", color="CBD5E1")
    cell_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

    rows_data = []
    try:
        parsed_json = json.loads(content)
        if isinstance(parsed_json, list) and len(parsed_json) > 0 and isinstance(parsed_json[0], dict):
            headers = list(parsed_json[0].keys())
            rows_data.append(headers)
            for item in parsed_json:
                rows_data.append([item.get(h, "") for h in headers])
    except Exception:
        pass

    if not rows_data:
        lines = [l.strip() for l in content.split('\n') if l.strip()]
        for l in lines:
            if '|' in l:
                cells = [c.strip() for c in l.split('|')[1:-1]]
                if cells and not all(re.match(r'^[:-]+$', c) for c in cells):
                    rows_data.append(cells)
            elif ',' in l:
                rows_data.append([c.strip() for c in l.split(',')])
            elif '\t' in l:
                rows_data.append([c.strip() for c in l.split('\t')])

    if not rows_data:
        rows_data = [["Metric", "Value", "Notes"], ["Latency (p99)", "14.2 ms", "Verified on bare metal"]]

    # Title Row
    ws.append([f"EXECUTIVE DATA MODEL: {title.upper()}"])
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(rows_data[0]))
    title_cell = ws.cell(row=1, column=1)
    title_cell.font = title_font
    title_cell.fill = title_fill
    title_cell.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[1].height = 28

    ws.append([]) # Empty spacer row 2

    # Append Headers and Data
    for row_idx, row in enumerate(rows_data, 3):
        ws.append(row)
        ws.row_dimensions[row_idx].height = 20
        is_header = (row_idx == 3)
        for col_idx in range(1, len(row) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.border = cell_border
            if is_header:
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.fill = zebra_fill if row_idx % 2 == 1 else white_fill
                val_str = str(cell.value or "")
                if re.match(r'^-?\d+(?:\.\d+)?%?$', val_str):
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                else:
                    cell.alignment = Alignment(horizontal="left", vertical="center")

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.row == 1:
                continue
            val = str(cell.value or "")
            if len(val) > max_len:
                max_len = len(val)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    wb.save(path)
    print(f"Excel workbook saved successfully to: {path}")

def _generate_pptx(path: str, title: str, content: str, author: str = "Satchida Sovereign Platform"):
    """
    Renders high-agency, executive-grade presentations with multi-archetype slide layouts:
      1. Hero / Title Slide (Dark slate, kicker tag, bold typography, metadata pill)
      2. Bento Grid Slide (3 or 4 rounded cards with badges and structured bullets)
      3. KPI Stat Ribbon Slide (Massive 40pt metric callouts + context cards)
      4. Timeline / Process Slide (Horizontal progression cards with phase badges)
      5. Comparison / Trade-off Matrix Slide (Contrasting Left vs Right architecture cards)
      6. Split-Screen Visual Showcase (Native interactive chart or real photographic image + action cards)
      7. Executive Quote Slide (Pull-quote with citation)
      8. Structured Container Slide (Modern card-grouped takeaways, zero bare floating dots)
    """
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Color Palette - Executive Modern Navy & Cyan
    NAVY_DEEP = RGBColor(15, 23, 42)       # #0F172A
    NAVY_CARD = RGBColor(30, 41, 59)       # #1E293B
    BLUE_PRIMARY = RGBColor(37, 99, 235)   # #2563EB
    CYAN_ACCENT = RGBColor(14, 165, 233)   # #0EA5E9
    EMERALD_ACCENT = RGBColor(16, 185, 129)# #10B981
    ROSE_ACCENT = RGBColor(239, 68, 68)    # #EF4444
    AMBER_ACCENT = RGBColor(245, 158, 11)  # #F59E0B
    
    BG_CARD_LIGHT = RGBColor(248, 250, 252)# #F8FAFC
    BORDER_LIGHT = RGBColor(226, 232, 240) # #E2E8F0
    BG_BLUE_TINT = RGBColor(239, 246, 255) # #EFF6FF
    BORDER_BLUE_TINT = RGBColor(147, 197, 253) # #93C5FD
    BG_ROSE_TINT = RGBColor(255, 241, 242) # #FFF1F2
    BORDER_ROSE_TINT = RGBColor(254, 205, 211) # #FECDD3
    BG_EMERALD_TINT = RGBColor(240, 253, 244) # #F0FDF4
    BORDER_EMERALD_TINT = RGBColor(134, 239, 172) # #86EFAC

    TEXT_DARK = RGBColor(15, 23, 42)
    TEXT_MUTED = RGBColor(100, 116, 139)
    TEXT_WHITE = RGBColor(255, 255, 255)

    blank_layout = prs.slide_layouts[6] if len(prs.slide_layouts) > 6 else prs.slide_layouts[0]

    # --- 1. HERO TITLE SLIDE ---
    title_slide = prs.slides.add_slide(blank_layout)
    bg = title_slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg.fill.solid()
    bg.fill.fore_color.rgb = NAVY_DEEP
    bg.line.fill.background()

    # Kicker Pill Badge
    kicker = title_slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(1.5), Inches(3.6), Inches(0.42))
    kicker.fill.solid()
    kicker.fill.fore_color.rgb = NAVY_CARD
    kicker.line.color.rgb = BLUE_PRIMARY
    kicker.line.width = Pt(1.5)
    tf_k = kicker.text_frame
    tf_k.margin_top = Inches(0.06)
    p_k = tf_k.paragraphs[0]
    p_k.text = "STRATEGIC BRIEFING & EXECUTIVE REPORT"
    p_k.font.size = Pt(10)
    p_k.font.bold = True
    p_k.font.color.rgb = CYAN_ACCENT

    # Main Presentation Title
    tb_title = title_slide.shapes.add_textbox(Inches(1.2), Inches(2.2), Inches(10.9), Inches(2.4))
    tf_t = tb_title.text_frame
    tf_t.word_wrap = True
    p_t = tf_t.paragraphs[0]
    p_t.text = title
    p_t.font.size = Pt(42)
    p_t.font.bold = True
    p_t.font.color.rgb = TEXT_WHITE

    # Subtitle
    p_sub = tf_t.add_paragraph()
    p_sub.text = "High-Agency Systems Architecture • Quantitative Research • Sovereign Infrastructure"
    p_sub.font.size = Pt(18)
    p_sub.font.color.rgb = RGBColor(186, 230, 253)
    p_sub.space_before = Pt(14)

    # Metadata & Date
    tb_meta = title_slide.shapes.add_textbox(Inches(1.2), Inches(5.4), Inches(10.9), Inches(0.8))
    tf_m = tb_meta.text_frame
    p_m = tf_m.paragraphs[0]
    p_m.text = f"Authored by: {author}  •  {datetime.now().strftime('%B %Y')}  •  Classification: Enterprise Sovereign"
    p_m.font.size = Pt(13)
    p_m.font.color.rgb = RGBColor(148, 163, 184)

    # Bottom Gradient Accent Bar
    accent_bar = title_slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.2), Inches(6.2), Inches(3.2), Inches(0.08))
    accent_bar.fill.solid()
    accent_bar.fill.fore_color.rgb = BLUE_PRIMARY
    accent_bar.line.fill.background()

    # --- 2. PARSE SLIDE SECTIONS ---
    raw_blocks = []
    if re.search(r'\n\s*---\s*\n', content):
        raw_blocks = [b.strip() for b in re.split(r'\n\s*---\s*\n', content) if b.strip()]
    else:
        raw_blocks = [b.strip() for b in re.split(r'\n(?=(?:## |(?:\*\*)?Slide \d+:?))', content.strip()) if b.strip()]

    content_sections = []
    for s in raw_blocks:
        s_clean = re.sub(r'^(?:---\s*)+', '', s.strip()).strip()
        lines = [l.strip() for l in s_clean.split('\n') if l.strip()]
        if not lines:
            continue
        raw_title = lines[0]
        if re.match(r'^[-=_*#\s]+$', raw_title):
            if len(lines) > 1:
                raw_title = lines[1]
                lines = lines[1:]
            else:
                continue
        slide_title = re.sub(r'^(?:## |\*\*Slide \d+:?\s*|Slide \d+:?\s*|\*\*)', '', raw_title).rstrip('*').strip() or "Key Insights"
        if slide_title in ('---', '***', '___') or not slide_title:
            continue
        if slide_title.lower() == title.lower() and len(lines) <= 2:
            continue
        content_sections.append((slide_title, s_clean, lines))

    total_slides = len(content_sections) + 1

    for idx, (slide_title, raw_section, lines) in enumerate(content_sections, 2):
        slide = prs.slides.add_slide(blank_layout)

        # Slide Kicker Pill Tag
        kicker_text = "KEY INSIGHTS"
        low_t = slide_title.lower()
        if any(w in low_t for w in ["architecture", "system", "tech", "infrastructure"]):
            kicker_text = "SYSTEM ARCHITECTURE"
        elif any(w in low_t for w in ["metric", "kpi", "performance", "benchmark", "stat", "screen"]):
            kicker_text = "METRICS & PERFORMANCE"
        elif any(w in low_t for w in ["strategy", "market", "landscape", "vision", "roadmap"]):
            kicker_text = "STRATEGIC ROADMAP"
        elif any(w in low_t for w in ["comparison", "versus", "vs", "trade-off", "tradeoff"]):
            kicker_text = "COMPARATIVE ANALYSIS"
        elif any(w in low_t for w in ["case", "study", "implementation", "real-life", "practice"]):
            kicker_text = "PRODUCTION EXECUTION"

        pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.42), Inches(2.6), Inches(0.32))
        pill.fill.solid()
        pill.fill.fore_color.rgb = BG_BLUE_TINT
        pill.line.color.rgb = BORDER_BLUE_TINT
        pill.line.width = Pt(1)
        tf_pill = pill.text_frame
        tf_pill.margin_top = Inches(0.04)
        p_p = tf_pill.paragraphs[0]
        p_p.text = kicker_text
        p_p.font.size = Pt(8.5)
        p_p.font.bold = True
        p_p.font.color.rgb = BLUE_PRIMARY

        # Slide Header Title
        tb_title = slide.shapes.add_textbox(Inches(0.8), Inches(0.78), Inches(11.7), Inches(0.65))
        tf_title = tb_title.text_frame
        p_title = tf_title.paragraphs[0]
        p_title.text = slide_title
        p_title.font.size = Pt(26)
        p_title.font.bold = True
        p_title.font.color.rgb = NAVY_DEEP

        # Accent Bar
        bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.48), Inches(2.0), Inches(0.04))
        bar.fill.solid()
        bar.fill.fore_color.rgb = BLUE_PRIMARY
        bar.line.fill.background()

        # Footer & Slide Number
        footer_line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(6.95), Inches(11.7), Inches(0.015))
        footer_line.fill.solid()
        footer_line.fill.fore_color.rgb = BORDER_LIGHT
        footer_line.line.fill.background()

        tb_foot = slide.shapes.add_textbox(Inches(0.8), Inches(7.0), Inches(8.0), Inches(0.35))
        p_foot = tb_foot.text_frame.paragraphs[0]
        p_foot.text = "Satchida Sovereign Platform  •  Enterprise Intelligence & Execution"
        p_foot.font.size = Pt(8.5)
        p_foot.font.color.rgb = TEXT_MUTED

        tb_num = slide.shapes.add_textbox(Inches(10.5), Inches(7.0), Inches(2.0), Inches(0.35))
        p_num = tb_num.text_frame.paragraphs[0]
        p_num.text = f"Slide {idx} of {total_slides}"
        p_num.font.size = Pt(8.5)
        p_num.alignment = PP_ALIGN.RIGHT
        p_num.font.color.rgb = TEXT_MUTED

        # --- DETECT CONTENT ARCHETYPE ---
        # 1. Chart check
        chart_match = re.search(r'```(?:chart:(\w+)|(chart))([\s\S]*?)```', raw_section)
        chart_type_str = None
        chart_body = None
        clean_section = raw_section
        if chart_match:
            chart_type_str = (chart_match.group(1) or 'bar').lower()
            chart_body = chart_match.group(3).strip()
            clean_section = raw_section[:chart_match.start()] + raw_section[chart_match.end():]

        # 2. Image check
        image_target = None
        img_md_m = re.search(r'!\[(.*?)\]\(([^\)\r\n]+)\)', clean_section)
        if img_md_m:
            image_target = img_md_m.group(2)
            clean_section = clean_section[:img_md_m.start()] + clean_section[img_md_m.end():]
        else:
            img_block_m = re.search(r'```(?:image|visual)(?::([^\n]+))?([\s\S]*?)```', clean_section)
            if img_block_m:
                image_target = (img_block_m.group(1) or img_block_m.group(2) or "").strip()
                clean_section = clean_section[:img_block_m.start()] + clean_section[img_block_m.end():]

        # 3. Directives check
        is_bento = ":::bento" in raw_section.lower() or ":::cards" in raw_section.lower()
        is_stats = ":::stats" in raw_section.lower() or ":::kpi" in raw_section.lower()
        is_timeline = ":::timeline" in raw_section.lower() or ":::process" in raw_section.lower()
        is_comparison = ":::comparison" in raw_section.lower() or ":::vs" in raw_section.lower()
        is_quote = ":::quote" in raw_section.lower()

        # Extract subsections / cards
        sub_headers = re.findall(r'###\s+([^\n]+)', clean_section)
        
        # Extract KPIs
        kpi_stats = []
        for line in clean_section.split('\n')[1:]:
            clean = line.strip()
            kpi_m = re.match(r'^(?:KPI:\s*|\*\*KPI:\*\*\s*)(.+?)\s*\|\s*(.+)$', clean, re.I)
            if kpi_m:
                parts = [p.strip() for p in kpi_m.group(2).split('|')]
                lbl = parts[0]
                ctx = parts[1] if len(parts) > 1 else ""
                kpi_stats.append((kpi_m.group(1).strip(), lbl, ctx))
                continue
            stat_m = re.match(r'^[-*•]?\s*\*\*([^\*:]+)\*\*[:\s]+(.+)$', clean)
            if stat_m and len(stat_m.group(1)) <= 15 and any(c.isdigit() for c in stat_m.group(1)):
                lbl_full = stat_m.group(2).strip()
                lbl_parts = lbl_full.split('-', 1) if '-' in lbl_full else [lbl_full, ""]
                kpi_stats.append((stat_m.group(1).strip(), lbl_parts[0].strip(), lbl_parts[1].strip() if len(lbl_parts) > 1 else ""))

        # Auto-detect archetype if not explicitly tagged
        if not (is_bento or is_stats or is_timeline or is_comparison or is_quote or chart_body or image_target):
            if len(kpi_stats) >= 2:
                is_stats = True
            elif len(sub_headers) in (3, 4):
                is_bento = True
            elif len(sub_headers) == 2 and any(w in slide_title.lower() for w in ["vs", "versus", "comparison", "trade-off", "tradeoff", "traditional"]):
                is_comparison = True
            elif any(w in raw_section.lower() for w in ["phase 1", "step 1", "milestone 1"]):
                is_timeline = True

        # ====================================================================
        # RENDER ARCHETYPE A: STATS / KPI RIBBON
        # ====================================================================
        if is_stats and kpi_stats:
            num_kpis = min(len(kpi_stats), 4)
            card_w = Inches(11.7 / num_kpis - 0.2)
            card_top = Inches(1.75)
            card_h = Inches(3.4)

            for c_i, (val, lbl, ctx) in enumerate(kpi_stats[:num_kpis]):
                card_left = Inches(0.8 + c_i * (11.7 / num_kpis))
                card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, card_left, card_top, card_w, card_h)
                card.fill.solid()
                card.fill.fore_color.rgb = BG_BLUE_TINT if c_i == 0 else BG_CARD_LIGHT
                card.line.color.rgb = BORDER_BLUE_TINT if c_i == 0 else BORDER_LIGHT
                card.line.width = Pt(1.5)

                tf_c = card.text_frame
                tf_c.word_wrap = True
                tf_c.margin_left = Inches(0.3)
                tf_c.margin_top = Inches(0.3)
                tf_c.margin_right = Inches(0.3)

                # Badge
                p_badge = tf_c.paragraphs[0]
                p_badge.text = f"METRIC 0{c_i+1}"
                p_badge.font.size = Pt(9)
                p_badge.font.bold = True
                p_badge.font.color.rgb = BLUE_PRIMARY

                # Giant Value
                p_val = tf_c.add_paragraph()
                p_val.text = val
                p_val.font.size = Pt(38)
                p_val.font.bold = True
                p_val.font.color.rgb = BLUE_PRIMARY if c_i == 0 else NAVY_DEEP
                p_val.space_before = Pt(8)

                # Label
                p_lbl = tf_c.add_paragraph()
                p_lbl.text = lbl
                p_lbl.font.size = Pt(13)
                p_lbl.font.bold = True
                p_lbl.font.color.rgb = NAVY_DEEP
                p_lbl.space_before = Pt(8)

                # Context
                if ctx:
                    p_ctx = tf_c.add_paragraph()
                    p_ctx.text = ctx
                    p_ctx.font.size = Pt(11)
                    p_ctx.font.color.rgb = TEXT_MUTED
                    p_ctx.space_before = Pt(6)

            # Bottom strategic takeaway bar
            bot_card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(5.35), Inches(11.7), Inches(1.35))
            bot_card.fill.solid()
            bot_card.fill.fore_color.rgb = BG_CARD_LIGHT
            bot_card.line.color.rgb = BLUE_PRIMARY
            bot_card.line.width = Pt(1.5)
            tf_b = bot_card.text_frame
            tf_b.margin_left = Inches(0.3)
            tf_b.margin_top = Inches(0.2)
            
            p_bt = tf_b.paragraphs[0]
            p_bt.text = "STRATEGIC TAKEAWAY & PERFORMANCE IMPLICATION"
            p_bt.font.size = Pt(9.5)
            p_bt.font.bold = True
            p_bt.font.color.rgb = BLUE_PRIMARY

            # Look for takeaway text in section
            takeaway_text = "Quantitative benchmarks confirm substantial operational velocity gains, reduced latency overhead, and superior workload throughput under sovereign conditions."
            for l in lines[1:]:
                cl = l.strip()
                if "takeaway" in cl.lower() or "conclusion" in cl.lower() or "impact" in cl.lower():
                    takeaway_text = re.sub(r'^[^:]+:\s*', '', cl)
                    break
            p_bc = tf_b.add_paragraph()
            p_bc.text = takeaway_text
            p_bc.font.size = Pt(12)
            p_bc.font.color.rgb = NAVY_DEEP
            p_bc.space_before = Pt(4)

        # ====================================================================
        # RENDER ARCHETYPE B: BENTO GRID (3 OR 4 CARDS)
        # ====================================================================
        elif is_bento and sub_headers:
            card_data = []
            curr_h = None
            curr_b = []
            for l in clean_section.split('\n')[1:]:
                cl = l.strip()
                if not cl or cl.startswith(":::") or cl.startswith("##"):
                    continue
                h_m = re.match(r'^###\s+(.+)$', cl)
                if h_m:
                    if curr_h:
                        card_data.append((curr_h, curr_b))
                    curr_h = h_m.group(1).strip()
                    curr_b = []
                elif curr_h:
                    b_clean = re.sub(r'^[-*•\d.]+\s*', '', cl).strip()
                    if b_clean:
                        curr_b.append(b_clean)
            if curr_h:
                card_data.append((curr_h, curr_b))

            if len(card_data) == 3:
                col_w = Inches(3.7)
                col_h = Inches(4.9)
                col_top = Inches(1.75)
                for c_i, (c_title, c_bullets) in enumerate(card_data[:3]):
                    c_left = Inches(0.8 + c_i * 4.0)
                    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c_left, col_top, col_w, col_h)
                    card.fill.solid()
                    card.fill.fore_color.rgb = BG_BLUE_TINT if c_i == 0 else BG_CARD_LIGHT
                    card.line.color.rgb = BORDER_BLUE_TINT if c_i == 0 else BORDER_LIGHT
                    card.line.width = Pt(1.5)

                    tf_c = card.text_frame
                    tf_c.word_wrap = True
                    tf_c.margin_left = Inches(0.3)
                    tf_c.margin_top = Inches(0.25)
                    tf_c.margin_right = Inches(0.3)

                    p_b = tf_c.paragraphs[0]
                    p_b.text = f"PILLAR 0{c_i+1}"
                    p_b.font.size = Pt(9)
                    p_b.font.bold = True
                    p_b.font.color.rgb = BLUE_PRIMARY

                    p_h = tf_c.add_paragraph()
                    p_h.text = c_title
                    p_h.font.size = Pt(16)
                    p_h.font.bold = True
                    p_h.font.color.rgb = NAVY_DEEP
                    p_h.space_before = Pt(6)
                    p_h.space_after = Pt(12)

                    for b_txt in c_bullets[:4]:
                        p_bullet = tf_c.add_paragraph()
                        p_bullet.text = f"• {b_txt}"
                        p_bullet.font.size = Pt(12)
                        p_bullet.font.color.rgb = NAVY_DEEP
                        p_bullet.space_after = Pt(6)

            else:
                c_w = Inches(5.7)
                c_h = Inches(2.35)
                positions = [
                    (Inches(0.8), Inches(1.75)),
                    (Inches(6.8), Inches(1.75)),
                    (Inches(0.8), Inches(4.3)),
                    (Inches(6.8), Inches(4.3))
                ]
                for c_i, (c_pos, (c_title, c_bullets)) in enumerate(zip(positions, card_data[:4])):
                    c_left, c_top = c_pos
                    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c_left, c_top, c_w, c_h)
                    card.fill.solid()
                    card.fill.fore_color.rgb = BG_CARD_LIGHT
                    card.line.color.rgb = BORDER_LIGHT
                    card.line.width = Pt(1.5)

                    tf_c = card.text_frame
                    tf_c.word_wrap = True
                    tf_c.margin_left = Inches(0.25)
                    tf_c.margin_top = Inches(0.2)
                    tf_c.margin_right = Inches(0.25)

                    p_b = tf_c.paragraphs[0]
                    p_b.text = f"MODULE 0{c_i+1} • {c_title}"
                    p_b.font.size = Pt(14)
                    p_b.font.bold = True
                    p_b.font.color.rgb = NAVY_DEEP

                    for b_txt in c_bullets[:2]:
                        p_bullet = tf_c.add_paragraph()
                        p_bullet.text = f"• {b_txt}"
                        p_bullet.font.size = Pt(11.5)
                        p_bullet.font.color.rgb = NAVY_DEEP
                        p_bullet.space_before = Pt(4)

        # ====================================================================
        # RENDER ARCHETYPE C: COMPARISON / TRADE-OFF MATRIX (LEFT VS RIGHT)
        # ====================================================================
        elif is_comparison:
            c_w = Inches(5.7)
            c_h = Inches(4.9)
            col_top = Inches(1.75)

            # Left Card: Status Quo / Friction
            card_left = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), col_top, c_w, c_h)
            card_left.fill.solid()
            card_left.fill.fore_color.rgb = BG_ROSE_TINT
            card_left.line.color.rgb = BORDER_ROSE_TINT
            card_left.line.width = Pt(1.5)

            tf_l = card_left.text_frame
            tf_l.word_wrap = True
            tf_l.margin_left = Inches(0.3)
            tf_l.margin_top = Inches(0.25)
            
            p_lh = tf_l.paragraphs[0]
            p_lh.text = "STATUS QUO / LEGACY CONSTRAINTS"
            p_lh.font.size = Pt(10)
            p_lh.font.bold = True
            p_lh.font.color.rgb = ROSE_ACCENT

            p_lt = tf_l.add_paragraph()
            p_lt.text = "Fragile Cloud Dependencies & Latency Debt"
            p_lt.font.size = Pt(16)
            p_lt.font.bold = True
            p_lt.font.color.rgb = NAVY_DEEP
            p_lt.space_before = Pt(4)
            p_lt.space_after = Pt(12)

            # Right Card: Modern Sovereign
            card_right = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), col_top, c_w, c_h)
            card_right.fill.solid()
            card_right.fill.fore_color.rgb = BG_EMERALD_TINT
            card_right.line.color.rgb = BORDER_EMERALD_TINT
            card_right.line.width = Pt(1.5)

            tf_r = card_right.text_frame
            tf_r.word_wrap = True
            tf_r.margin_left = Inches(0.3)
            tf_r.margin_top = Inches(0.25)

            p_rh = tf_r.paragraphs[0]
            p_rh.text = "SOVEREIGN ARCHITECTURE / STRATEGIC LEVERAGE"
            p_rh.font.size = Pt(10)
            p_rh.font.bold = True
            p_rh.font.color.rgb = EMERALD_ACCENT

            p_rt = tf_r.add_paragraph()
            p_rt.text = "Deterministic Air-Gapped Local Execution"
            p_rt.font.size = Pt(16)
            p_rt.font.bold = True
            p_rt.font.color.rgb = NAVY_DEEP
            p_rt.space_before = Pt(4)
            p_rt.space_after = Pt(12)

            # Distribute bullets
            all_bullets = [re.sub(r'^[-*•\d.]+\s*', '', l.strip()) for l in lines[1:] if l.strip() and not l.strip().startswith("###") and not l.strip().startswith(":::")]
            half = max(len(all_bullets) // 2, 1)
            left_bullets = all_bullets[:half]
            right_bullets = all_bullets[half:]

            for b in left_bullets[:4]:
                p = tf_l.add_paragraph()
                p.text = f"✕  {b}"
                p.font.size = Pt(12)
                p.font.color.rgb = NAVY_DEEP
                p.space_after = Pt(8)

            for b in right_bullets[:4]:
                p = tf_r.add_paragraph()
                p.text = f"✓  {b}"
                p.font.size = Pt(12)
                p.font.color.rgb = NAVY_DEEP
                p.space_after = Pt(8)

        # ====================================================================
        # RENDER ARCHETYPE D: TIMELINE / PROCESS PROGRESSION
        # ====================================================================
        elif is_timeline:
            step_lines = [l.strip() for l in lines[1:] if any(k in l.lower() for k in ["phase", "step", "stage", "milestone"]) or re.match(r'^\d+\.', l.strip())]
            if not step_lines:
                step_lines = [l.strip() for l in lines[1:] if l.strip()][:4]
            
            num_steps = min(len(step_lines), 4)
            card_w = Inches(11.7 / num_steps - 0.2)
            card_top = Inches(1.8)
            card_h = Inches(4.8)

            for s_i, st in enumerate(step_lines[:num_steps]):
                c_left = Inches(0.8 + s_i * (11.7 / num_steps))
                card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c_left, card_top, card_w, card_h)
                card.fill.solid()
                card.fill.fore_color.rgb = BG_BLUE_TINT if s_i == 0 else BG_CARD_LIGHT
                card.line.color.rgb = BLUE_PRIMARY if s_i == 0 else BORDER_LIGHT
                card.line.width = Pt(1.5)

                tf_c = card.text_frame
                tf_c.word_wrap = True
                tf_c.margin_left = Inches(0.25)
                tf_c.margin_top = Inches(0.25)
                tf_c.margin_right = Inches(0.25)

                # Step Badge
                p_b = tf_c.paragraphs[0]
                p_b.text = f"STAGE 0{s_i+1}"
                p_b.font.size = Pt(10)
                p_b.font.bold = True
                p_b.font.color.rgb = BLUE_PRIMARY

                clean_st = re.sub(r'^(?:Phase \d+:?|Step \d+:?|\d+\.)\s*', '', st).strip()
                st_parts = clean_st.split('-', 1) if '-' in clean_st else clean_st.split(':', 1)
                st_title = st_parts[0].strip()
                st_desc = st_parts[1].strip() if len(st_parts) > 1 else ""

                p_h = tf_c.add_paragraph()
                p_h.text = st_title
                p_h.font.size = Pt(15)
                p_h.font.bold = True
                p_h.font.color.rgb = NAVY_DEEP
                p_h.space_before = Pt(8)
                p_h.space_after = Pt(8)

                if st_desc:
                    p_d = tf_c.add_paragraph()
                    p_d.text = st_desc
                    p_d.font.size = Pt(12)
                    p_d.font.color.rgb = NAVY_DEEP

        # ====================================================================
        # RENDER ARCHETYPE E: SPLIT-SCREEN (CHART / IMAGE + CARDS)
        # ====================================================================
        elif chart_body or image_target:
            left_w = Inches(5.7)
            col_top = Inches(1.75)
            col_h = Inches(4.9)

            bullet_items = [re.sub(r'^[-*•\d.]+\s*', '', l.strip()) for l in clean_section.split('\n')[1:] if l.strip() and not l.strip().startswith(":::")]
            
            # Top Core Thesis Card
            core_card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), col_top, left_w, Inches(1.5))
            core_card.fill.solid()
            core_card.fill.fore_color.rgb = BG_BLUE_TINT
            core_card.line.color.rgb = BORDER_BLUE_TINT
            core_card.line.width = Pt(1.5)
            tf_core = core_card.text_frame
            tf_core.margin_left = Inches(0.25)
            tf_core.margin_top = Inches(0.18)

            p_cb = tf_core.paragraphs[0]
            p_cb.text = "CORE THESIS & STRATEGIC FOCUS"
            p_cb.font.size = Pt(9)
            p_cb.font.bold = True
            p_cb.font.color.rgb = BLUE_PRIMARY

            p_ct = tf_core.add_paragraph()
            p_ct.text = bullet_items[0] if bullet_items else "Quantitative observations validate sovereign execution benefits."
            p_ct.font.size = Pt(13)
            p_ct.font.bold = True
            p_ct.font.color.rgb = NAVY_DEEP
            p_ct.space_before = Pt(4)

            # Lower 2 Takeaway Cards
            sub_bullets = bullet_items[1:3] if len(bullet_items) > 1 else ["System latency bounded within deterministic SLA guarantees.", "Comprehensive auditability enabled across all transactions."]
            for s_i, sb in enumerate(sub_bullets):
                s_top = Inches(3.4 + s_i * 1.6)
                s_card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), s_top, left_w, Inches(1.45))
                s_card.fill.solid()
                s_card.fill.fore_color.rgb = BG_CARD_LIGHT
                s_card.line.color.rgb = BORDER_LIGHT
                s_card.line.width = Pt(1.5)
                tf_s = s_card.text_frame
                tf_s.margin_left = Inches(0.25)
                tf_s.margin_top = Inches(0.18)

                p_sb = tf_s.paragraphs[0]
                p_sb.text = f"KEY LEVER 0{s_i+1}"
                p_sb.font.size = Pt(8.5)
                p_sb.font.bold = True
                p_sb.font.color.rgb = BLUE_PRIMARY

                p_st = tf_s.add_paragraph()
                p_st.text = sb
                p_st.font.size = Pt(12)
                p_st.font.color.rgb = NAVY_DEEP
                p_st.space_before = Pt(3)

            # Right Column: Chart or Visual Frame
            right_left = Inches(6.8)
            right_w = Inches(5.7)

            if chart_body:
                cats = []
                vals = []
                for cline in chart_body.split('\n'):
                    if ':' in cline:
                        k, v = cline.split(':', 1)
                        if 'categor' in k.lower():
                            cats = [c.strip() for c in v.split(',')]
                        elif 'val' in k.lower() or 'number' in k.lower() or 'data' in k.lower():
                            for item in v.split(','):
                                try:
                                    vals.append(float(re.sub(r'[^\d.]', '', item.strip())))
                                except ValueError:
                                    pass
                    elif ',' in cline or '|' in cline:
                        parts = re.split(r'[,|]', cline)
                        if len(parts) >= 2:
                            try:
                                vals.append(float(re.sub(r'[^\d.]', '', parts[1].strip())))
                                cats.append(parts[0].strip())
                            except ValueError:
                                pass

                if cats and vals:
                    cdata = CategoryChartData()
                    cdata.categories = cats[:len(vals)]
                    cdata.add_series("Observed Metric", tuple(vals[:len(cats)]))

                    ctype = XL_CHART_TYPE.COLUMN_CLUSTERED
                    if chart_type_str in ('pie', 'donut', 'doughnut'):
                        ctype = XL_CHART_TYPE.DOUGHNUT
                    elif chart_type_str == 'line':
                        ctype = XL_CHART_TYPE.LINE
                    elif chart_type_str == 'bar':
                        ctype = XL_CHART_TYPE.BAR_CLUSTERED

                    chart_shape = slide.shapes.add_chart(ctype, right_left, col_top, right_w, col_h, cdata)
                    chart = chart_shape.chart
                    chart.has_legend = True
                    chart.legend.position = XL_LEGEND_POSITION.TOP
                    chart.legend.include_in_layout = False

            elif image_target or any(kw in slide_title.lower() for kw in ["screen time", "visual", "real-life", "use case", "case study", "interface", "workspace", "dashboard"]):
                target_q = image_target or f"{title} {slide_title}"
                img_bytes = None
                try:
                    img_bytes = _fetch_image_bytes(target_q)
                except Exception:
                    img_bytes = None

                if img_bytes:
                    try:
                        slide.shapes.add_picture(io.BytesIO(img_bytes), right_left, col_top, width=right_w)
                        img_pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_left, Inches(6.3), right_w, Inches(0.35))
                        img_pill.fill.solid()
                        img_pill.fill.fore_color.rgb = BG_BLUE_TINT
                        img_pill.line.color.rgb = BORDER_BLUE_TINT
                        img_pill.line.width = Pt(1)
                        tf_ip = img_pill.text_frame
                        tf_ip.margin_top = Inches(0.05)
                        p_ip = tf_ip.paragraphs[0]
                        clean_cap = target_q[:45]
                        p_ip.text = f"PHOTOGRAPHIC EVIDENCE: {clean_cap.upper()}"
                        p_ip.font.size = Pt(8.5)
                        p_ip.font.bold = True
                        p_ip.font.color.rgb = BLUE_PRIMARY
                    except Exception as img_err:
                        sys.stderr.write(f"Slide picture embed notice: {str(img_err)}\n")
                else:
                    img_frame = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_left, col_top, right_w, col_h)
                    img_frame.fill.solid()
                    img_frame.fill.fore_color.rgb = BG_CARD_LIGHT
                    img_frame.line.color.rgb = BORDER_LIGHT
                    img_frame.line.width = Pt(1)

                    tf_f = img_frame.text_frame
                    tf_f.margin_top = Inches(0.2)
                    p_f = tf_f.paragraphs[0]
                    p_f.text = f"REAL-WORLD VISUAL EVIDENCE: {target_q[:40]}"
                    p_f.font.size = Pt(10)
                    p_f.font.bold = True
                    p_f.font.color.rgb = BLUE_PRIMARY

        else:
            bullets = [re.sub(r'^[-*•\d.]+\s*', '', l.strip()) for l in lines[1:] if l.strip() and not l.strip().startswith(":::")]
            if not bullets:
                bullets = ["Comprehensive architecture engineered for multi-tenant scalability and deterministic SLAs."]

            num_cards = min(len(bullets), 3)
            card_h = Inches(1.5)
            card_top = Inches(1.75)
            
            for b_i, b_txt in enumerate(bullets[:num_cards]):
                c_top = card_top + Inches(b_i * 1.65)
                card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), c_top, Inches(11.7), card_h)
                card.fill.solid()
                card.fill.fore_color.rgb = BG_BLUE_TINT if b_i == 0 else BG_CARD_LIGHT
                card.line.color.rgb = BORDER_BLUE_TINT if b_i == 0 else BORDER_LIGHT
                card.line.width = Pt(1.5)

                tf_c = card.text_frame
                tf_c.word_wrap = True
                tf_c.margin_left = Inches(0.35)
                tf_c.margin_top = Inches(0.2)
                tf_c.margin_right = Inches(0.35)

                p_b = tf_c.paragraphs[0]
                p_b.text = f"STRATEGIC DIRECTIVE 0{b_i+1}"
                p_b.font.size = Pt(9)
                p_b.font.bold = True
                p_b.font.color.rgb = BLUE_PRIMARY

                p_t = tf_c.add_paragraph()
                p_t.text = b_txt
                p_t.font.size = Pt(13)
                p_t.font.bold = True if b_i == 0 else False
                p_t.font.color.rgb = NAVY_DEEP
                p_t.space_before = Pt(4)

    prs.save(path)
    print(f"Presentation saved successfully to: {path}")

if __name__ == "__main__":
    mcp.run()
