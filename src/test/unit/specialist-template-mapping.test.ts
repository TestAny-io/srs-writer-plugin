/**
 * Specialist模版映射系统测试
 * 
 * 测试范围：
 * 1. SpecialistExecutor.getTemplateFileMap方法
 * 2. 动态映射文件的功能
 * 3. VSCode配置读取
 * 4. 错误处理和边缘情况
 */

import * as vscode from 'vscode';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { 
  SPECIALIST_TEMPLATE_MAPPINGS, 
  isTemplateConfigSupported, 
  getTemplateConfigKey,
  getSupportedTemplateSpecialists
} from '../../core/generated/specialist-template-mappings';

// Mock vscode
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(),
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
    fs: {
      readFile: jest.fn()
    },
    Uri: {
      joinPath: jest.fn()
    }
  }
}));

// Mock TextDecoder globally
global.TextDecoder = jest.fn().mockImplementation(() => ({
  decode: jest.fn().mockReturnValue('mock content')
})) as any;

// Mock其他依赖
jest.mock('../../core/specialistRegistry', () => ({
  getSpecialistRegistry: jest.fn().mockReturnValue({
    scanAndRegister: jest.fn().mockResolvedValue({ validSpecialists: [] })
  })
}));

jest.mock('../../core/prompts/PromptAssemblyEngine', () => ({
  PromptAssemblyEngine: jest.fn()
}));

jest.mock('../../core/orchestrator/ToolAccessController', () => ({
  ToolAccessController: jest.fn()
}));

jest.mock('../../core/orchestrator/ToolCacheManager', () => ({
  ToolCacheManager: jest.fn()
}));

jest.mock('../../core/toolExecutor', () => ({
  ToolExecutor: jest.fn()
}));

jest.mock('../../core/config/SpecialistIterationManager', () => ({
  SpecialistIterationManager: jest.fn()
}));

describe('Specialist模版映射系统', () => {
  let specialistExecutor: SpecialistExecutor;
  let mockGetConfiguration: jest.MockedFunction<typeof vscode.workspace.getConfiguration>;

  beforeEach(() => {
    mockGetConfiguration = vscode.workspace.getConfiguration as jest.MockedFunction<typeof vscode.workspace.getConfiguration>;
    specialistExecutor = new SpecialistExecutor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('动态映射文件功能', () => {
    it('应该正确识别支持的specialist', () => {
      // 测试基于实际生成的映射
      Object.keys(SPECIALIST_TEMPLATE_MAPPINGS).forEach(specialistId => {
        expect(isTemplateConfigSupported(specialistId)).toBe(true);
      });
    });

    it('应该正确识别不支持的specialist', () => {
      expect(isTemplateConfigSupported('non_existent_specialist')).toBe(false);
      expect(isTemplateConfigSupported('process_specialist')).toBe(false);
    });

    it('应该返回正确的配置键名', () => {
      Object.entries(SPECIALIST_TEMPLATE_MAPPINGS).forEach(([specialistId, expectedKey]) => {
        expect(getTemplateConfigKey(specialistId)).toBe(expectedKey);
      });
    });

    it('应该返回所有支持的specialist列表', () => {
      const supportedList = getSupportedTemplateSpecialists();
      expect(supportedList).toEqual(Object.keys(SPECIALIST_TEMPLATE_MAPPINGS));
    });
  });

  describe('getTemplateFileMap方法', () => {
    it('应该为支持的content specialist返回模版配置', () => {
      // Arrange
      const supportedSpecialist = Object.keys(SPECIALIST_TEMPLATE_MAPPINGS)[0];
      const configKey = SPECIALIST_TEMPLATE_MAPPINGS[supportedSpecialist];
      const mockTemplateConfig = {
        TEST_TEMPLATE: 'templates/test/test-template.md'
      };

      const mockConfig = {
        get: jest.fn().mockReturnValue(mockTemplateConfig)
      };
      mockGetConfiguration.mockReturnValue(mockConfig as any);

      // Act
      const result = (specialistExecutor as any).getTemplateFileMap(supportedSpecialist);

      // Assert
      expect(mockGetConfiguration).toHaveBeenCalledWith('srs-writer.templates');
      expect(mockConfig.get).toHaveBeenCalledWith(configKey, {});
      expect(result).toEqual(mockTemplateConfig);
    });

    it('应该为不支持的specialist返回空对象', () => {
      // Act
      const result = (specialistExecutor as any).getTemplateFileMap('unsupported_specialist');

      // Assert
      expect(result).toEqual({});
      expect(mockGetConfiguration).not.toHaveBeenCalled();
    });

    it('应该处理VSCode配置读取错误', () => {
      // Arrange
      const supportedSpecialist = Object.keys(SPECIALIST_TEMPLATE_MAPPINGS)[0];
      mockGetConfiguration.mockImplementation(() => {
        throw new Error('Configuration read error');
      });

      // Act
      const result = (specialistExecutor as any).getTemplateFileMap(supportedSpecialist);

      // Assert
      expect(result).toEqual({});
    });

    it('应该处理缺失的配置键', () => {
      // Mock一个在映射中不存在配置键的情况
      const originalMappings = { ...SPECIALIST_TEMPLATE_MAPPINGS };
      
      // 临时修改映射以测试边缘情况
      jest.doMock('../../core/generated/specialist-template-mappings', () => ({
        ...jest.requireActual('../../core/generated/specialist-template-mappings'),
        getTemplateConfigKey: jest.fn().mockReturnValue(undefined)
      }));

      // Act
      const result = (specialistExecutor as any).getTemplateFileMap('test_specialist');

      // Assert
      expect(result).toEqual({});
    });

    it('应该记录正确的日志信息', () => {
      // Arrange
      const loggerSpy = jest.spyOn((specialistExecutor as any).logger, 'info');
      const supportedSpecialist = Object.keys(SPECIALIST_TEMPLATE_MAPPINGS)[0];
      const configKey = SPECIALIST_TEMPLATE_MAPPINGS[supportedSpecialist];
      const mockTemplateConfig = { TEST_TEMPLATE: 'test-path.md' };

      const mockConfig = {
        get: jest.fn().mockReturnValue(mockTemplateConfig)
      };
      mockGetConfiguration.mockReturnValue(mockConfig as any);

      // Act
      (specialistExecutor as any).getTemplateFileMap(supportedSpecialist);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(`加载${supportedSpecialist}的模板配置`)
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(`key: ${configKey}`)
      );
    });
  });

  describe('loadTemplateFiles集成测试', () => {
    beforeEach(() => {
      // Mock TextDecoder
      (global.TextDecoder as jest.Mock).mockImplementation(() => ({
        decode: jest.fn().mockReturnValue('template content')
      }));

      // Mock Uri.joinPath
      (vscode.Uri.joinPath as jest.Mock).mockReturnValue({ fsPath: '/mock/path' });

      // Mock workspace.fs.readFile
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(new Uint8Array());
    });

    it('应该为支持的specialist加载模版文件', async () => {
      // Arrange
      const supportedSpecialist = Object.keys(SPECIALIST_TEMPLATE_MAPPINGS)[0];
      const mockTemplateConfig = {
        TEST_TEMPLATE: 'templates/test/test-template.md',
        ANOTHER_TEMPLATE: 'templates/test/another-template.md'
      };

      const mockConfig = {
        get: jest.fn().mockReturnValue(mockTemplateConfig)
      };
      mockGetConfiguration.mockReturnValue(mockConfig as any);

      // Act
      const result = await (specialistExecutor as any).loadTemplateFiles(supportedSpecialist);

      // Assert
      expect(result).toHaveProperty('TEST_TEMPLATE');
      expect(result).toHaveProperty('ANOTHER_TEMPLATE');
      expect(result.TEST_TEMPLATE).toBe('template content');
      expect(result.ANOTHER_TEMPLATE).toBe('template content');
    });

    it('应该为不支持的specialist返回空对象', async () => {
      // Act
      const result = await (specialistExecutor as any).loadTemplateFiles('unsupported_specialist');

      // Assert
      expect(result).toEqual({});
    });

    it('应该处理模版文件读取失败', async () => {
      // Arrange
      const supportedSpecialist = Object.keys(SPECIALIST_TEMPLATE_MAPPINGS)[0];
      const mockTemplateConfig = {
        TEST_TEMPLATE: 'templates/test/test-template.md'
      };

      const mockConfig = {
        get: jest.fn().mockReturnValue(mockTemplateConfig)
      };
      mockGetConfiguration.mockReturnValue(mockConfig as any);

      // Mock文件读取失败
      (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      // Act
      const result = await (specialistExecutor as any).loadTemplateFiles(supportedSpecialist);

      // Assert
      expect(result).toHaveProperty('TEST_TEMPLATE');
      expect(result.TEST_TEMPLATE).toBe(''); // 失败时应该返回空字符串
    });
  });

  describe('实际specialist支持检查', () => {
    // 基于当前生成的映射文件测试实际的specialist
    const expectedContentSpecialists = [
      'adc_writer',
      'fr_writer', 
      'nfr_writer',
      'overall_description_writer',
      'prototype_designer',
      'story_and_case_writer',
      'summary_writer',
      'user_journey_writer'
    ];

    expectedContentSpecialists.forEach(specialistId => {
      it(`应该支持 ${specialistId}`, () => {
        expect(isTemplateConfigSupported(specialistId)).toBe(true);
        expect(getTemplateConfigKey(specialistId)).toBeDefined();
      });
    });

    // 测试process specialist不被支持
    const processSpecialists = [
      'project_initializer',
      'requirement_syncer',
      'document_formatter',
      'git_operator'
    ];

    processSpecialists.forEach(specialistId => {
      it(`不应该支持process specialist: ${specialistId}`, () => {
        expect(isTemplateConfigSupported(specialistId)).toBe(false);
      });
    });
  });
});