/**
 * Guidance Strategy 单元测试
 *
 * 测试始终可用的fallback策略
 */

import { GuidanceStrategy } from '../../tools/atomic/internet-search/strategies/guidance-strategy';

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

describe('GuidanceStrategy', () => {
  let strategy: GuidanceStrategy;

  beforeEach(() => {
    strategy = new GuidanceStrategy();
  });

  describe('Strategy Properties', () => {
    it('应该有正确的名称', () => {
      expect(strategy.name).toBe('设置指导');
    });

    it('应该有最低优先级', () => {
      expect(strategy.priority).toBe(999);
    });
  });

  describe('isAvailable', () => {
    it('应该始终返回true', async () => {
      const available = await strategy.isAvailable();
      expect(available).toBe(true);
    });

    it('多次调用应该始终返回true', async () => {
      for (let i = 0; i < 10; i++) {
        const available = await strategy.isAvailable();
        expect(available).toBe(true);
      }
    });
  });

  describe('execute', () => {
    it('应该返回成功结果', async () => {
      const result = await strategy.execute({
        query: 'test query',
        maxResults: 5,
        searchType: 'general'
      });

      expect(result.success).toBe(true);
    });

    it('应该返回包含设置指导的searchData', async () => {
      const result = await strategy.execute({
        query: 'test query'
      });

      expect(result.searchData).toBeDefined();
      expect(typeof result.searchData).toBe('string');
      expect(result.searchData!.length).toBeGreaterThan(0);
    });

    it('searchData应该包含查询内容', async () => {
      const query = '如何配置网络搜索';
      const result = await strategy.execute({
        query
      });

      expect(result.searchData).toContain(query);
    });

    it('searchData应该包含MCP配置说明', async () => {
      const result = await strategy.execute({
        query: 'test'
      });

      expect(result.searchData).toContain('MCP');
      expect(result.searchData).toContain('mcp.json');
    });

    it('searchData应该包含直接API配置说明', async () => {
      const result = await strategy.execute({
        query: 'test'
      });

      expect(result.searchData).toContain('Tavily');
      expect(result.searchData).toContain('百度');
      expect(result.searchData).toContain('Bing');
    });

    it('searchData应该包含临时搜索链接', async () => {
      const query = '测试查询';
      const result = await strategy.execute({
        query
      });

      expect(result.searchData).toContain('google.com/search');
      expect(result.searchData).toContain('baidu.com/s');
      expect(result.searchData).toContain(encodeURIComponent(query));
    });

    it('应该有正确的metadata', async () => {
      const result = await strategy.execute({
        query: 'test'
      });

      expect(result.metadata.provider).toBe('guidance');
      expect(result.metadata.strategy).toBe('fallback');
      expect(result.metadata.timestamp).toBeDefined();
    });

    it('应该处理各种类型的查询', async () => {
      const queries = [
        '英文 query',
        '中文查询',
        'query with special chars !@#$%',
        'very long query '.repeat(10),
        ''  // Empty query
      ];

      for (const query of queries) {
        const result = await strategy.execute({ query });
        expect(result.success).toBe(true);
        expect(result.searchData).toBeDefined();
      }
    });
  });

  describe('getStatus', () => {
    it('应该返回可用状态', async () => {
      const status = await strategy.getStatus();

      expect(status.available).toBe(true);
      expect(status.requiresSetup).toBe(false);
      expect(status.message).toContain('设置指导');
    });
  });

  describe('Encoding', () => {
    it('应该正确编码包含特殊字符的查询', async () => {
      const query = '如何使用 C++ 编程？';
      const result = await strategy.execute({ query });

      // URL should be properly encoded
      expect(result.searchData).toContain(encodeURIComponent(query));
    });

    it('应该正确编码包含空格的查询', async () => {
      const query = 'test query with spaces';
      const result = await strategy.execute({ query });

      const encoded = encodeURIComponent(query);
      expect(result.searchData).toContain(encoded);
    });
  });

  describe('Content Quality', () => {
    it('指导文本应该是markdown格式', async () => {
      const result = await strategy.execute({
        query: 'test'
      });

      // Should contain markdown headers
      expect(result.searchData).toMatch(/^#[^#]/m);  // H1
      expect(result.searchData).toMatch(/^##[^#]/m);  // H2
    });

    it('指导文本应该包含代码块', async () => {
      const result = await strategy.execute({
        query: 'test'
      });

      expect(result.searchData).toContain('```');
    });

    it('指导文本应该包含链接', async () => {
      const result = await strategy.execute({
        query: 'test'
      });

      expect(result.searchData).toMatch(/\[.*\]\(.*\)/);  // Markdown link format
    });
  });

  describe('Never Fails', () => {
    it('即使参数缺失也应该成功', async () => {
      const result = await strategy.execute({
        query: ''
      });

      expect(result.success).toBe(true);
      expect(result.searchData).toBeDefined();
    });

    it('应该处理undefined参数', async () => {
      const result = await strategy.execute({
        query: 'test',
        maxResults: undefined,
        searchType: undefined
      });

      expect(result.success).toBe(true);
    });
  });
});
