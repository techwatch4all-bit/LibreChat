import type { ToolDefinition } from '../tools/classification';
import {
  buildBareToBoundToolNames,
  healToolNameReferences,
  healAgentToolNameReferences,
} from './toolNameHealing';

const mcpDef = (name: string, serverName?: string): ToolDefinition => ({
  name,
  ...(serverName != null ? { serverName } : {}),
});

describe('buildBareToBoundToolNames', () => {
  it('maps a unique bare name to its bound catalog name', () => {
    const defs = [
      mcpDef('web_search'), // provider built-in, not MCP (no delimiter)
      mcpDef('create_formatted_document_mcp_satchida-knowledge-vault', 'satchida-knowledge-vault'),
      mcpDef('fetch_web_content_mcp_satchida-knowledge-vault', 'satchida-knowledge-vault'),
    ];
    const map = buildBareToBoundToolNames(defs);
    expect(map.get('create_formatted_document')).toBe(
      'create_formatted_document_mcp_satchida-knowledge-vault',
    );
    expect(map.get('fetch_web_content')).toBe('fetch_web_content_mcp_satchida-knowledge-vault');
    expect(map.has('web_search')).toBe(false);
  });

  it('rejects bare names shared by two servers (ambiguous)', () => {
    const defs = [
      mcpDef('search_mcp_server_a', 'server_a'),
      mcpDef('search_mcp_server_b', 'server_b'),
    ];
    expect(buildBareToBoundToolNames(defs).size).toBe(0);
  });

  it('rejects bare names that collide with a built-in definition name', () => {
    const defs = [mcpDef('code_interpreter_mcp_vault', 'vault'), mcpDef('code_interpreter')];
    expect(buildBareToBoundToolNames(defs).size).toBe(0);
  });

  it('returns an empty map for empty or undefined input', () => {
    expect(buildBareToBoundToolNames(undefined).size).toBe(0);
    expect(buildBareToBoundToolNames([]).size).toBe(0);
  });
});

describe('healToolNameReferences', () => {
  const map = buildBareToBoundToolNames([
    mcpDef('create_formatted_document_mcp_satchida-knowledge-vault', 'satchida-knowledge-vault'),
    mcpDef('fetch_web_content_mcp_satchida-knowledge-vault', 'satchida-knowledge-vault'),
  ]);

  it('rewrites bare mentions in prose, including backticks and headings', () => {
    const prompt =
      'EXECUTIVE DOCUMENT & PRESENTATION CREATION (`create_formatted_document`):\n- Call create_formatted_document with the draft.';
    const healed = healToolNameReferences(prompt, map);
    expect(healed).not.toContain('`create_formatted_document`');
    expect(healed).toContain('create_formatted_document_mcp_satchida-knowledge-vault');
  });

  it('does not corrupt mentions that already carry the _mcp_ suffix', () => {
    const prompt =
      'Prefer fetch_web_content_mcp_satchida-knowledge-vault over bare fetch_web_content.';
    const healed = healToolNameReferences(prompt, map);
    expect(healed).toContain(
      'fetch_web_content_mcp_satchida-knowledge-vault over bare fetch_web_content_mcp_satchida-knowledge-vault',
    );
  });

  it('leaves unknown tool names and unrelated text untouched', () => {
    const prompt =
      'The web_search tool works differently; deliverable_review is not an MCP tool here.';
    expect(healToolNameReferences(prompt, map)).toBe(prompt);
  });
});

describe('healAgentToolNameReferences', () => {
  const defs = [
    mcpDef('create_formatted_document_mcp_satchida-knowledge-vault', 'satchida-knowledge-vault'),
  ];

  it('heals instructions and tool context maps together', () => {
    const out = healAgentToolNameReferences(
      'Use create_formatted_document for decks.',
      { vault: 'Call create_formatted_document once per document.' },
      undefined,
      defs,
    );
    expect(out.instructions).toContain('create_formatted_document_mcp_satchida-knowledge-vault');
    expect(out.toolContextMap?.vault).toContain(
      'create_formatted_document_mcp_satchida-knowledge-vault',
    );
  });

  it('returns nothing when no bare names are healable', () => {
    const out = healAgentToolNameReferences('Use web_search.', undefined, undefined, defs);
    expect(out.instructions).toBeUndefined();
    expect(out.toolContextMap).toBeUndefined();
  });
});
