import { logger } from '@librechat/data-schemas';
import type { ToolDefinition } from '~/tools/classification';

/** LibreChat's MCP tool-key delimiter: `<tool>_mcp_<server>`. */
const MCP_DELIMITER = '_mcp_';

/**
 * Heals the gap between how prompts name MCP tools and how the runtime binds
 * them. Tool definitions are model-facing under their persisted catalog key
 * (`<tool>_mcp_<server>`), but personas and capability instructions naturally
 * write the bare upstream name (`create_formatted_document`). A model that
 * copies the prompt's spelling emits a call the ToolNode cannot resolve and
 * the turn surfaces "Tool … not found" instead of work.
 *
 * The healing table maps each MCP definition's bare name to its bound name —
 * but ONLY when the bare name is unambiguous: it must not equal another
 * definition's full name (built-ins included) and must not occur as the bare
 * name of two different servers. Ambiguous names stay untouched, so a
 * colliding tool keeps requiring its full key.
 */
export function buildBareToBoundToolNames(
  toolDefinitions: readonly ToolDefinition[] | undefined,
): Map<string, string> {
  const bareToBound = new Map<string, string>();
  if (!toolDefinitions || toolDefinitions.length === 0) {
    return bareToBound;
  }
  const allDefNames = new Set<string>();
  const bareCounts = new Map<string, number>();
  const bareToServerBound = new Map<string, string>();
  for (const def of toolDefinitions) {
    if (def?.name == null || def.name === '') {
      continue;
    }
    allDefNames.add(def.name);
    const delimiterIndex = def.name.indexOf(MCP_DELIMITER);
    if (delimiterIndex <= 0) {
      continue;
    }
    const bare = def.name.slice(0, delimiterIndex);
    if (bare.includes(MCP_DELIMITER)) {
      continue;
    }
    bareCounts.set(bare, (bareCounts.get(bare) ?? 0) + 1);
    bareToServerBound.set(bare, def.name);
  }
  for (const [bare, count] of bareCounts) {
    if (count !== 1) {
      continue;
    }
    const bound = bareToServerBound.get(bare);
    if (bound == null || allDefNames.has(bare)) {
      continue;
    }
    bareToBound.set(bare, bound);
  }
  return bareToBound;
}

/**
 * Rewrites every whole-word, un-suffixed mention of a bare MCP tool name in a
 * prompt string into its bound catalog name. Mentions that are already
 * followed by `_mcp_` (a full key written out in the prompt) are left alone.
 */
export function healToolNameReferences(text: string, bareToBound: Map<string, string>): string {
  if (!text || bareToBound.size === 0) {
    return text;
  }
  let healed = text;
  /** Longest first so a bare name that is a prefix of another heals the longer one. */
  const bares = [...bareToBound.keys()].sort((a, b) => b.length - a.length);
  for (const bare of bares) {
    const bound = bareToBound.get(bare);
    if (bound == null) {
      continue;
    }
    const pattern = new RegExp(
      `\\b${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!${MCP_DELIMITER})`,
      'g',
    );
    healed = healed.replace(pattern, bound);
  }
  return healed;
}

/**
 * Heals an agent's instruction surfaces in place: the system prompt and the
 * per-tool context maps, whose entries name tools in the same prose style.
 * Returns true when anything changed, for a single debug log per agent.
 */
export function healAgentToolNameReferences(
  instructions: string | undefined,
  toolContextMap: Record<string, unknown> | undefined,
  dynamicToolContextMap: Record<string, unknown> | undefined,
  toolDefinitions: readonly ToolDefinition[] | undefined,
): {
  instructions?: string;
  toolContextMap?: Record<string, unknown>;
  dynamicToolContextMap?: Record<string, unknown>;
} {
  const bareToBound = buildBareToBoundToolNames(toolDefinitions);
  if (bareToBound.size === 0) {
    return {};
  }
  let changed = false;
  const healedInstructions = instructions
    ? healToolNameReferences(instructions, bareToBound)
    : undefined;
  if (healedInstructions !== instructions) {
    changed = true;
  }
  const healMap = (map?: Record<string, unknown>) => {
    if (map == null || Object.keys(map).length === 0) {
      return undefined;
    }
    let mapChanged = false;
    const healed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(map)) {
      if (typeof value === 'string') {
        const healedValue = healToolNameReferences(value, bareToBound);
        healed[key] = healedValue;
        mapChanged = mapChanged || healedValue !== value;
      } else {
        healed[key] = value;
      }
    }
    if (mapChanged) {
      changed = true;
      return healed;
    }
    return undefined;
  };
  const healedToolContextMap = healMap(toolContextMap);
  const healedDynamicToolContextMap = healMap(dynamicToolContextMap);
  if (changed) {
    logger.debug(
      `[toolNameHealing] Healed ${bareToBound.size} bare MCP tool name(s) in the agent's instructions.`,
    );
  }
  return {
    ...(changed && healedInstructions != null ? { instructions: healedInstructions } : {}),
    ...(healedToolContextMap != null ? { toolContextMap: healedToolContextMap } : {}),
    ...(healedDynamicToolContextMap != null
      ? { dynamicToolContextMap: healedDynamicToolContextMap }
      : {}),
  };
}
