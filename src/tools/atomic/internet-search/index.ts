/**
 * Internet Search Tool - Main Entry Point
 *
 * Multi-strategy internet search tool with elegant degradation.
 * Tries strategies in priority order: MCP → Direct API → Guidance
 *
 * Key Features:
 * - Never fails (always returns useful response)
 * - No popups (results go directly to chat)
 * - Zero-configuration startup (guidance provided when needed)
 * - Supports multiple providers (Tavily, Bing, Baidu)
 */

import { SearchRequest, SearchResult, SearchStrategy } from './types';
import { GuidanceStrategy } from './strategies/guidance-strategy';
import { DirectAPIStrategy } from './strategies/direct-api-strategy';
import { MCPStrategy } from './strategies/mcp-strategy';
import { Logger } from '../../../utils/logger';

export class InternetSearchTool {
  private logger = Logger.getInstance();
  private strategies: SearchStrategy[] = [];

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Initialize all search strategies in priority order
   */
  private initializeStrategies(): void {
    // All strategies now implemented (Phase 3 complete)
    this.strategies = [
      new MCPStrategy(),        // Priority 1: MCP servers (highest)
      new DirectAPIStrategy(),  // Priority 2: Direct API calls
      new GuidanceStrategy()    // Priority 999: Always-available fallback
    ];

    // Sort by priority (lower number = higher priority)
    this.strategies.sort((a, b) => a.priority - b.priority);

    this.logger.info(`📋 Initialized ${this.strategies.length} search strategies`);
  }

  /**
   * Perform internet search using best available strategy
   * This is the main entry point for the tool
   */
  async search(request: SearchRequest): Promise<SearchResult> {
    this.logger.info(`🔍 Internet search requested: "${request.query}"`);

    // Try each strategy in priority order
    for (const strategy of this.strategies) {
      try {
        // Check if strategy is available
        const available = await strategy.isAvailable();
        if (!available) {
          this.logger.debug(`⏭️  Strategy "${strategy.name}" not available, trying next...`);
          continue;
        }

        // Execute the strategy
        this.logger.info(`✅ Using strategy: ${strategy.name}`);
        const result = await strategy.execute(request);

        // Return result (even if it's guidance)
        return result;
      } catch (error) {
        // Log error but continue to next strategy
        this.logger.warn(
          `❌ Strategy "${strategy.name}" failed: ${(error as Error).message}. Trying next strategy...`
        );
        continue;
      }
    }

    // This should never happen (GuidanceStrategy is always available)
    // But just in case, return a basic guidance message
    this.logger.error('🚨 All strategies failed (this should not happen!)');
    return {
      success: true,
      searchData: '网络搜索暂时不可用,请稍后再试。',
      metadata: {
        provider: 'emergency-fallback',
        strategy: 'error',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Get status of all strategies (for diagnostics)
   */
  async getStrategiesStatus() {
    const statuses = await Promise.all(
      this.strategies.map(async (strategy) => ({
        name: strategy.name,
        priority: strategy.priority,
        ...(await strategy.getStatus())
      }))
    );

    return statuses;
  }
}

/**
 * Main search function - exported for use in tool definitions
 */
export async function internetSearch(args: {
  query: string;
  maxResults?: number;
  searchType?: 'general' | 'technical' | 'documentation';
}): Promise<SearchResult> {
  const tool = new InternetSearchTool();
  return await tool.search({
    query: args.query,
    maxResults: args.maxResults || 5,
    searchType: args.searchType || 'general'
  });
}

// ============================================================================
// 导出定义和实现 - 遵循原子工具模块标准模式
// ============================================================================

import { internetSearchToolDefinition } from './tool-definition';

export { internetSearchToolDefinition };

export const internetSearchToolDefinitions = [
  internetSearchToolDefinition
];

export const internetSearchToolImplementations = {
  internetSearch
};
