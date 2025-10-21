/**
 * API配置管理器单元测试
 *
 * 测试从VS Code配置中读取API密钥的功能
 */

import { APIConfigManager } from '../config/api-config';

// Mock VSCode API
const mockWorkspaceConfiguration = {
  get: jest.fn()
};

jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => mockWorkspaceConfiguration)
  }
}));

// Mock Logger
jest.mock('../../../../utils/logger', () => ({
  Logger: {
    getInstance: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    })
  }
}));

describe('APIConfigManager', () => {
  let configManager: APIConfigManager;

  beforeEach(() => {
    jest.clearAllMocks();
    configManager = APIConfigManager.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('应该返回相同的实例', () => {
      const instance1 = APIConfigManager.getInstance();
      const instance2 = APIConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getTavilyConfig', () => {
    it('应该返回有效的Tavily配置', () => {
      mockWorkspaceConfiguration.get.mockReturnValue('test-tavily-key-123');

      const config = configManager.getTavilyConfig();

      expect(config).toEqual({
        name: 'tavily',
        enabled: true,
        apiKey: 'test-tavily-key-123'
      });
    });

    it('当API密钥为空时应该返回null', () => {
      mockWorkspaceConfiguration.get.mockReturnValue('');

      const config = configManager.getTavilyConfig();

      expect(config).toBeNull();
    });

    it('当API密钥为空格时应该返回null', () => {
      mockWorkspaceConfiguration.get.mockReturnValue('   ');

      const config = configManager.getTavilyConfig();

      expect(config).toBeNull();
    });

    it('应该去除API密钥前后的空格', () => {
      mockWorkspaceConfiguration.get.mockReturnValue('  test-key-with-spaces  ');

      const config = configManager.getTavilyConfig();

      expect(config?.apiKey).toBe('test-key-with-spaces');
    });
  });

  describe('getBingConfig', () => {
    it('应该返回有效的Bing配置', () => {
      mockWorkspaceConfiguration.get.mockReturnValue('test-bing-key-456');

      const config = configManager.getBingConfig();

      expect(config).toEqual({
        name: 'bing',
        enabled: true,
        apiKey: 'test-bing-key-456'
      });
    });

    it('当API密钥未配置时应该返回null', () => {
      mockWorkspaceConfiguration.get.mockReturnValue(undefined);

      const config = configManager.getBingConfig();

      expect(config).toBeNull();
    });
  });

  describe('getBaiduConfig', () => {
    it('应该返回有效的Baidu配置', () => {
      mockWorkspaceConfiguration.get
        .mockReturnValueOnce('test-baidu-api-key')  // First call for apiKey
        .mockReturnValueOnce('test-baidu-secret');   // Second call for secretKey

      const config = configManager.getBaiduConfig();

      expect(config).toEqual({
        name: 'baidu',
        enabled: true,
        apiKey: 'test-baidu-api-key',
        secretKey: 'test-baidu-secret'
      });
    });

    it('当只有API Key没有Secret Key时应该返回null', () => {
      mockWorkspaceConfiguration.get
        .mockReturnValueOnce('test-baidu-api-key')
        .mockReturnValueOnce('');  // Empty secret key

      const config = configManager.getBaiduConfig();

      expect(config).toBeNull();
    });

    it('当只有Secret Key没有API Key时应该返回null', () => {
      mockWorkspaceConfiguration.get
        .mockReturnValueOnce('')  // Empty API key
        .mockReturnValueOnce('test-baidu-secret');

      const config = configManager.getBaiduConfig();

      expect(config).toBeNull();
    });

    it('应该去除两个密钥前后的空格', () => {
      mockWorkspaceConfiguration.get
        .mockReturnValueOnce('  api-key  ')
        .mockReturnValueOnce('  secret-key  ');

      const config = configManager.getBaiduConfig();

      expect(config?.apiKey).toBe('api-key');
      expect(config?.secretKey).toBe('secret-key');
    });
  });

  describe('getAllConfiguredProviders', () => {
    it('应该返回所有已配置的提供商', () => {
      mockWorkspaceConfiguration.get
        .mockReturnValueOnce('tavily-key')     // Tavily
        .mockReturnValueOnce('bing-key')       // Bing
        .mockReturnValueOnce('baidu-api-key')  // Baidu API Key
        .mockReturnValueOnce('baidu-secret');  // Baidu Secret Key

      const providers = configManager.getAllConfiguredProviders();

      expect(providers).toHaveLength(3);
      expect(providers[0].name).toBe('tavily');
      expect(providers[1].name).toBe('bing');
      expect(providers[2].name).toBe('baidu');
    });

    it('当没有配置任何提供商时应该返回空数组', () => {
      mockWorkspaceConfiguration.get.mockReturnValue('');

      const providers = configManager.getAllConfiguredProviders();

      expect(providers).toHaveLength(0);
    });

    it('应该只返回已配置的提供商', () => {
      mockWorkspaceConfiguration.get
        .mockReturnValueOnce('')            // Tavily not configured
        .mockReturnValueOnce('bing-key')    // Bing configured
        .mockReturnValueOnce('')            // Baidu not configured
        .mockReturnValueOnce('');

      const providers = configManager.getAllConfiguredProviders();

      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('bing');
    });
  });

  describe('hasAnyProvider', () => {
    it('当至少有一个提供商配置时应该返回true', () => {
      mockWorkspaceConfiguration.get
        .mockReturnValueOnce('tavily-key')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('');

      const hasProvider = configManager.hasAnyProvider();

      expect(hasProvider).toBe(true);
    });

    it('当没有任何提供商配置时应该返回false', () => {
      mockWorkspaceConfiguration.get.mockReturnValue('');

      const hasProvider = configManager.hasAnyProvider();

      expect(hasProvider).toBe(false);
    });
  });

  describe('getPreferredProvider', () => {
    it('应该返回第一个配置的提供商', () => {
      mockWorkspaceConfiguration.get
        .mockReturnValueOnce('')              // Tavily not configured
        .mockReturnValueOnce('bing-key')      // Bing configured (first)
        .mockReturnValueOnce('baidu-api')     // Baidu configured (second)
        .mockReturnValueOnce('baidu-secret');

      const preferred = configManager.getPreferredProvider();

      expect(preferred?.name).toBe('bing');
    });

    it('当没有配置任何提供商时应该返回null', () => {
      mockWorkspaceConfiguration.get.mockReturnValue('');

      const preferred = configManager.getPreferredProvider();

      expect(preferred).toBeNull();
    });
  });
});
