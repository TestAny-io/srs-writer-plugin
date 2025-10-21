/**
 * MCP Server Registry
 *
 * Singleton service that discovers and caches available MCP servers.
 * Reads server configurations from:
 * - .vscode/mcp.json (workspace)
 * - User global settings (future)
 * - Installed extensions (future)
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { MCPServerInfo, MCPServerConfig } from './mcp-types';
import { MCPClient } from './mcp-client';

export class MCPRegistry {
  private static instance: MCPRegistry;
  private servers: Map<string, MCPServerInfo> = new Map();
  private lastDiscovery: number = 0;
  private discoveryInterval = 5 * 60 * 1000; // 5 minutes
  private logger = Logger.getInstance();
  private mcpClient: MCPClient;

  private constructor() {
    this.mcpClient = new MCPClient();
  }

  static getInstance(): MCPRegistry {
    if (!MCPRegistry.instance) {
      MCPRegistry.instance = new MCPRegistry();
    }
    return MCPRegistry.instance;
  }

  /**
   * Discover all available MCP servers
   * Results are cached for 5 minutes unless force=true
   */
  async discoverServers(force: boolean = false): Promise<MCPServerInfo[]> {
    const now = Date.now();

    // Return cached results if still valid
    if (!force && now - this.lastDiscovery < this.discoveryInterval) {
      return Array.from(this.servers.values());
    }

    this.logger.info('🔍 Discovering MCP servers...');
    this.servers.clear();

    // Method 1: Discover from workspace configuration
    await this.discoverFromWorkspaceConfig();

    // Method 2: Discover from user global configuration (future)
    await this.discoverFromUserConfig();

    // Method 3: Discover from installed extensions (future)
    await this.discoverFromExtensions();

    this.lastDiscovery = now;
    this.logger.info(`✅ Discovered ${this.servers.size} MCP server(s)`);

    return Array.from(this.servers.values());
  }

  /**
   * Read MCP configuration from .vscode/mcp.json in workspace
   */
  private async discoverFromWorkspaceConfig(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.logger.debug('No workspace folder found');
      return;
    }

    try {
      const mcpConfigPath = vscode.Uri.joinPath(
        workspaceFolder.uri,
        '.vscode',
        'mcp.json'
      );

      const configData = await vscode.workspace.fs.readFile(mcpConfigPath);
      const config = JSON.parse(configData.toString());

      if (config.mcpServers && typeof config.mcpServers === 'object') {
        for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
          this.servers.set(name, {
            name,
            config: serverConfig as MCPServerConfig,
            source: 'user-config'
          });
          this.logger.debug(`📋 Discovered workspace MCP server: ${name}`);
        }
      }
    } catch (error) {
      this.logger.debug('No workspace MCP configuration found or invalid format');
    }
  }

  /**
   * Read MCP configuration from user global settings (future implementation)
   */
  private async discoverFromUserConfig(): Promise<void> {
    // VSCode may provide global MCP configuration API in the future
    // For now, skip this step
    this.logger.debug('Global MCP configuration discovery not yet implemented');
  }

  /**
   * Discover MCP servers provided by installed extensions (future implementation)
   */
  private async discoverFromExtensions(): Promise<void> {
    // Extensions may register MCP servers through some mechanism
    // For now, skip this step
    this.logger.debug('Extension-provided MCP server discovery not yet implemented');
  }

  /**
   * Find servers by capability
   * Uses multiple heuristics to identify servers with the requested capability:
   * 1. Check server name for capability keyword
   * 2. Check server config for capability keyword
   * 3. Check cached capabilities (if available)
   */
  findServersByCapability(capability: string): MCPServerInfo[] {
    const result: MCPServerInfo[] = [];
    const capabilityLower = capability.toLowerCase();

    for (const server of this.servers.values()) {
      let hasCapability = false;

      // Heuristic 1: Check server name
      if (server.name.toLowerCase().includes(capabilityLower)) {
        this.logger.debug(`✅ Server "${server.name}" matches capability "${capability}" (name match)`);
        hasCapability = true;
      }

      // Heuristic 2: Check if server name is a known search provider
      if (capability === 'search') {
        const knownSearchProviders = ['tavily', 'bing', 'google', 'baidu', 'perplexity', 'brave'];
        if (knownSearchProviders.some(provider => server.name.toLowerCase().includes(provider))) {
          this.logger.debug(`✅ Server "${server.name}" identified as search provider (known provider)`);
          hasCapability = true;
        }
      }

      // Heuristic 3: Check server configuration
      if (!hasCapability) {
        const configStr = JSON.stringify(server.config).toLowerCase();
        if (configStr.includes(capabilityLower)) {
          this.logger.debug(`✅ Server "${server.name}" matches capability "${capability}" (config match)`);
          hasCapability = true;
        }
      }

      // Heuristic 4: Check cached capabilities (if available)
      if (!hasCapability && server.capabilities?.tools) {
        const hasSearchTool = server.capabilities.tools.some(tool =>
          tool.toLowerCase().includes(capabilityLower)
        );
        if (hasSearchTool) {
          this.logger.debug(`✅ Server "${server.name}" matches capability "${capability}" (tool match)`);
          hasCapability = true;
        }
      }

      if (hasCapability) {
        result.push(server);
      }
    }

    return result;
  }

  /**
   * Get a specific server by name
   */
  getServer(name: string): MCPServerInfo | undefined {
    return this.servers.get(name);
  }

  /**
   * Get all discovered servers
   */
  getAllServers(): MCPServerInfo[] {
    return Array.from(this.servers.values());
  }

  /**
   * Force refresh of server discovery
   */
  async refresh(): Promise<void> {
    await this.discoverServers(true);
  }

  /**
   * Discover capabilities for a specific server
   * Queries the MCP server for its available tools and caches the result
   */
  async discoverServerCapabilities(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) {
      this.logger.warn(`Cannot discover capabilities: server "${serverName}" not found`);
      return;
    }

    try {
      this.logger.debug(`🔍 Discovering capabilities for MCP server: ${serverName}`);
      const tools = await this.mcpClient.listTools(server);

      // Update server info with discovered capabilities
      server.capabilities = {
        tools,
        resources: false, // Could query MCP for this if protocol supports it
        prompts: false,
        sampling: false
      };

      this.logger.info(`✅ Discovered ${tools.length} tool(s) for server "${serverName}": ${tools.join(', ')}`);
    } catch (error) {
      this.logger.warn(`Failed to discover capabilities for "${serverName}": ${(error as Error).message}`);
    }
  }

  /**
   * Discover capabilities for all registered servers
   * Useful for warming up the capability cache
   */
  async discoverAllCapabilities(): Promise<void> {
    const serverNames = Array.from(this.servers.keys());
    this.logger.info(`🔍 Discovering capabilities for ${serverNames.length} server(s)...`);

    await Promise.all(
      serverNames.map(name => this.discoverServerCapabilities(name))
    );
  }
}
