/**
 * Search Result Cache
 *
 * Simple in-memory cache for search results to avoid redundant API calls.
 * Uses LRU (Least Recently Used) eviction with TTL (Time To Live).
 */

import { Logger } from '../../../../utils/logger';
import { SearchResult } from '../types';

interface CacheEntry {
  result: SearchResult;
  timestamp: number;
}

export class SearchCache {
  private static instance: SearchCache;
  private cache: Map<string, CacheEntry> = new Map();
  private logger = Logger.getInstance();

  // Cache configuration
  private readonly MAX_ENTRIES = 100; // Maximum number of cached queries
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

  private constructor() {}

  static getInstance(): SearchCache {
    if (!SearchCache.instance) {
      SearchCache.instance = new SearchCache();
    }
    return SearchCache.instance;
  }

  /**
   * Generate cache key from query parameters
   */
  private generateKey(query: string, maxResults?: number, searchType?: string): string {
    const normalized = query.toLowerCase().trim();
    return `${normalized}|${maxResults || 5}|${searchType || 'general'}`;
  }

  /**
   * Get cached result if available and not expired
   */
  get(query: string, maxResults?: number, searchType?: string): SearchResult | null {
    const key = this.generateKey(query, maxResults, searchType);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.TTL_MS) {
      this.logger.debug(`Cache expired for query: "${query}" (age: ${Math.round(age / 1000)}s)`);
      this.cache.delete(key);
      return null;
    }

    this.logger.info(`✅ Cache hit for query: "${query}" (age: ${Math.round(age / 1000)}s)`);

    // Mark result as cached
    return {
      ...entry.result,
      metadata: {
        ...entry.result.metadata,
        cached: true
      }
    };
  }

  /**
   * Store result in cache
   */
  set(query: string, result: SearchResult, maxResults?: number, searchType?: string): void {
    const key = this.generateKey(query, maxResults, searchType);

    // LRU eviction: if cache is full, remove oldest entry
    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.logger.debug(`Cache full, evicted oldest entry: ${oldestKey}`);
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });

    this.logger.debug(`Cached result for query: "${query}"`);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.logger.info('Search cache cleared');
  }

  /**
   * Get cache statistics (for diagnostics)
   */
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    const validEntries = entries.filter(e => now - e.timestamp <= this.TTL_MS);

    return {
      totalEntries: this.cache.size,
      validEntries: validEntries.length,
      expiredEntries: this.cache.size - validEntries.length,
      maxEntries: this.MAX_ENTRIES,
      ttlMs: this.TTL_MS
    };
  }
}
