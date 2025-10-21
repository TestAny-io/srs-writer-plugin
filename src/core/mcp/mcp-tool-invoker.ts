/**
 * MCP Tool Invoker
 *
 * High-level API for invoking tools on MCP servers.
 * Provides a simplified interface that other tools can use without
 * worrying about the underlying MCP protocol details.
 */

import { Logger } from '../../utils/logger';
import { MCPRegistry } from './mcp-registry';
import { MCPClient } from './mcp-client';
import {
  MCPToolInvocationRequest,
  MCPToolInvocationResult,
  MCPServerInfo
} from './mcp-types';

export class MCPToolInvoker {
  private static instance: MCPToolInvoker;
  private logger = Logger.getInstance();
  private registry = MCPRegistry.getInstance();
  private client = new MCPClient();

  private constructor() {}

  static getInstance(): MCPToolInvoker {
    if (!MCPToolInvoker.instance) {
      MCPToolInvoker.instance = new MCPToolInvoker();
    }
    return MCPToolInvoker.instance;
  }

  /**
   * Invoke an MCP tool (high-level API)
   * This is the main entry point for other tools to use MCP
   */
  async invokeTool(
    request: MCPToolInvocationRequest
  ): Promise<MCPToolInvocationResult> {
    const startTime = Date.now();

    try {
      // 1. Find the server
      const server = this.registry.getServer(request.serverName);
      if (!server) {
        throw new Error(`MCP server not found: ${request.serverName}`);
      }

      // 2. Invoke the tool
      this.logger.info(`🚀 Invoking ${request.serverName}/${request.toolName}`);
      const content = await this.client.invokeTool(
        server,
        request.toolName,
        request.parameters
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        content,
        metadata: {
          serverName: request.serverName,
          toolName: request.toolName,
          duration
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          serverName: request.serverName,
          toolName: request.toolName,
          duration
        }
      };
    }
  }

  /**
   * Find all servers that have a specific capability
   * Useful for discovering which servers can handle a particular task
   */
  async findServersWithCapability(capability: string): Promise<MCPServerInfo[]> {
    await this.registry.discoverServers();
    return this.registry.findServersByCapability(capability);
  }

  /**
   * Get status of all available MCP servers
   * Useful for diagnostics and health checks
   */
  async getServerStatus(): Promise<
    Array<{
      name: string;
      healthy: boolean;
      source: string;
    }>
  > {
    await this.registry.discoverServers();
    const servers = this.registry.getAllServers();

    const statusList = await Promise.all(
      servers.map(async (server) => ({
        name: server.name,
        healthy: await this.client.healthCheck(server),
        source: server.source
      }))
    );

    return statusList;
  }
}
