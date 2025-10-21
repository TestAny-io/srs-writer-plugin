/**
 * Baidu Search API Provider
 *
 * Integrates with Baidu AI Search API for Chinese users.
 * API Documentation: https://ai.baidu.com/ai-doc/SEARCH/
 *
 * Authentication: OAuth 2.0 (API Key + Secret Key)
 * Target Region: Mainland China
 */

import { Logger } from '../../../../utils/logger';
import { SearchRequest, SearchResultItem } from '../types';

export class BaiduSearchProvider {
  private logger = Logger.getInstance();
  private baseUrl = 'https://aip.baidubce.com/rest/2.0/solution/v1/search';
  private tokenUrl = 'https://aip.baidubce.com/oauth/2.0/token';

  /**
   * Perform Baidu search
   */
  async search(
    request: SearchRequest,
    config: {
      apiKey: string;
      secretKey: string;
    }
  ): Promise<SearchResultItem[]> {
    try {
      this.logger.info(`🔍 Baidu search: "${request.query}"`);

      // 1. Get access_token via OAuth 2.0
      const accessToken = await this.getAccessToken(config.apiKey, config.secretKey);

      // 2. Call search API
      const searchUrl = `${this.baseUrl}?access_token=${accessToken}`;
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: request.query,
          num: request.maxResults || 5,
          type: this.mapSearchType(request.searchType)
        })
      });

      if (!response.ok) {
        throw new Error(`Baidu API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;

      // 3. Parse results
      return this.parseResults(data);
    } catch (error) {
      this.logger.error(`Baidu search failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get Baidu access_token via OAuth 2.0
   */
  private async getAccessToken(apiKey: string, secretKey: string): Promise<string> {
    const url = `${this.tokenUrl}?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to get Baidu access_token');
    }

    const data = await response.json() as any;
    if (!data.access_token) {
      throw new Error('Invalid Baidu API token response format');
    }

    return data.access_token as string;
  }

  /**
   * Map search type to Baidu API format
   */
  private mapSearchType(type?: string): string {
    switch (type) {
      case 'technical':
        return 'tech';
      case 'documentation':
        return 'doc';
      default:
        return 'general';
    }
  }

  /**
   * Parse Baidu search results
   */
  private parseResults(data: any): SearchResultItem[] {
    const results: SearchResultItem[] = [];

    if (data.results && Array.isArray(data.results)) {
      for (const item of data.results) {
        results.push({
          title: item.title || '无标题',
          url: item.url || '#',
          snippet: item.abstract || item.desc || '',
          relevance: item.score
        });
      }
    }

    return results;
  }
}
