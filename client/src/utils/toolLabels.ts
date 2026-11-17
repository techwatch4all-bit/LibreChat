import { Constants, splitToolCallName } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';

/**
 * Shared tool-name parsing + friendly-label mapping used by the main
 * tool-call UI and the subagent ticker. Centralized so the MCP
 * delimiter (`<tool>_mcp_<server>`) and native-tool short names read
 * consistently in every surface that renders tool lifecycle.
 */

/** Native tool id → translation key for a user-readable short name. */
export const TOOL_FRIENDLY_NAME_KEYS: Record<string, TranslationKeys> = {
  execute_code: 'com_ui_tool_name_code',
  run_tools_with_code: 'com_ui_tool_name_code',
  run_tools_with_bash: 'com_ui_tool_name_code',
  bash_tool: 'com_ui_tool_name_code',
  [Constants.CHECK_BACKGROUND_TASK]: 'com_ui_background_tasks',
  web_search: 'com_ui_tool_name_web_search',
  image_gen_oai: 'com_ui_tool_name_image_gen',
  image_edit_oai: 'com_ui_tool_name_image_edit',
  gemini_image_gen: 'com_ui_tool_name_image_gen',
  file_search: 'com_ui_tool_name_file_search',
  code_interpreter: 'com_ui_tool_name_code_analysis',
  retrieval: 'com_ui_tool_name_file_search',
  ask_user_question: 'com_ui_tool_name_ask_user_question',
  create_file: 'com_ui_tool_name_create_file',
  set_memory: 'com_ui_tool_name_set_memory',
  edit_file: 'com_ui_tool_name_edit_file',
  delete_memory: 'com_ui_tool_name_delete_memory',
  skill: 'com_ui_skill',
  read_file: 'com_ui_tool_name_read_file',
};

/**
 * Satchida studio servers are internal infrastructure: end users must never
 * see their names, tool ids, providers, or gateways in chat. Tools on these
 * servers render with friendly activity labels only.
 */
const STUDIO_SERVER_PREFIX = 'satchida-';

const STUDIO_TOOL_LABEL_KEYS: Record<string, TranslationKeys> = {
  video_generate: 'com_ui_tool_name_studio_render',
  image_generate: 'com_ui_tool_name_studio_image',
  video_create_script: 'com_ui_tool_name_studio_pipeline',
  video_plan_3d_scenes: 'com_ui_tool_name_studio_pipeline',
  video_start_render_job: 'com_ui_tool_name_studio_render',
  video_get_status: 'com_ui_tool_name_studio_pipeline',
  video_export_youtube_bundle: 'com_ui_tool_name_studio_pipeline',
  render_motion_to_video: 'com_ui_tool_name_studio_animation',
};

export function isInternalMCPServer(serverName: string): boolean {
  return serverName.startsWith(STUDIO_SERVER_PREFIX);
}

export function getStudioToolLabelKey(toolName: string): TranslationKeys {
  return STUDIO_TOOL_LABEL_KEYS[toolName] ?? 'com_ui_tool_name_studio_action';
}

export interface ParsedToolName {
  /** Original tool id (unchanged). */
  raw: string;
  /** MCP server name when the tool follows `<tool>_mcp_<server>`, else `''`. */
  mcpServer: string;
  /** Tool-specific name — the `<tool>` half of an MCP id, or the raw
   *  name for native tools. Useful as the "action" label shown in a
   *  code-style badge next to the server name. */
  toolName: string;
  /** Translation key for a user-friendly display name, when the raw
   *  name matches a built-in native tool (web_search, execute_code, ...).
   *  Absent for MCP tools and unknown names. */
  friendlyKey?: TranslationKeys;
}

/**
 * Split an incoming tool id into its constituent parts:
 *
 *   - `search_code_mcp_github` → `{ mcpServer: 'github', toolName: 'search_code' }`
 *   - `web_search`             → `{ mcpServer: '', toolName: 'web_search', friendlyKey: 'com_ui_tool_name_web_search' }`
 *   - `some_custom_tool`       → `{ mcpServer: '', toolName: 'some_custom_tool' }`
 */
export function parseToolName(
  rawName: string,
  knownServerNames?: readonly string[],
): ParsedToolName {
  if (rawName.includes(Constants.mcp_delimiter)) {
    const [toolName, mcpServer = ''] = splitToolCallName(rawName, knownServerNames);
    return { raw: rawName, mcpServer, toolName };
  }
  const friendlyKey = TOOL_FRIENDLY_NAME_KEYS[rawName];
  return {
    raw: rawName,
    mcpServer: '',
    toolName: rawName,
    ...(friendlyKey ? { friendlyKey } : {}),
  };
}

/**
 * Resolve a tool id to a single user-facing short label. Pure string —
 * use `parseToolName` directly when you need structured parts (e.g. to
 * render a code-style badge for the tool name next to the server).
 *
 *   - MCP tool  → server name (keeps the header summary short)
 *   - Native   → localized friendly name from {@link TOOL_FRIENDLY_NAME_KEYS}
 *   - Unknown  → raw name
 *
 * Tools on internal studio servers never expose the server: they resolve to
 * a friendly activity label ("Rendered video", "Generated image", ...).
 */
export function getToolDisplayLabel(
  rawName: string,
  localize: (key: TranslationKeys) => string,
  knownServerNames?: readonly string[],
): string {
  const parsed = parseToolName(rawName, knownServerNames);
  if (parsed.mcpServer) {
    if (isInternalMCPServer(parsed.mcpServer)) {
      return localize(getStudioToolLabelKey(parsed.toolName));
    }
    return parsed.mcpServer;
  }
  if (parsed.friendlyKey) return localize(parsed.friendlyKey);
  return parsed.toolName;
}
