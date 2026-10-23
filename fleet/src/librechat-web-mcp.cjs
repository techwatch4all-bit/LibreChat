#!/usr/bin/env node
/**
 * Satchida / LibreChat Native Web Search & Fetch MCP Server
 * Matches LibreChat's exact production web search and fetch stack:
 *  - Search: Keenable keyless search API (https://api.keenable.ai/v1/search/public)
 *  - Scrape / Fetch: Keenable keyless fetch API (https://api.keenable.ai/v1/fetch/public)
 *  - Attribution: "Satchida Study" (from librechat.yaml)
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const https = require('node:https');

const ATTRIBUTION_TITLE = process.env.KEENABLE_ATTRIBUTION_TITLE || 'Satchida Study';
const SEARCH_URL = process.env.KEENABLE_API_URL || 'https://api.keenable.ai/v1/search/public';
const FETCH_URL = process.env.KEENABLE_FETCH_URL || 'https://api.keenable.ai/v1/fetch/public';
const API_KEY = process.env.KEENABLE_API_KEY || '';

function executeKeenableSearch(query, maxResults = 8) {
  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({ query });
      const parsedUrl = new URL(SEARCH_URL);
      const headers = {
        'Content-Type': 'application/json',
        'X-Keenable-Title': ATTRIBUTION_TITLE,
        'Content-Length': Buffer.byteLength(payload),
      };
      if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
      }

      const req = https.request(parsedUrl, {
        method: 'POST',
        headers,
        timeout: 15000,
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const results = Array.isArray(data.results) ? data.results.slice(0, maxResults) : [];
            resolve({ success: true, results });
          } catch (e) {
            resolve({ success: false, error: `Invalid response format: ${e.message}` });
          }
        });
      });

      req.on('error', err => resolve({ success: false, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Search request timed out after 15s' });
      });

      req.write(payload);
      req.end();
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

function executeKeenableFetch(targetUrl) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(FETCH_URL);
      parsedUrl.searchParams.set('url', targetUrl);
      const headers = {
        'X-Keenable-Title': ATTRIBUTION_TITLE,
      };
      if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
      }

      const req = https.get(parsedUrl, {
        headers,
        timeout: 15000,
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({
              success: true,
              title: data.title || '',
              content: data.content || '',
              description: data.description || '',
              url: data.url || targetUrl,
            });
          } catch (e) {
            resolve({ success: false, error: `Invalid response format: ${e.message}` });
          }
        });
      });

      req.on('error', err => resolve({ success: false, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Fetch request timed out after 15s' });
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

const server = new Server(
  {
    name: 'librechat-web-search',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'web_search',
        description: 'Search the live web for real-time information, news, current events, documentation, or facts using LibreChat web search.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query string (e.g. "latest nodejs 24 release features", "top news today")',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'web_fetch',
        description: 'Read the full markdown/text content of a web page URL using LibreChat web scraper.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The HTTP or HTTPS URL of the web page to scrape and read',
            },
          },
          required: ['url'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'web_search') {
    const query = args?.query || '';
    if (!query) {
      return {
        content: [{ type: 'text', text: 'Error: Search query cannot be empty.' }],
      };
    }

    const res = await executeKeenableSearch(query);
    if (!res.success) {
      return {
        content: [{ type: 'text', text: `Search failed: ${res.error}` }],
      };
    }

    if (res.results.length === 0) {
      return {
        content: [{ type: 'text', text: `No search results found for: "${query}"` }],
      };
    }

    const formatted = res.results.map((r, i) => {
      const snippet = (r.snippet || r.description || '').slice(0, 450);
      return `${i + 1}. **${r.title || 'Untitled'}**\n   Link: ${r.url}\n   Snippet: ${snippet}`;
    }).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${res.results.length} search results for "${query}":\n\n${formatted}`,
        },
      ],
    };
  }

  if (name === 'web_fetch') {
    const targetUrl = args?.url || '';
    if (!targetUrl) {
      return {
        content: [{ type: 'text', text: 'Error: URL cannot be empty.' }],
      };
    }

    const res = await executeKeenableFetch(targetUrl);
    if (!res.success) {
      return {
        content: [{ type: 'text', text: `Failed to fetch URL: ${res.error}` }],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `# ${res.title || 'Web Page Content'}\nURL: ${res.url}\n\n${res.content}`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal MCP Server Error:', err);
  process.exit(1);
});
