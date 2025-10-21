/**
 * Bing Search API Provider
 *
 * Integrates with Microsoft Bing Search API (Azure Cognitive Services).
 * API Documentation: https://docs.microsoft.com/azure/cognitive-services/bing-web-search/
 *
 * Authentication: Subscription Key
 * Target Region: Global (requires Azure account)
 */

import { Logger } from '../../../../utils/logger';
import { SearchRequest, SearchResultItem } from '../types';

export class BingSearchProvider {
  private logger = Logger.getInstance();
  private baseUrl = 'https://api.bing.microsoft.com/v7.0/search';

  /**
   * Perform Bing search
   */
  async search(
    request: SearchRequest,
    config: {
      apiKey: string;
    }
  ): Promise<SearchResultItem[]> {
    try {
      this.logger.info(`🔍 Bing search: "${request.query}"`);

      // Build query parameters
      const params = new URLSearchParams({
        q: request.query,
        count: String(request.maxResults || 5),
        responseFilter: 'Webpages', // Only web results
        safeSearch: 'Moderate'
      });

      // Call Bing API
      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': config.apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bing API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      // Parse results
      return this.parseResults(data);
    } catch (error) {
      this.logger.error(`Bing search failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Parse Bing search results
   */
  private parseResults(data: any): SearchResultItem[] {
    const results: SearchResultItem[] = [];

    if (data.webPages && data.webPages.value && Array.isArray(data.webPages.value)) {
      for (const item of data.webPages.value) {
        results.push({
          title: item.name || '无标题',
          url: item.url || '#',
          snippet: item.snippet || '',
          relevance: undefined // Bing doesn't provide explicit relevance scores
        });
      }
    }

    return results;
  }
}
