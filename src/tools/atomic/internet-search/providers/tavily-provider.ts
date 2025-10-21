/**
 * Tavily Search API Provider
 *
 * Integrates with Tavily AI Search API for optimized AI-powered search.
 * API Documentation: https://docs.tavily.com/
 *
 * Authentication: API Key
 * Target Region: Global (optimized for international users)
 */

import { Logger } from '../../../../utils/logger';
import { SearchRequest, SearchResultItem } from '../types';

export class TavilySearchProvider {
  private logger = Logger.getInstance();
  private baseUrl = 'https://api.tavily.com/search';

  /**
   * Perform Tavily search
   */
  async search(
    request: SearchRequest,
    config: {
      apiKey: string;
    }
  ): Promise<SearchResultItem[]> {
    try {
      this.logger.info(`🔍 Tavily search: "${request.query}"`);

      // Call Tavily API
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          query: request.query,
          max_results: request.maxResults || 5,
          search_depth: this.mapSearchType(request.searchType),
          include_answer: false, // We only want search results, not AI-generated answers
          include_raw_content: false // Don't need full page content
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tavily API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      // Parse results
      return this.parseResults(data);
    } catch (error) {
      this.logger.error(`Tavily search failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Map search type to Tavily API format
   */
  private mapSearchType(type?: string): string {
    switch (type) {
      case 'technical':
      case 'documentation':
        return 'advanced'; // More thorough search for technical queries
      default:
        return 'basic'; // Faster search for general queries
    }
  }

  /**
   * Parse Tavily search results
   */
  private parseResults(data: any): SearchResultItem[] {
    const results: SearchResultItem[] = [];

    if (data.results && Array.isArray(data.results)) {
      for (const item of data.results) {
        results.push({
          title: item.title || '无标题',
          url: item.url || '#',
          snippet: item.content || '',
          relevance: item.score
        });
      }
    }

    return results;
  }
}
