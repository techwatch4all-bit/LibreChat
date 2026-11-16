"""
Satchida LMS & Knowledge Base Publisher MCP Server
Connects LibreChat and DeepTutor directly to the Satchida LMS engine (C:\\LAN-AI-Infra\\LMS).
Auto-publishes verified educational learning modules, conceptual slide summaries,
and knowledge checks directly into the LMS curriculum repository (generated-content.json).
Runs 100% locally with zero external network or cloud dependencies.
"""
import sys
import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-lms-publisher")

LMS_ROOT = os.environ.get("SATCHIDA_LMS_ROOT", r"C:\LAN-AI-Infra\LMS")
CONTENT_FILE = os.path.join(LMS_ROOT, "generated-content.json")

def _load_lms_content() -> List[Dict[str, Any]]:
    if not os.path.exists(CONTENT_FILE):
        return []
    try:
        with open(CONTENT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def _save_lms_content(content_list: List[Dict[str, Any]]) -> bool:
    os.makedirs(os.path.dirname(CONTENT_FILE), exist_ok=True)
    try:
        with open(CONTENT_FILE, "w", encoding="utf-8") as f:
            json.dump(content_list, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        sys.stderr.write(f"Failed to save LMS content: {e}\n")
        return False

@mcp.tool()
def lms_list_curriculum_modules(limit: int = 15) -> str:
    """
    Lists the current active curriculum topics and learning modules in the LMS database.
    """
    modules = _load_lms_content()
    summary = []
    for m in modules[:limit]:
        summary.append({
            "id": m.get("id"),
            "topic": m.get("topic"),
            "title": m.get("title"),
            "track": m.get("track", "General STEM"),
            "difficulty": m.get("difficulty", "intermediate"),
            "slides_count": len(m.get("slides", [])),
            "questions_count": len(m.get("questions", [])),
            "updatedAt": m.get("updatedAt")
        })
    return json.dumps({
        "status": "success",
        "total_modules": len(modules),
        "modules": summary
    }, indent=2)

@mcp.tool()
def lms_publish_learning_module(
    topic: str,
    title: str,
    summary: str,
    track: str = "Engineering & Science",
    difficulty: str = "intermediate",
    key_points: Optional[List[str]] = None,
    slides: Optional[List[Dict[str, Any]]] = None,
    questions: Optional[List[Dict[str, Any]]] = None,
    sources: Optional[List[str]] = None
) -> str:
    """
    Publishes a verified educational lesson into the LMS curriculum database.
    
    :param topic: Core subject topic (e.g. 'Signal Modulation: FM vs PM', 'Photosynthesis', 'Digital Electronics')
    :param title: Descriptive module title
    :param summary: High-level overview and real-world analogy
    :param track: Category track (e.g. 'Engineering & Science', 'AI & Computing', 'Cybersecurity', 'Life Sciences')
    :param difficulty: 'beginner', 'intermediate', or 'advanced'
    :param key_points: 3-5 crucial learning takeaways
    :param slides: List of slide dicts with fields: {'title': str, 'type': 'concept'|'comparison'|'application', 'content': [str], 'speakerNotes': str}
    :param questions: List of practice quiz dicts with fields: {'question': str, 'options': [str], 'correctIndex': int, 'explanation': str}
    :param sources: List of authoritative references, textbooks, or papers
    """
    now_iso = datetime.now().isoformat()
    module_id = f"mod-{uuid.uuid4().hex[:8]}"

    # Fallback structure if LLM sends simple lists
    formatted_slides = []
    if slides:
        for idx, s in enumerate(slides, 1):
            formatted_slides.append({
                "id": f"slide-{idx}",
                "title": s.get("title", f"Concept {idx}"),
                "type": s.get("type", "concept"),
                "content": s.get("content", []) if isinstance(s.get("content"), list) else [str(s.get("content"))],
                "speakerNotes": s.get("speakerNotes", ""),
                "index": idx,
                "keyPoints": s.get("keyPoints", [])
            })
    else:
        # Auto-create slide from summary and key points
        formatted_slides.append({
            "id": "slide-1",
            "title": f"Core Foundations of {topic}",
            "type": "concept",
            "content": [summary] + (key_points or []),
            "speakerNotes": f"Introduction to {topic}",
            "index": 1,
            "keyPoints": key_points or []
        })

    formatted_questions = []
    if questions:
        for q_idx, q in enumerate(questions, 1):
            formatted_questions.append({
                "id": f"q-{q_idx}",
                "question": q.get("question", ""),
                "options": q.get("options", []),
                "correctIndex": int(q.get("correctIndex", 0)),
                "explanation": q.get("explanation", "")
            })

    new_module = {
        "id": module_id,
        "topic": topic,
        "title": title,
        "track": track,
        "duration": "15-20 min",
        "difficulty": difficulty,
        "summary": summary,
        "keyPoints": key_points or [],
        "slides": formatted_slides,
        "questions": formatted_questions,
        "sources": sources or ["Satchida Sovereign Academic Knowledge Base"],
        "createdAt": now_iso,
        "updatedAt": now_iso,
        "status": "published"
    }

    modules = _load_lms_content()
    # Check if existing module for topic exists; update or append
    existing_idx = None
    for idx, m in enumerate(modules):
        if m.get("topic", "").strip().lower() == topic.strip().lower():
            existing_idx = idx
            break

    if existing_idx is not None:
        new_module["id"] = modules[existing_idx].get("id", module_id)
        new_module["createdAt"] = modules[existing_idx].get("createdAt", now_iso)
        modules[existing_idx] = new_module
        action = "Updated existing"
    else:
        modules.append(new_module)
        action = "Published new"

    if _save_lms_content(modules):
        return json.dumps({
            "status": "success",
            "action": action,
            "module_id": new_module["id"],
            "title": title,
            "track": track,
            "slides_count": len(formatted_slides),
            "questions_count": len(formatted_questions),
            "lms_path": CONTENT_FILE
        }, indent=2)
    else:
        return json.dumps({"status": "error", "message": "Failed to write to LMS repository"})

if __name__ == "__main__":
    mcp.run()
