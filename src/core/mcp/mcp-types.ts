/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * This module defines all TypeScript interfaces and types for the MCP infrastructure layer.
 */

/**
 * MCP Server Configuration
 * Defines how to connect to an MCP server
 */
export interface MCPServerConfig {
  /** Command to execute to start the MCP server */
  command: string;
  /** Command line arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Server type: stdio (default) or http */
  type?: 'stdio' | 'http';
  /** URL for HTTP-based servers */
  url?: string;
}

/**
 * MCP Server Information
 * Represents a discovered or configured MCP server
 */
export interface MCPServerInfo {
  /** Unique name of the server */
  name: string;
  /** Server configuration */
  config: MCPServerConfig;
  /** Where this server was discovered from */
  source: 'user-config' | 'global-config' | 'extension';
  /** Server capabilities (if discovered) */
  capabilities?: MCPServerCapabilities;
}

/**
 * MCP Server Capabilities
 * What features this MCP server supports
 */
export interface MCPServerCapabilities {
  /** List of available tool names */
  tools?: string[];
  /** Whether server supports resources */
  resources?: boolean;
  /** Whether server supports prompts */
  prompts?: boolean;
  /** Whether server supports sampling */
  sampling?: boolean;
}

/**
 * MCP Tool Invocation Request
 * Parameters for invoking a tool on an MCP server
 */
export interface MCPToolInvocationRequest {
  /** Name of the MCP server to use */
  serverName: string;
  /** Name of the tool to invoke */
  toolName: string;
  /** Tool parameters */
  parameters: Record<string, any>;
  /** Optional timeout in milliseconds */
  timeout?: number;
}

/**
 * MCP Tool Invocation Result
 * Result of an MCP tool invocation
 */
export interface MCPToolInvocationResult {
  /** Whether the invocation was successful */
  success: boolean;
  /** Tool result content (if successful) */
  content?: any;
  /** Error message (if failed) */
  error?: string;
  /** Metadata about the invocation */
  metadata?: {
    serverName: string;
    toolName: string;
    duration: number;
  };
}
