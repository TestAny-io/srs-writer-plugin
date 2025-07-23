/**
 * Template配置功能单元测试
 * 测试SpecialistExecutor的template文件加载功能
 */

import * as vscode from 'vscode';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { ToolAccessController } from '../../core/orchestrator/ToolAccessController';
import { ToolCacheManager } from '../../core/orchestrator/ToolCacheManager';
import { PromptAssemblyEngine } from '../../core/prompts/PromptAssemblyEngine';

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [
      {
        uri: {
          fsPath: '/test/workspace'
        }
      }
    ],
    getConfiguration: jest.fn(),
    fs: {
      readFile: jest.fn()
    }
  },
  Uri: {
    joinPath: jest.fn().mockReturnValue({ fsPath: '/test/path' })
  },
  window: {
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn(),
      show: jest.fn()
    })
  },
  extensions: {
    getExtension: jest.fn().mockReturnValue({
      extensionPath: '/test/extension'
    })
  }
}));

describe('Template配置功能测试', () => {
  let specialistExecutor: SpecialistExecutor;
  let mockToolAccessController: jest.Mocked<ToolAccessController>;
  let mockToolCacheManager: jest.Mocked<ToolCacheManager>;
  let mockPromptAssemblyEngine: jest.Mocked<PromptAssemblyEngine>;

  beforeEach(() => {
    // Mock dependencies
    mockToolAccessController = {
      getAvailableTools: jest.fn().mockResolvedValue([])
    } as any;

    mockToolCacheManager = {
      getTools: jest.fn().mockResolvedValue({
        definitions: [],
        jsonSchema: ''
      })
    } as any;

    mockPromptAssemblyEngine = {
      assembleSpecialistPrompt: jest.fn().mockResolvedValue('test prompt')
    } as any;

    specialistExecutor = new SpecialistExecutor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTemplateFileMap', () => {
    test('应该正确读取fr_writer的配置', () => {
      // Mock VSCode配置
      const mockConfig = {
        get: jest.fn().mockReturnValue({
          'FR_TEMPLATE': 'templates/fr/my-fr-template.md',
          'REQUIREMENT_TEMPLATE': 'templates/fr/requirement-format.md'
        })
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      // 调用私有方法需要使用类型断言
      const result = (specialistExecutor as any).getTemplateFileMap('fr_writer');

      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('srs-writer.templates');
      expect(mockConfig.get).toHaveBeenCalledWith('frWriter', {});
      expect(result).toEqual({
        'FR_TEMPLATE': 'templates/fr/my-fr-template.md',
        'REQUIREMENT_TEMPLATE': 'templates/fr/requirement-format.md'
      });
    });

    test('应该正确读取nfr_writer的配置', () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue({
          'NFR_TEMPLATE': 'templates/nfr/nfr-template.md',
          'PERFORMANCE_TEMPLATE': 'templates/nfr/performance.md'
        })
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const result = (specialistExecutor as any).getTemplateFileMap('nfr_writer');

      expect(mockConfig.get).toHaveBeenCalledWith('nfrWriter', {});
      expect(result).toEqual({
        'NFR_TEMPLATE': 'templates/nfr/nfr-template.md',
        'PERFORMANCE_TEMPLATE': 'templates/nfr/performance.md'
      });
    });

    test('对于未知的specialist应该返回空对象', () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue({})
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const result = (specialistExecutor as any).getTemplateFileMap('unknown_specialist');

      expect(result).toEqual({});
    });

    test('配置读取失败时应该返回空对象', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => {
        throw new Error('Config error');
      });

      const result = (specialistExecutor as any).getTemplateFileMap('fr_writer');

      expect(result).toEqual({});
    });
  });

  describe('loadTemplateFiles', () => {
    test('应该成功加载模板文件', async () => {
      // Mock配置
      const mockConfig = {
        get: jest.fn().mockReturnValue({
          'FR_TEMPLATE': 'templates/fr-template.md',
          'REQUIREMENT_TEMPLATE': 'templates/requirement.md'
        })
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      // Mock文件读取
      const mockFileContent = new TextEncoder().encode('Template Content');
      (vscode.workspace.fs.readFile as jest.Mock)
        .mockResolvedValueOnce(mockFileContent)
        .mockResolvedValueOnce(new TextEncoder().encode('Requirement Content'));

      const result = await (specialistExecutor as any).loadTemplateFiles('fr_writer');

      expect(result).toEqual({
        'FR_TEMPLATE': 'Template Content',
        'REQUIREMENT_TEMPLATE': 'Requirement Content'
      });
    });

    test('文件不存在时应该使用空字符串', async () => {
      // Mock配置
      const mockConfig = {
        get: jest.fn().mockReturnValue({
          'FR_TEMPLATE': 'templates/nonexistent.md'
        })
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      // Mock文件读取失败
      (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await (specialistExecutor as any).loadTemplateFiles('fr_writer');

      expect(result).toEqual({
        'FR_TEMPLATE': ''
      });
    });

    test('没有工作区时应该返回空对象', async () => {
      // Mock没有工作区
      (vscode.workspace as any).workspaceFolders = undefined;

      const result = await (specialistExecutor as any).loadTemplateFiles('fr_writer');

      expect(result).toEqual({});
    });
  });

  describe('集成测试', () => {
    test('loadSpecialistPrompt应该包含template内容', async () => {
      // Mock配置
      const mockConfig = {
        get: jest.fn().mockReturnValue({
          'FR_TEMPLATE': 'templates/fr-template.md'
        })
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      // Mock文件读取
      const templateContent = '这是FR模板内容';
      (vscode.workspace.fs.readFile as jest.Mock)
        .mockResolvedValue(new TextEncoder().encode(templateContent));

      // Mock context
      const context = {
        userInput: 'test input',
        sessionData: {
          projectName: 'TestProject',
          baseDir: '/test/project'
        },
        currentStep: {
          language: 'zh-CN'
        }
      };

      await (specialistExecutor as any).loadSpecialistPrompt('fr_writer', context, []);

      // 验证PromptAssemblyEngine被调用，且context包含template内容
      expect(mockPromptAssemblyEngine.assembleSpecialistPrompt).toHaveBeenCalledWith(
        { name: 'fr_writer', category: 'content' },
        expect.objectContaining({
          FR_TEMPLATE: templateContent
        })
      );
    });
  });
}); 