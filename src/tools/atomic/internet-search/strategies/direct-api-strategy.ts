/**
 * Direct API Strategy
 *
 * Performs internet search using direct API calls to configured providers.
 * Supports multiple providers with automatic fallback and result caching.
 *
 * Priority: 2 (after MCP, before Guidance)
 * Provider precedence: Tavily > Bing > Baidu (first configured wins)
 */

import { SearchStrategy, SearchRequest, SearchResult, StrategyStatus, SearchResultItem } from '../types';
import { Logger } from '../../../../utils/logger';
import { APIConfigManager } from '../config/api-config';
import { SearchCache } from '../config/search-cache';
import { TavilySearchProvider } from '../providers/tavily-provider';
import { BingSearchProvider } from '../providers/bing-provider';
import { BaiduSearchProvider } from '../providers/baidu-provider';

export class DirectAPIStrategy implements SearchStrategy {
  readonly name = '直接API调用';
  readonly priority = 2; // After MCP (1), before Guidance (999)

  private logger = Logger.getInstance();
  private configManager = APIConfigManager.getInstance();
  private cache = SearchCache.getInstance();

  // Provider instances
  private tavilyProvider = new TavilySearchProvider();
  private bingProvider = new BingSearchProvider();
  private baiduProvider = new BaiduSearchProvider();

  /**
   * Check if any API provider is configured
   */
  async isAvailable(): Promise<boolean> {
    const hasProvider = this.configManager.hasAnyProvider();

    if (hasProvider) {
      this.logger.debug('✅ DirectAPIStrategy available (at least one provider configured)');
    } else {
      this.logger.debug('⏭️  DirectAPIStrategy not available (no providers configured)');
    }

    return hasProvider;
  }

  /**
   * Execute search using configured API providers
   */
  async execute(request: SearchRequest): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // 1. Check cache first
      const cachedResult = this.cache.get(request.query, request.maxResults, request.searchType);
      if (cachedResult) {
        return cachedResult;
      }

      // 2. Try providers in order
      const providers = this.configManager.getAllConfiguredProviders();

      if (providers.length === 0) {
        throw new Error('No providers configured (this should not happen - isAvailable() should have returned false)');
      }

      let lastError: Error | null = null;

      for (const providerConfig of providers) {
        try {
          this.logger.info(`🔄 Trying provider: ${providerConfig.name}`);

          const results = await this.searchWithProvider(providerConfig.name, request, providerConfig);

          // 3. Format successful result
          const searchResult = this.formatSuccessResult(results, providerConfig.name);

          // 4. Cache the result
          this.cache.set(request.query, searchResult, request.maxResults, request.searchType);

          // 5. Add performance metadata
          searchResult.metadata.duration = Date.now() - startTime;

          return searchResult;

        } catch (error) {
          lastError = error as Error;
          this.logger.warn(`❌ Provider ${providerConfig.name} failed: ${lastError.message}`);
          // Continue to next provider
        }
      }

      // All providers failed
      throw new Error(`All providers failed. Last error: ${lastError?.message || 'Unknown error'}`);

    } catch (error) {
      this.logger.error(`DirectAPIStrategy failed: ${(error as Error).message}`);

      // Return error result (caller will try next strategy)
      throw error;
    }
  }

  /**
   * Search using a specific provider
   */
  private async searchWithProvider(
    providerName: string,
    request: SearchRequest,
    config: { apiKey?: string; secretKey?: string }
  ): Promise<SearchResultItem[]> {
    switch (providerName) {
      case 'tavily':
        if (!config.apiKey) throw new Error('Tavily API key missing');
        return await this.tavilyProvider.search(request, { apiKey: config.apiKey });

      case 'bing':
        if (!config.apiKey) throw new Error('Bing API key missing');
        return await this.bingProvider.search(request, { apiKey: config.apiKey });

      case 'baidu':
        if (!config.apiKey || !config.secretKey) throw new Error('Baidu API credentials missing');
        return await this.baiduProvider.search(request, {
          apiKey: config.apiKey,
          secretKey: config.secretKey
        });

      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  /**
   * Format search results into standardized response
   */
  private formatSuccessResult(items: SearchResultItem[], provider: string): SearchResult {
    // Generate markdown-formatted search data
    let searchData = `# 搜索结果\n\n`;
    searchData += `提供商: **${provider}**\n`;
    searchData += `结果数量: **${items.length}**\n\n`;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      searchData += `## ${i + 1}. ${item.title}\n\n`;
      searchData += `**URL**: ${item.url}\n\n`;
      searchData += `${item.snippet}\n\n`;
      if (item.relevance !== undefined) {
        searchData += `*相关度: ${item.relevance.toFixed(2)}*\n\n`;
      }
      searchData += `---\n\n`;
    }

    return {
      success: true,
      results: items,
      searchData,
      metadata: {
        provider,
        strategy: 'direct-api',
        timestamp: new Date().toISOString(),
        cached: false
      }
    };
  }

  /**
   * Get strategy status
   */
  async getStatus(): Promise<StrategyStatus> {
    const providers = this.configManager.getAllConfiguredProviders();

    if (providers.length === 0) {
      return {
        available: false,
        message: '无可用的API提供商配置',
        requiresSetup: true,
        setupInstructions: '请在VS Code设置中配置至少一个搜索API (Tavily/Bing/百度)'
      };
    }

    const providerNames = providers.map(p => p.name).join(', ');
    return {
      available: true,
      message: `已配置提供商: ${providerNames}`,
      requiresSetup: false
    };
  }
}
