#!/usr/bin/env node
/**
 * DeepTutor MCP Server
 *
 * Wraps DeepTutor's tutoring API (question generation, reading, books, mastery paths)
 * as MCP tools for LibreChat.
 *
 * Reads DEEPTUTOR_API_URL and DEEPTUTOR_API_TOKEN from the environment to authenticate
 * against the DeepTutor FastAPI backend.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const API_URL = process.env.DEEPTUTOR_API_URL || 'http://127.0.0.1:8000';
const API_TOKEN = process.env.DEEPTUTOR_API_TOKEN || '';

const server = new McpServer({
  name: 'deeptutor-mcp',
  version: '0.1.0',
});

async function callDeepTutor(
  path: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<CallToolResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_TOKEN) {
    headers['Authorization'] = `Bearer ${API_TOKEN}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      content: [{ type: 'text', text: `Error ${response.status}: ${errorText}` }],
      isError: true,
    };
  }

  const data = await response.json().catch(() => ({}));
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

// ─── Books: Study Mode ──────────────────────────────────────────────────────

server.registerTool(
  'create_book',
  {
    description: `Creates a study book from one or more sources (URLs, files, knowledge bases) in DeepTutor.
A "book" is a structured learning object that organizes content with a table of contents,
focused pages, and integrated quizzes. This is the entry point for deep Study and mastery-path workflows.

Returns the book_id needed for compile_page, deep_dive, page_chat, and quiz_attempt.`,
    inputSchema: {
      title: z.string({ description: 'Display title for the study book' }).optional(),
      description: z.string({ description: 'Optional description of the book purpose' }).optional(),
      sources: z.array(
        z.object({
          type: z.enum(['url', 'file', 'kb_name', 'book_id']).describe('Source type'),
          value: z.string().describe('URL, file path, knowledge base name, or existing book_id'),
        }),
      ).describe('One or more source references to compile into the book')
        .min(1, 'At least one source is required'),
      instructions: z.string({ description: 'Optional custom instructions for book generation' }).optional(),
      block_types: z.array(z.string()).optional().describe('Desired block types for the book structure'),
    },
  },
  async (args) => {
    return callDeepTutor('/api/books', 'POST', args);
  },
);

server.registerTool(
  'get_book',
  {
    description: `Fetches a book's structure: title, authors, spine (table of contents),
block/payload content, and metadata. Use this after create_book to inspect what was generated
or to retrieve a previously created book for further study.`,
    inputSchema: {
      book_id: z.string({ description: 'The book ID returned by create_book' }),
      include_blocks: z.boolean({ description: 'Include full block/payload content' }).optional().default(true),
    },
  },
  async ({ book_id, include_blocks }) => {
    const params = new URLSearchParams({ include_blocks: String(include_blocks) });
    return callDeepTutor(`/api/books/${encodeURIComponent(book_id)}?${params}`, 'GET');
  },
);

server.registerTool(
  'compile_page',
  {
    description: `Generates the content for a specific book page (a learning block).
Calls DeepTutor's page compiler, which renders the block's final content — prose,
figures, questions, and references — with inline citations to source material.

Useful after get_book to read a specific page's full content.`,
    inputSchema: {
      book_id: z.string({ description: 'The book ID' }),
      page_id: z.string({ description: 'The page/block identifier within the book' }),
    },
  },
  async ({ book_id, page_id }) => {
    return callDeepTutor('/api/books/compile-page', 'POST', { book_id, page_id });
  },
);

server.registerTool(
  'deep_dive',
  {
    description: `Performs a deep-dive investigation into a specific aspect of a book's content.
DeepTutor will research the query using the book's sources plus its web-search and
tool-use capabilities, returning a focused synthesis with citations.

Ideal for "Study" mode when a learner wants to go deeper on a particular concept.`,
    inputSchema: {
      book_id: z.string({ description: 'The book ID' }),
      page_id: z.string({ description: 'The page to deep-dive from' }).optional(),
      query: z.string({ description: 'The specific question or topic to investigate' }),
    },
  },
  async ({ book_id, page_id, query }) => {
    return callDeepTutor('/api/books/deep-dive', 'POST', { book_id, page_id, query });
  },
);

server.registerTool(
  'quiz_attempt',
  {
    description: `Submits a learner's answer to a quiz question embedded in a DeepTutor book
and returns grading feedback (correct/incorrect, explanation, mastery-path update).

DeepTutor's quiz engine uses adaptive questioning — the next question depends on
mastery of the current one. Pass the question_id from the book's quiz block and the
user's answer (free text or structured answers for multi-choice).`,
    inputSchema: {
      book_id: z.string({ description: 'The book ID' }),
      page_id: z.string({ description: 'The page containing the quiz' }),
      question_id: z.string({ description: 'The specific question identifier' }).optional(),
      user_answer: z.string({ description: 'The learners answer text' }).optional(),
      answers: z.array(
        z.object({
          questionId: z.string(),
          text: z.string(),
        }),
      ).optional().describe('Structured multi-choice answers'),
    },
  },
  async (args) => {
    return callDeepTutor('/api/books/quiz-attempt', 'POST', args);
  },
);

server.registerTool(
  'page_chat',
  {
    description: `Starts a focused chat session scoped to a specific book page's content.
DeepTutor will answer questions grounded in that page's text, figures, and citations.
The chat session persists across multiple turns.

Useful for Study mode: after reading a page, the learner can ask clarifying questions
without losing the source context.`,
    inputSchema: {
      book_id: z.string({ description: 'The book ID' }),
      page_id: z.string({ description: 'The page to anchor the chat to' }),
      message: z.string({ description: 'The user\'s message to the page-scoped chat' }),
      session_id: z.string({ description: 'Previous session ID to continue a thread' }).optional(),
    },
  },
  async ({ book_id, page_id, message, session_id }) => {
    return callDeepTutor('/api/books/page-chat-session', 'POST', {
      book_id, page_id, message, session_id,
    });
  },
);

// ─── Mastery Paths: Study Mode ──────────────────────────────────────────────

server.registerTool(
  'get_mastery_path',
  {
    description: `Retrieves the mastery progress for a book.
Returns the mastery graph (objectives, prerequisites, dependencies),
the learner's current progress on each objective, pending questions,
and the learning capture records that feed the path.

Use this in Study mode to see what a learner has mastered and what
remains to be covered.`,
    inputSchema: {
      book_id: z.string({ description: 'The book ID' }),
    },
  },
  async ({ book_id }) => {
    return callDeepTutor(`/api/progress/${encodeURIComponent(book_id)}`, 'GET');
  },
);

server.registerTool(
  'init_mastery_modules',
  {
    description: `Initializes the mastery path modules for a book.
DeepTutor analyzes the book's structure and generates a guided study path
with checkpoints, practice questions, and progress tracking.

Returns the module structure with IDs needed for subsequent mastery operations.`,
    inputSchema: {
      book_id: z.string({ description: 'The book ID' }),
    },
  },
  async ({ book_id }) => {
    return callDeepTutor(`/api/progress/${encodeURIComponent(book_id)}/init-modules`, 'POST', {});
  },
);

// ─── Question Generation: Study Mode ────────────────────────────────────────

server.registerTool(
  'generate_questions',
  {
    description: `Generates exam-style or practice questions from a source document or topic.
DeepTutor's question generation extracts key concepts and produces multiple question
types: multiple choice, short answer, problem solving, and worked examples.

The source can be a URL, uploaded file, or a knowledge base name. Specify the
question type and count. Returns a list of questions with answer keys and
explanations where applicable.

This is the core "Study" tool for active recall and self-testing.`,
    inputSchema: {
      source_type: z.enum(['url', 'file', 'kb_name', 'topic']).describe('Type of source to generate questions from'),
      source_value: z.string().describe('The URL, file path, KB name, or topic text'),
      question_types: z.array(
        z.enum(['multiple_choice', 'short_answer', 'problem_solving', 'worked_example', 'essay']),
      ).optional().describe('Which question types to generate (default: multiple_choice + short_answer)'),
      count: z.number().int().min(1).max(50).default(5).describe('Number of questions to generate'),
      knowledge_level: z.enum(['school', 'undergraduate', 'graduate', 'competitive']).optional()
        .describe('Academic level for question difficulty'),
      exam_board: z.string().optional().describe('Curriculum board (e.g. CBSE, ICSE, IB, JEE, NEET)'),
    },
  },
  async (args) => {
    return callDeepTutor('/api/question/generate', 'POST', args);
  },
);

server.registerTool(
  'generate_practice_quiz',
  {
    description: `Generates a practice quiz from a knowledge base or book, adapted to the
learner's current mastery level. DeepTutor selects questions that target the learner's
weakest objectives, with spaced repetition scheduling.

Returns a structured quiz with timed sections, answer format, and estimated duration.`,
    inputSchema: {
      source_type: z.enum(['kb_name', 'book_id']).describe('Source for the quiz'),
      source_value: z.string().describe('KB name or book_id'),
      count: z.number().int().min(1).max(30).default(10),
      time_limit_seconds: z.number().int().optional().describe('Total time limit for the quiz'),
    },
  },
  async ({ source_type, source_value, count, time_limit_seconds }) => {
    return callDeepTutor('/api/question-notebook/practice', 'POST', {
      source: source_type === 'kb_name' ? source_value : undefined,
      book_id: source_type === 'book_id' ? source_value : undefined,
      count,
      time_limit_seconds,
    });
  },
);

// ─── Notebook: Work Mode ────────────────────────────────────────────────────

server.registerTool(
  'create_notebook',
  {
    description: `Creates a new workspace notebook for capturing and synthesizing research,
notes, and analysis. Notebooks in DeepTutor are structured scratch spaces that support
Markdown, embedded figures, code blocks, and live references to source materials.

Use in Work mode for research synthesis, or in Study mode for note-taking while
reading a book.`,
    inputSchema: {
      title: z.string({ description: 'Notebook title' }),
      description: z.string({ description: 'Optional description' }).optional(),
      template: z.string({ description: 'Optional notebook template name' }).optional(),
    },
  },
  async ({ title, description, template }) => {
    return callDeepTutor('/api/notebooks', 'POST', { title, description, template });
  },
);

server.registerTool(
  'add_notebook_record',
  {
    description: `Appends a record (content block) to a notebook. Records can be text/Markdown,
code, images, or structured data. DeepTutor can generate a summary of the content
if auto_summary is enabled.

Useful for capturing key insights from a book, research findings, or problem-solving
work during a chat session.`,
    inputSchema: {
      notebook_id: z.string({ description: 'The notebook ID from create_notebook' }),
      content: z.string({ description: 'Record content (Markdown or text)' }),
      content_type: z.enum(['markdown', 'code', 'text', 'image_url']).optional().default('markdown'),
      language: z.string({ description: 'For code records: language identifier (e.g. python)' }).optional(),
      title: z.string({ description: 'Optional record title / heading' }).optional(),
      auto_summary: z.boolean().optional().default(true).describe('Generate an AI summary of the record'),
    },
  },
  async (args) => {
    return callDeepTutor(`/api/notebooks/${encodeURIComponent(args.notebook_id)}/actions/add-record`, 'POST', args);
  },
);

// ─── Knowledge Bases: Study/Work Mode ───────────────────────────────────────

server.registerTool(
  'list_knowledge_bases',
  {
    description: `Lists all available knowledge bases that DeepTutor can search.
Returns each KB's name, description, item count, and whether it's shared or private.

Use this before generate_questions or generate_practice_quiz to find the right
knowledge base as a source for question generation.`,
    inputSchema: {},
  },
  async () => {
    return callDeepTutor('/api/knowledge-bases', 'GET');
  },
);

server.registerTool(
  'search_knowledge_base',
  {
    description: `Performs a semantic search across a named knowledge base, returning
relevant passages with scores, source citations, and page numbers.

Use in Study mode to ground answers in textbook content, or in Work mode to
find technical documentation or prior research.`,
    inputSchema: {
      kb_name: z.string({ description: 'Knowledge base name' }),
      query: z.string({ description: 'Search query / question' }),
      top_k: z.number().int().min(1).max(20).default(5).describe('Number of results to return'),
      full_text: z.boolean().optional().default(false).describe('Include full text of results'),
    },
  },
  async ({ kb_name, query, top_k, full_text }) => {
    const body = { query, k: top_k, full_text };
    return callDeepTutor(`/api/knowledge-bases/${encodeURIComponent(kb_name)}/search`, 'POST', body);
  },
);

// ─── Agents: Work Mode ─────────────────────────────────────────────────────

server.registerTool(
  'consult_subagent',
  {
    description: `Delegates a focused question to a connected agent/subagent (e.g. a
local Codex, Claude Code, or a partner's specialized agent). The subagent runs
synchronously and returns its native response.

Use in Work mode to have a coding agent review a code snippet, a data-analysis
partner process a dataset, or a domain-specific agent tackle a sub-problem.
The calling agent should ask a specific, self-contained question.`,
    inputSchema: {
      agent_id: z.string({ description: 'The agent identifier (e.g. "codex", "claude-code")' }),
      question: z.string({ description: 'The specific question or task for the subagent' }),
    },
  },
  async ({ agent_id, question }) => {
    return callDeepTutor('/api/subagents/consult', 'POST', { agent_id, question });
  },
);

// ─── Co-writer: Work Mode ───────────────────────────────────────────────────

server.registerTool(
  'create_document',
  {
    description: `Creates a new co-writer document with the given title and initial content.
Returns the document ID for further edits via edit_document / edit_document_react.

Use in Work mode for collaborative document writing, report generation, or
synthesizing findings from a study session into a report.`,
    inputSchema: {
      title: z.string({ description: 'Document title' }),
      content: z.string({ description: 'Initial Markdown content' }).optional(),
    },
  },
  async ({ title, content }) => {
    return callDeepTutor('/api/documents', 'POST', { title, content });
  },
);

server.registerTool(
  'edit_document',
  {
    description: `Edits an existing co-writer document with a natural-language instruction.
DeepTutor's agentic editing will make the requested change while preserving the
document's structure and style. Returns the updated document content and a diff summary.

Use in Work mode to iteratively refine a report, add sections, or adjust tone.`,
    inputSchema: {
      doc_id: z.string({ description: 'The document ID from create_document' }),
      instruction: z.string({ description: 'Natural-language edit instruction (e.g. "Add a conclusion section")' }),
      selection: z.object({
        start: z.number().int().min(0).describe('Start character offset').optional(),
        end: z.number().int().min(0).describe('End character offset').optional(),
      }).optional().describe('Optional text range to scope the edit to'),
    },
  },
  async (args) => {
    return callDeepTutor('/api/documents/actions/edit', 'POST', args);
  },
);

// ─── Dashboard: All Modes ───────────────────────────────────────────────────

server.registerTool(
  'get_learning_library',
  {
    description: `Retrieves the learner's learning library: books, courses, notebooks,
and resources organized by category. Shows progress, status, and last activity.

Use to orient the current session — "what have I been studying?" or "what
courses do I have assigned?"`,
    inputSchema: {},
  },
  async () => {
    return callDeepTutor('/api/dashboard/learning-library', 'GET');
  },
);

server.registerTool(
  'get_recent_activity',
  {
    description: `Fetches the learner's recent activity (conversations, book progress,
quiz attempts, notebook edits) across all surfaces. Useful for context-aware
prompts that reference prior work.`,
    inputSchema: {
      limit: z.number().int().min(5).max(100).default(20),
    },
  },
  async ({ limit }) => {
    const params = new URLSearchParams({ limit: String(limit) });
    return callDeepTutor(`/api/dashboard/recent?${params}`, 'GET');
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[deeptutor-mcp] Server connected and ready');
}

main().catch((error) => {
  console.error('[deeptutor-mcp] Failed to start:', error);
  process.exit(1);
});
