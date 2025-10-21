/**
 * MCP (Model Context Protocol) Infrastructure Layer
 *
 * This module provides a generic, reusable infrastructure for interacting with MCP servers.
 * It can be used by any tool that needs MCP capabilities, not just internetSearch.
 *
 * Usage example:
 * ```typescript
 * import { MCPToolInvoker } from '@/core/mcp';
 *
 * const invoker = MCPToolInvoker.getInstance();
 * const servers = await invoker.findServersWithCapability('search');
 * if (servers.length > 0) {
 *   const result = await invoker.invokeTool({
 *     serverName: servers[0].name,
 *     toolName: 'web_search',
 *     parameters: { query: 'hello world' }
 *   });
 * }
 * ```
 */

export * from './mcp-types';
export { MCPRegistry } from './mcp-registry';
export { MCPClient } from './mcp-client';
export { MCPToolInvoker } from './mcp-tool-invoker';
