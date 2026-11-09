/**
 * Curated external MCP server catalog — shippable copy for client deployments.
 *
 * Provenance: copied from
 *   D:\LAN-AI-Infra\satchida-ai-unified-suite\src\lib\constants\recommended-mcp-servers.constants.ts
 * on 2026-11-09. Delta vs origin: the origin imports `RecommendedMCPServer` from
 * `$lib/types` (SvelteKit alias); the interface is inlined below so this file is
 * standalone. Content of the catalog entries is otherwise verbatim.
 *
 * Purpose: reference list of verified opt-in MCP servers shown as cards in the
 * unified-suite "Add New Server" dialog. Server cards needing an API key are
 * marked `needsAuthorization: true`. Zero-auth entries are preferred for
 * sovereign client nodes. Keep in sync with the origin file.
 */

export interface RecommendedMCPServer {
	id: string;
	name: string;
	description: string;
	url: string;
	iconUrl?: string;
	iconUrlDark?: string;
	iconUrlLight?: string;
	needsAuthorization?: boolean;
}

// Suggested verified MCP servers shown as opt-in cards in the "Add New Server" dialog.
export const RECOMMENDED_MCP_SERVERS: RecommendedMCPServer[] = [
	{
		description: 'Search and browse AI models, datasets, spaces, and docs on the Hugging Face Hub (Zero Auth).',
		iconUrl: '/recommended-mcp/huggingface.ico',
		id: 'huggingface',
		name: 'Hugging Face Hub',
		url: 'https://huggingface.co/mcp'
	},
	{
		description: 'Browse up-to-date documentation and code examples for popular libraries and frameworks (Zero Auth).',
		iconUrl: '/recommended-mcp/context7.png',
		id: 'context7',
		name: 'Context7 Docs',
		url: 'https://mcp.context7.com/mcp'
	},
	{
		description: 'AI-optimised deep research search — returns clean, pre-processed results for LLM consumption (Requires Tavily API Key).',
		iconUrl: 'https://www.google.com/s2/favicons?domain=tavily.com&sz=64',
		id: 'tavily',
		name: 'Tavily Deep Research',
		needsAuthorization: true,
		url: 'https://mcp.tavily.com/mcp'
	},
	{
		description: 'Search the web and fetch full page content as clean markdown (Zero Auth or Optional Exa API Key).',
		iconUrl: '/recommended-mcp/exa.ico',
		id: 'exa',
		name: 'Exa (Web Search & Fetch)',
		needsAuthorization: false,
		url: 'https://mcp.exa.ai/mcp'
	},
	{
		description: 'Privacy-first web search via Brave Search engine — no tracking, no filter bubbles (Requires Brave API Key).',
		iconUrl: 'https://www.google.com/s2/favicons?domain=brave.com&sz=64',
		id: 'brave-search',
		name: 'Brave Search (Privacy-First)',
		needsAuthorization: true,
		url: 'https://api.search.brave.com/mcp'
	},
	{
		description: 'Search repositories, issues, pull requests and interact with code on GitHub (Requires GitHub Token).',
		iconUrlDark: '/recommended-mcp/github-dark.png',
		iconUrlLight: '/recommended-mcp/github-light.png',
		id: 'github',
		name: 'GitHub Copilot',
		needsAuthorization: true,
		url: 'https://api.githubcopilot.com/mcp'
	},
	{
		description: 'Get live financial market data — stocks, crypto, forex, commodities in real time (Requires API Key).',
		id: 'financialdatasets',
		name: 'Financial Datasets (Markets)',
		needsAuthorization: true,
		url: 'https://mcp.financialdatasets.ai/mcp'
	},

	// ── Satchida Intelligence Tier ──
	{
		description:
			'Google Gemini AI — generative text, image analysis, and Google Search grounding. Free tier: 1,500 req/day (gemini-1.5-flash). Requires GEMINI_API_KEY as Bearer token.',
		iconUrl: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64',
		id: 'google-gemini',
		name: 'Google Gemini (AI)',
		needsAuthorization: true,
		url: 'https://generativelanguage.googleapis.com/v1beta/mcp'
	},
	{
		description:
			'Official Notion hosted MCP — read, search, create and update pages & databases in your workspace. Requires OAuth. Free for personal workspaces.',
		iconUrl: 'https://www.google.com/s2/favicons?domain=notion.so&sz=64',
		id: 'notion',
		name: 'Notion Workspace',
		needsAuthorization: true,
		url: 'https://mcp.notion.com/mcp'
	},
	{
		description:
			'Google NotebookLM — create notebooks, upload sources (URLs, PDFs, YouTube), run grounded Q&A and generate audio overviews. Community bridge, requires Google session auth.',
		iconUrl: 'https://www.google.com/s2/favicons?domain=notebooklm.google.com&sz=64',
		id: 'notebooklm',
		name: 'NotebookLM (Google)',
		needsAuthorization: true,
		url: 'https://notebooklm.google.com/mcp'
	},
	{
		description:
			'Perplexity AI deep research — real-time web search with sonar-reasoning-pro. Free tier: 5 req/hour. Requires PERPLEXITY_API_KEY. Best for live synthesis of open-source intelligence.',
		iconUrl: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64',
		id: 'perplexity',
		name: 'Perplexity Deep Research',
		needsAuthorization: true,
		url: 'https://mcp-server.perplexity.ai/'
	},
	{
		description:
			'Wigolo local-first web intelligence (KnockOutEZ, AGPL-3.0 — external sidecar, never bundled: install via npx yourself) — zero-cloud, $0/query search across public engines, headless fetch & crawl over MCP (Zero Auth). Only listed when its :3333 daemon is actually reachable.',
		iconUrl: 'https://raw.githubusercontent.com/KnockOutEZ/wigolo/main/assets/brand/wigolo-banner.png',
		id: 'wigolo',
		name: 'Wigolo (Local-First Web & Crawl)',
		needsAuthorization: false,
		url: 'http://127.0.0.1:3333/mcp'
	},
	{
		description:
			'Agent-Reach Omni-Channel Intelligence — 15 social, video, code, and web channels (X/Twitter, YouTube, Bilibili, Reddit, Jina Reader, GitHub, Podcasts) using native zero-API-key local CLI tools.',
		iconUrl: 'https://raw.githubusercontent.com/Panniantong/Agent-Reach/main/assets/logo.png',
		id: 'agent-reach',
		name: 'Agent-Reach (15-Channel Omni-Intelligence)',
		needsAuthorization: false,
		// Agent-Reach is a local stdio CLI, not an HTTP daemon — use a distinct
		// sentinel scheme so it never collides with wigolo's :3333 endpoint in
		// "already configured" dedupe checks.
		url: 'stdio://agent-reach'
	}
];
