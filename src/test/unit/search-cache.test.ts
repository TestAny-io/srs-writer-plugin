/**
 * 搜索缓存单元测试
 *
 * 测试LRU缓存和TTL功能
 */

import { SearchCache } from '../../tools/atomic/internet-search/config/search-cache';
import { SearchResult } from '../../tools/atomic/internet-search/types';

// Mock Logger
jest.mock('../../utils/logger', () => ({
  Logger: {
    getInstance: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    })
  }
}));

describe('SearchCache', () => {
  let cache: SearchCache;
  let mockSearchResult: SearchResult;

  beforeEach(() => {
    cache = SearchCache.getInstance();
    cache.clear(); // Clear cache before each test

    mockSearchResult = {
      success: true,
      searchData: 'Test search data',
      metadata: {
        provider: 'test-provider',
        strategy: 'test-strategy',
        timestamp: new Date().toISOString()
      }
    };
  });

  describe('Singleton Pattern', () => {
    it('应该返回相同的实例', () => {
      const instance1 = SearchCache.getInstance();
      const instance2 = SearchCache.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('set and get', () => {
    it('应该能够设置和获取缓存结果', () => {
      cache.set('test query', mockSearchResult);

      const result = cache.get('test query');

      expect(result).toBeDefined();
      expect(result?.searchData).toBe('Test search data');
      expect(result?.metadata.cached).toBe(true);
    });

    it('应该区分不同的查询', () => {
      const result1: SearchResult = { ...mockSearchResult, searchData: 'Result 1' };
      const result2: SearchResult = { ...mockSearchResult, searchData: 'Result 2' };

      cache.set('query 1', result1);
      cache.set('query 2', result2);

      expect(cache.get('query 1')?.searchData).toBe('Result 1');
      expect(cache.get('query 2')?.searchData).toBe('Result 2');
    });

    it('应该区分不同的maxResults参数', () => {
      const result5: SearchResult = { ...mockSearchResult, searchData: 'Max 5' };
      const result10: SearchResult = { ...mockSearchResult, searchData: 'Max 10' };

      cache.set('same query', result5, 5);
      cache.set('same query', result10, 10);

      expect(cache.get('same query', 5)?.searchData).toBe('Max 5');
      expect(cache.get('same query', 10)?.searchData).toBe('Max 10');
    });

    it('应该区分不同的searchType参数', () => {
      const resultGeneral: SearchResult = { ...mockSearchResult, searchData: 'General' };
      const resultTechnical: SearchResult = { ...mockSearchResult, searchData: 'Technical' };

      cache.set('same query', resultGeneral, 5, 'general');
      cache.set('same query', resultTechnical, 5, 'technical');

      expect(cache.get('same query', 5, 'general')?.searchData).toBe('General');
      expect(cache.get('same query', 5, 'technical')?.searchData).toBe('Technical');
    });

    it('查询应该不区分大小写', () => {
      cache.set('Test Query', mockSearchResult);

      const result = cache.get('test query');

      expect(result).toBeDefined();
      expect(result?.searchData).toBe('Test search data');
    });

    it('查询应该去除前后空格', () => {
      cache.set('  test query  ', mockSearchResult);

      const result = cache.get('test query');

      expect(result).toBeDefined();
    });
  });

  describe('TTL (Time To Live)', () => {
    it('当缓存未过期时应该返回结果', () => {
      cache.set('test query', mockSearchResult);

      // Immediately get should work
      const result = cache.get('test query');

      expect(result).toBeDefined();
      expect(result?.metadata.cached).toBe(true);
    });

    it('当缓存过期时应该返回null', async () => {
      // Set a result
      cache.set('test query', mockSearchResult);

      // Mock time passing (5 minutes + 1 second)
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 5 * 60 * 1000 + 1000);

      const result = cache.get('test query');

      expect(result).toBeNull();

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('LRU Eviction', () => {
    it('当缓存满时应该移除最旧的条目', () => {
      // Get private MAX_ENTRIES value through reflection
      const maxEntries = (cache as any).MAX_ENTRIES;

      // Fill cache to max
      for (let i = 0; i < maxEntries; i++) {
        cache.set(`query ${i}`, mockSearchResult);
      }

      // Add one more (should evict first)
      cache.set('new query', mockSearchResult);

      // First query should be evicted
      expect(cache.get('query 0')).toBeNull();

      // Last query should still be there
      expect(cache.get(`query ${maxEntries - 1}`)).toBeDefined();

      // New query should be there
      expect(cache.get('new query')).toBeDefined();
    });
  });

  describe('clear', () => {
    it('应该清除所有缓存条目', () => {
      cache.set('query 1', mockSearchResult);
      cache.set('query 2', mockSearchResult);
      cache.set('query 3', mockSearchResult);

      cache.clear();

      expect(cache.get('query 1')).toBeNull();
      expect(cache.get('query 2')).toBeNull();
      expect(cache.get('query 3')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', () => {
      cache.set('query 1', mockSearchResult);
      cache.set('query 2', mockSearchResult);

      const stats = cache.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.validEntries).toBe(2);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.maxEntries).toBeGreaterThan(0);
      expect(stats.ttlMs).toBeGreaterThan(0);
    });

    it('应该正确计算过期条目', () => {
      cache.set('query 1', mockSearchResult);
      cache.set('query 2', mockSearchResult);

      // Mock time passing
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 6 * 60 * 1000); // 6 minutes later

      const stats = cache.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.validEntries).toBe(0);
      expect(stats.expiredEntries).toBe(2);

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('Edge Cases', () => {
    it('应该处理空查询字符串', () => {
      cache.set('', mockSearchResult);

      const result = cache.get('');

      expect(result).toBeDefined();
    });

    it('应该处理非常长的查询字符串', () => {
      const longQuery = 'a'.repeat(1000);
      cache.set(longQuery, mockSearchResult);

      const result = cache.get(longQuery);

      expect(result).toBeDefined();
    });

    it('应该处理特殊字符', () => {
      const specialQuery = '测试查询 with 特殊字符 !@#$%^&*()';
      cache.set(specialQuery, mockSearchResult);

      const result = cache.get(specialQuery);

      expect(result).toBeDefined();
    });
  });
});
