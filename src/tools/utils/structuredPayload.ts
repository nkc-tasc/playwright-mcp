/**
 * Structured Payload Helper for MCP Tools
 *
 * Provides common structure and utilities for consistent data format
 * across all MCP tools, following snapshot alignment pattern.
 */

import type { Context } from '../../context.js';

export type StructuredPayload<T> = {
  tool: string;
  version: number;
  timestamp: string;
  page: { url: string; title: string };
  target?: { ref?: string | null; selector?: string | null; element?: string | null };
  data: T;
};

/**
 * Build structured payload with common metadata
 *
 * @param context MCP context
 * @param tool Tool name (e.g., 'browser_get_element_attributes')
 * @param data Tool-specific data
 * @param target Target element information (optional)
 * @param version Payload version (default: 1)
 * @returns Complete structured payload
 */
export async function buildPayload<T>(
  context: Context,
  tool: string,
  data: T,
  target?: StructuredPayload<T>["target"],
  version = 1
): Promise<StructuredPayload<T>> {
  const tab = context.currentTabOrDie();
  return {
    tool,
    version,
    timestamp: new Date().toISOString(),
    page: {
      url: tab.page.url(),
      title: await tab.title(),
    },
    ...(target ? { target } : {}),
    data,
  };
}

// asResultOverride function removed as part of resultOverride elimination (fix8.md)