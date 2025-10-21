/**
 * MCP Strategy
 *
 * Performs internet search using MCP (Model Context Protocol) servers.
 * This is the highest-priority strategy when MCP search servers are configured.
 *
 * Priority: 1 (highest - tries first before DirectAPI and Guidance)
 * Looks for MCP servers with 'search' or 'web-search' capability
 */

import { SearchStrategy, SearchRequest, SearchResult, StrategyStatus, SearchResultItem } from '../types';
import { Logger } from '../../../../utils/logger';
import { MCPToolInvoker } from '../../../../core/mcp/mcp-tool-invoker';
import { SearchCache } from '../config/search-cache';

export class MCPStrategy implements SearchStrategy {
  readonly name = 'MCP服务器';
  readonly priority = 1; // Highest priority

  private logger = Logger.getInstance();
  private mcpInvoker = MCPToolInvoker.getInstance();
  private cache = SearchCache.getInstance();

  /**
   * Check if any MCP search server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Look for MCP servers that might provide search functionality
      const servers = await this.mcpInvoker.findServersWithCapability('search');

      if (servers.length > 0) {
        this.logger.debug(`✅ MCPStrategy available (${servers.length} search servers found)`);
        return true;
      } else {
        this.logger.debug('⏭️  MCPStrategy not available (no search servers found)');
        return false;
      }
    } catch (error) {
      this.logger.debug(`MCPStrategy availability check failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Execute search using MCP server
   */
  async execute(request: SearchRequest): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // 1. Check cache first
      const cachedResult = this.cache.get(request.query, request.maxResults, request.searchType);
      if (cachedResult) {
        return cachedResult;
      }

      // 2. Find available search servers
      const servers = await this.mcpInvoker.findServersWithCapability('search');

      if (servers.length === 0) {
        throw new Error('No MCP search servers available');
      }

      // 3. Try to invoke search tool on the first available server
      const server = servers[0];
      this.logger.info(`🔄 Using MCP server: ${server.name}`);

      // Try common search tool names
      const toolNames = [
        'tavily-search',
        'web_search',
        'web-search',
        'search',
        'internet_search'
      ];

      let lastError: Error | null = null;

      for (const toolName of toolNames) {
        try {
          const result = await this.mcpInvoker.invokeTool({
            serverName: server.name,
            toolName,
            parameters: {
              query: request.query,
              max_results: request.maxResults || 5,
              search_type: request.searchType || 'general'
            }
          });

          if (result.success && result.content) {
            // 4. Format the result
            const searchResult = this.formatMCPResult(result.content, server.name);

            // 5. Cache the result
            this.cache.set(request.query, searchResult, request.maxResults, request.searchType);

            // 6. Add performance metadata
            searchResult.metadata.duration = Date.now() - startTime;

            return searchResult;
          }
        } catch (error) {
          lastError = error as Error;
          this.logger.debug(`Tool ${toolName} not found or failed: ${lastError.message}`);
          // Try next tool name
          continue;
        }
      }

      // None of the tool names worked
      throw new Error(`No working search tool found on MCP server ${server.name}. Last error: ${lastError?.message || 'Unknown'}`);

    } catch (error) {
      this.logger.error(`MCPStrategy failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Format MCP result into standardized SearchResult
   */
  private formatMCPResult(content: any, serverName: string): SearchResult {
    // MCP servers may return different formats
    // Try to normalize them into our standard format

    let results: SearchResultItem[] = [];
    let searchData = '';

    // Case 1: Already structured as results array
    if (Array.isArray(content)) {
      results = content.map(item => ({
        title: item.title || item.name || '无标题',
        url: item.url || item.link || '#',
        snippet: item.snippet || item.content || item.description || '',
        relevance: item.score || item.relevance
      }));
    }
    // Case 2: Result wrapped in a 'results' field
    else if (content.results && Array.isArray(content.results)) {
      results = content.results.map((item: any) => ({
        title: item.title || item.name || '无标题',
        url: item.url || item.link || '#',
        snippet: item.snippet || item.content || item.description || '',
        relevance: item.score || item.relevance
      }));
    }
    // Case 3: Plain text response
    else if (typeof content === 'string') {
      searchData = content;
    }
    // Case 4: Unknown format - stringify it
    else {
      searchData = JSON.stringify(content, null, 2);
    }

    // Generate markdown format if we have structured results
    if (results.length > 0) {
      searchData = `# 搜索结果\n\n`;
      searchData += `提供商: **MCP Server (${serverName})**\n`;
      searchData += `结果数量: **${results.length}**\n\n`;

      for (let i = 0; i < results.length; i++) {
        const item = results[i];
        searchData += `## ${i + 1}. ${item.title}\n\n`;
        searchData += `**URL**: ${item.url}\n\n`;
        searchData += `${item.snippet}\n\n`;
        if (item.relevance !== undefined) {
          searchData += `*相关度: ${item.relevance.toFixed(2)}*\n\n`;
        }
        searchData += `---\n\n`;
      }
    }

    return {
      success: true,
      results: results.length > 0 ? results : undefined,
      searchData,
      metadata: {
        provider: serverName,
        strategy: 'mcp',
        timestamp: new Date().toISOString(),
        cached: false
      }
    };
  }

  /**
   * Get strategy status
   */
  async getStatus(): Promise<StrategyStatus> {
    try {
      const servers = await this.mcpInvoker.findServersWithCapability('search');

      if (servers.length === 0) {
        return {
          available: false,
          message: '未找到MCP搜索服务器',
          requiresSetup: true,
          setupInstructions: '请在 .vscode/mcp.json 中配置MCP搜索服务器 (如 Tavily MCP)'
        };
      }

      const serverNames = servers.map(s => s.name).join(', ');
      return {
        available: true,
        message: `已发现MCP服务器: ${serverNames}`,
        requiresSetup: false
      };
    } catch (error) {
      return {
        available: false,
        message: `MCP状态检查失败: ${(error as Error).message}`,
        requiresSetup: true
      };
    }
  }
}
