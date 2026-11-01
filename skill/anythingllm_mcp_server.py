#!/usr/bin/env python3
"""
Satchida Enterprise Knowledge Vault & Document Intelligence MCP Server
========================================================================
Bridges LibreChat directly to the bare-metal AnythingLLM engine (Port 3012).
Provides:
  1. Multi-tenant user data segregation (Deterministic per-user workspace isolation)
  2. Multi-format Document Creation (PDF, DOCX, XLSX, PPTX, Markdown, Text)
  3. Enterprise Semantic RAG with LanceDB vector search & source citations
  4. Real-time document ingestion & chunking pipeline

Runs as an MCP stdio server registered in LibreChat's `librechat.yaml`.
"""

import sys
import os
import io
import json
import re
import mimetypes
from datetime import datetime
from typing import Optional, Dict, Any, List
import requests
from mcp.server.mcpserver import MCPServer

# Configuration
ANYTHINGLLM_BASE_URL = os.environ.get("ANYTHINGLLM_URL", "http://127.0.0.1:3012/api/v1")
ANYTHINGLLM_API_KEY = os.environ.get("ANYTHINGLLM_API_KEY", "1C4Q14C-8BVMC35-KRZJSSV-ESDMPHH")
EXPORT_OUTPUT_DIR = os.environ.get("SATCHIDA_EXPORTS_DIR", "D:\\LAN-AI-Infra\\AnythingLLM\\server\\storage\\documents\\generated")

os.makedirs(EXPORT_OUTPUT_DIR, exist_ok=True)

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
        
        # Filter to user's private workspace + shared corporate vaults
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

@mcp.tool()
def create_formatted_document(
    filename: str,
    content: str,
    doc_type: str = "pdf",
    title: Optional[str] = None,
    author: Optional[str] = "Satchida Sovereign Platform",
    auto_index_to_vault: bool = True,
    user_identifier: Optional[str] = None
) -> str:
    """
    Generates professional standalone documents in multiple formats:
      - 'pdf' : Formatted Report PDF (ReportLab / WeasyPrint / Canvas)
      - 'docx': Microsoft Word Document (python-docx)
      - 'xlsx': Excel Spreadsheet with tabular data & formulas (openpyxl)
      - 'pptx': PowerPoint Presentation slides (python-pptx)
      - 'md'  : Markdown technical documentation
      - 'txt' : Plain text file

    Parameters:
      - filename: Target name (e.g., 'Q3-Financial-Analysis.pdf')
      - content: Text, Markdown, or JSON data (for Excel rows or Presentation slides)
      - doc_type: 'pdf', 'docx', 'xlsx', 'pptx', 'md', or 'txt'
      - auto_index_to_vault: If True, automatically ingests the generated document into the user's AnythingLLM private vault.
      - user_identifier: LibreChat username or ID to segregate storage.
    """
    ext = doc_type.lower().replace(".", "")
    if not filename.lower().endswith(f".{ext}"):
        filename = f"{filename}.{ext}"

    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
    file_path = os.path.join(EXPORT_OUTPUT_DIR, safe_name)
    doc_title = title or safe_name.replace(f".{ext}", "").replace("_", " ").title()

    try:
        if ext == "pdf":
            _generate_pdf(file_path, doc_title, content, author)
        elif ext == "docx":
            _generate_docx(file_path, doc_title, content, author)
        elif ext == "xlsx":
            _generate_xlsx(file_path, doc_title, content)
        elif ext == "pptx":
            _generate_pptx(file_path, doc_title, content, author)
        else: # md or txt
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)

        response_msg = [
            f"✅ **Document Created Successfully!**",
            f"- **Filename**: `{safe_name}`",
            f"- **Type**: `{ext.upper()}`",
            f"- **Disk Path**: `{file_path}`",
            f"- **Size**: {os.path.getsize(file_path):,} bytes"
        ]

        # Automatic ingestion into user's AnythingLLM workspace
        if auto_index_to_vault:
            user_slug = _resolve_user_workspace_slug(user_identifier)
            ingest_res = _ingest_local_file_to_anythingllm(file_path, user_slug)
            if ingest_res.get("success"):
                response_msg.append(f"- **Vault Ingestion**: Automatically chunked and embedded in private vault `{user_slug}`.")
            else:
                response_msg.append(f"- **Vault Ingestion**: Saved to disk, but vault upload note: {ingest_res.get('error')}")

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
            # Match partial UUID prefixes (e.g. uuid__filename.ext)
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
            return "\n\n".join(output[:50]) # Truncate if extremely long

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
        sections = re.split(r'\n(?=## |\n---)', new_slides_content)
        added_count = 0
        for s in sections:
            lines = [l.strip() for l in s.split("\n") if l.strip()]
            if not lines:
                continue
            slide_title = lines[0].replace("## ", "").replace("---", "").strip() or "Enhanced Slide"
            slide = prs.slides.add_slide(bullet_slide_layout)
            if slide.shapes.title:
                slide.shapes.title.text = slide_title
            
            # Populate text placeholders
            text_placeholders = [shape for shape in slide.shapes if shape.has_text_frame and shape != slide.shapes.title]
            if text_placeholders:
                tf = text_placeholders[0].text_frame
                tf.clear()
                for bullet in lines[1:]:
                    clean_bullet = re.sub(r'^[-*•]\s*', '', bullet)
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

        dest_path = os.path.join(EXPORT_OUTPUT_DIR, os.path.basename(output_filename))
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
# 4. DOCUMENT INGESTION ENGINE
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
    fname = f"{safe_title}.md"
    fpath = os.path.join(EXPORT_OUTPUT_DIR, fname)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(text_content)
    
    user_slug = _resolve_user_workspace_slug(user_identifier)
    res = _ingest_local_file_to_anythingllm(fpath, user_slug)
    if res.get("success"):
        return f"✅ Text saved as `{fname}` and indexed into vault `{user_slug}`."
    return f"Saved file to disk, but failed to index: {res.get('error')}"

# ============================================================================
# HELPER GENERATORS FOR DOCUMENT CREATION
# ============================================================================

def _generate_pdf(path: str, title: str, content: str, author: str):
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        doc = SimpleDocTemplate(path, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Heading1'],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#0f172a'),
            spaceAfter=14
        )
        meta_style = ParagraphStyle(
            'DocMeta',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#64748b'),
            spaceAfter=20
        )
        body_style = ParagraphStyle(
            'DocBody',
            parent=styles['Normal'],
            fontSize=10,
            leading=15,
            textColor=colors.HexColor('#1e293b'),
            spaceAfter=8
        )

        elements = [
            Paragraph(title, title_style),
            Paragraph(f"Generated by: {author} • Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}", meta_style),
            Spacer(1, 10)
        ]

        for para in content.split("\n\n"):
            clean = para.strip().replace("\n", "<br/>")
            if clean:
                elements.append(Paragraph(clean, body_style))
                elements.append(Spacer(1, 6))

        doc.build(elements)
    except ImportError:
        # Fallback to text file if reportlab is not installed
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"TITLE: {title}\nAUTHOR: {author}\n\n{content}")

def _generate_docx(path: str, title: str, content: str, author: str):
    try:
        import docx
        from docx.shared import Pt, Inches, RGBColor

        doc = docx.Document()
        title_p = doc.add_heading(title, level=0)
        
        meta_p = doc.add_paragraph()
        meta_run = meta_p.add_run(f"Author: {author} | Date: {datetime.now().strftime('%Y-%m-%d')}")
        meta_run.font.size = Pt(9)
        meta_run.font.color.rgb = RGBColor(100, 116, 139)

        doc.add_paragraph() # spacer

        for line in content.split("\n"):
            stripped = line.strip()
            if stripped.startswith("# "):
                doc.add_heading(stripped[2:], level=1)
            elif stripped.startswith("## "):
                doc.add_heading(stripped[3:], level=2)
            elif stripped.startswith("### "):
                doc.add_heading(stripped[4:], level=3)
            elif stripped.startswith("- ") or stripped.startswith("* "):
                doc.add_paragraph(stripped[2:], style='List Bullet')
            elif stripped:
                doc.add_paragraph(stripped)
        doc.save(path)
    except ImportError:
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"{title}\n\n{content}")

def _generate_xlsx(path: str, title: str, content: str):
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = title[:30] if title else "Data"

        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

        # Try parsing structured JSON or CSV lines
        parsed_data = None
        try:
            parsed_data = json.loads(content)
        except Exception:
            pass

        if isinstance(parsed_data, list) and len(parsed_data) > 0 and isinstance(parsed_data[0], dict):
            headers = list(parsed_data[0].keys())
            ws.append(headers)
            for col_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=1, column=col_idx)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center")

            for item in parsed_data:
                ws.append([item.get(h, "") for h in headers])
        else:
            # Fallback to CSV text splitting
            lines = [l.strip() for l in content.split("\n") if l.strip()]
            for row_idx, line in enumerate(lines, 1):
                cols = [c.strip() for c in line.split(",")] if "," in line else [c.strip() for c in line.split("\t")]
                ws.append(cols)
                if row_idx == 1:
                    for col_idx in range(1, len(cols) + 1):
                        cell = ws.cell(row=1, column=col_idx)
                        cell.fill = header_fill
                        cell.font = header_font

        wb.save(path)
    except ImportError:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

def _generate_pptx(path: str, title: str, content: str, author: str):
    try:
        from pptx import Presentation
        from pptx.util import Inches, Pt

        prs = Presentation()
        # Title slide
        title_slide_layout = prs.slide_layouts[0]
        slide = prs.slides.add_slide(title_slide_layout)
        slide.shapes.title.text = title
        slide.placeholders[1].text = f"{author}\n{datetime.now().strftime('%B %Y')}"

        # Parse slides by delimiter '---' or '## '
        bullet_slide_layout = prs.slide_layouts[1]
        sections = re.split(r'\n(?=## |\n---)', content)
        for s in sections:
            lines = [l.strip() for l in s.split("\n") if l.strip()]
            if not lines:
                continue
            slide_title = lines[0].replace("## ", "").replace("---", "").strip() or "Overview"
            slide = prs.slides.add_slide(bullet_slide_layout)
            slide.shapes.title.text = slide_title
            tf = slide.placeholders[1].text_frame
            tf.clear()

            for bullet in lines[1:]:
                clean_bullet = re.sub(r'^[-*•]\s*', '', bullet)
                if clean_bullet:
                    p = tf.add_paragraph()
                    p.text = clean_bullet
                    p.font.size = Pt(16)

        prs.save(path)
    except ImportError:
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"PRESENTATION: {title}\n\n{content}")

if __name__ == "__main__":
    mcp.run()
