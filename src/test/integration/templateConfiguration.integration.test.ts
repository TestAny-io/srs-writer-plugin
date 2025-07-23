/**
 * Template配置功能集成测试
 * 验证从VSCode配置到specialist执行的完整流程
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SpecialistExecutor } from '../../core/specialistExecutor';
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
    joinPath: jest.fn().mockImplementation((base, ...segments) => ({
      fsPath: path.join(base.fsPath, ...segments)
    }))
  },
  extensions: {
    getExtension: jest.fn().mockReturnValue({
      extensionPath: '/test/extension'
    })
  }
}));

describe('Template配置功能集成测试', () => {
  let specialistExecutor: SpecialistExecutor;

  beforeEach(() => {
    specialistExecutor = new SpecialistExecutor();
    jest.clearAllMocks();
  });

  describe('完整流程测试', () => {
    test('fr_writer应该加载template文件和SRS内容', async () => {
      // 1. Mock VSCode配置
      const mockConfig = {
        get: jest.fn().mockReturnValue({
          'FR_TEMPLATE': 'templates/fr/fr-template.md',
          'REQUIREMENT_TEMPLATE': 'templates/fr/requirement.md'
        })
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      // 2. Mock template文件内容
      const frTemplateContent = `
# 功能需求模板
请使用以下格式编写功能需求：
- ID: {{REQUIREMENT_ID}}
- 描述: {{DESCRIPTION}}
- 验收标准: {{ACCEPTANCE_CRITERIA}}
      `.trim();

      const requirementTemplateContent = `
## 需求格式
每个需求应包含：
1. 唯一标识符
2. 详细描述
3. 验收标准
      `.trim();

      // 3. Mock SRS文件内容
      const srsContent = `
# 软件需求规格说明书

## 1. 引言
这是测试SRS文档。

## 2. 整体描述
系统整体描述...

## 3. 用例视图
### UC-001 用户登录
用户可以通过用户名和密码登录系统。
      `.trim();

      // 4. Mock文件读取
      (vscode.workspace.fs.readFile as jest.Mock)
        .mockImplementation((uri) => {
          const filePath = uri.fsPath;
          if (filePath.includes('fr-template.md')) {
            return Promise.resolve(new TextEncoder().encode(frTemplateContent));
          } else if (filePath.includes('requirement.md')) {
            return Promise.resolve(new TextEncoder().encode(requirementTemplateContent));
          }
          return Promise.reject(new Error('File not found'));
        });

             // Mock fs.readFile for SRS content (PromptAssemblyEngine uses fs/promises)
       const fs = require('fs/promises');
       jest.spyOn(fs, 'readFile').mockImplementation((filePath: any) => {
         if (typeof filePath === 'string' && filePath.includes('SRS.md')) {
           return Promise.resolve(srsContent);
         }
         return Promise.reject(new Error('File not found'));
       });

      // 5. 执行specialist
      const context = {
        userInput: '生成用户登录的功能需求',
        sessionData: {
          projectName: 'TestProject',
          baseDir: '/test/project'
        },
        currentStep: {
          language: 'zh-CN',
          description: '编写功能需求'
        }
      };

      const prompt = await (specialistExecutor as any).loadSpecialistPrompt('fr_writer', context, []);

      // 6. 验证结果
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('srs-writer.templates');
      expect(mockConfig.get).toHaveBeenCalledWith('frWriter', {});
      
      // 验证template文件被读取
      expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fsPath: expect.stringContaining('fr-template.md')
        })
      );
      
      // 验证SRS文件被读取
      expect(fs.readFile).toHaveBeenCalledWith('/test/project/SRS.md', 'utf-8');
      
      // 验证prompt包含template和SRS内容
      expect(prompt).toContain('功能需求模板');
      expect(prompt).toContain('需求格式');
      expect(prompt).toContain('软件需求规格说明书');
      expect(prompt).toContain('UC-001 用户登录');
    });

    test('nfr_writer应该加载对应的template文件和SRS内容', async () => {
      // Mock NFR writer配置
      const mockConfig = {
        get: jest.fn().mockReturnValue({
          'NFR_TEMPLATE': 'templates/nfr/nfr-template.md',
          'PERFORMANCE_TEMPLATE': 'templates/nfr/performance.md'
        })
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const nfrTemplateContent = '# 非功能需求模板';
      const performanceTemplateContent = '# 性能需求模板';
      const srsContent = '# SRS文档内容';

      // Mock文件读取
      (vscode.workspace.fs.readFile as jest.Mock)
        .mockImplementation((uri) => {
          const filePath = uri.fsPath;
          if (filePath.includes('nfr-template.md')) {
            return Promise.resolve(new TextEncoder().encode(nfrTemplateContent));
          } else if (filePath.includes('performance.md')) {
            return Promise.resolve(new TextEncoder().encode(performanceTemplateContent));
          }
          return Promise.reject(new Error('File not found'));
        });

      const fs = require('fs/promises');
      jest.spyOn(fs, 'readFile').mockResolvedValue(srsContent);

      const context = {
        userInput: '生成性能需求',
        sessionData: {
          projectName: 'TestProject',
          baseDir: '/test/project'
        },
        currentStep: {
          language: 'zh-CN'
        }
      };

      const prompt = await (specialistExecutor as any).loadSpecialistPrompt('nfr_writer', context, []);

      expect(mockConfig.get).toHaveBeenCalledWith('nfrWriter', {});
      expect(prompt).toContain('非功能需求模板');
      expect(prompt).toContain('性能需求模板');
      expect(prompt).toContain('SRS文档内容');
    });

    test('process specialist不应该加载SRS内容', async () => {
      // Mock process specialist（没有配置template）
      const mockConfig = {
        get: jest.fn().mockReturnValue({})
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const fs = require('fs/promises');
      const readFileSpy = jest.spyOn(fs, 'readFile');

      const context = {
        userInput: '执行git操作',
        sessionData: {
          projectName: 'TestProject',
          baseDir: '/test/project'
        },
        currentStep: {
          language: 'zh-CN'
        }
      };

      await (specialistExecutor as any).loadSpecialistPrompt('git_operator', context, []);

      // process specialist不应该尝试读取SRS文件
      expect(readFileSpy).not.toHaveBeenCalled();
    });
  });

  describe('错误处理测试', () => {
    test('template文件不存在时应该优雅降级', async () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue({
          'FR_TEMPLATE': 'templates/nonexistent.md'
        })
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      // Mock文件读取失败
      (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      const context = {
        userInput: '生成功能需求',
        sessionData: {
          projectName: 'TestProject',
          baseDir: '/test/project'
        },
        currentStep: {
          language: 'zh-CN'
        }
      };

      // 应该不会抛出错误
      const prompt = await (specialistExecutor as any).loadSpecialistPrompt('fr_writer', context, []);
      
      expect(prompt).toBeTruthy();
    });

    test('SRS文件不存在时应该优雅降级', async () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue({})
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const fs = require('fs/promises');
      jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('SRS file not found'));

      const context = {
        userInput: '生成功能需求',
        sessionData: {
          projectName: 'TestProject',
          baseDir: '/test/project'
        },
        currentStep: {
          language: 'zh-CN'
        }
      };

      // 应该不会抛出错误
      const prompt = await (specialistExecutor as any).loadSpecialistPrompt('fr_writer', context, []);
      
      expect(prompt).toBeTruthy();
    });

    test('没有工作区时应该正常工作', async () => {
      // Mock没有工作区
      (vscode.workspace as any).workspaceFolders = undefined;

      const context = {
        userInput: '生成功能需求',
        sessionData: {
          projectName: 'TestProject',
          baseDir: '/test/project'
        },
        currentStep: {
          language: 'zh-CN'
        }
      };

      // 应该不会抛出错误
      const prompt = await (specialistExecutor as any).loadSpecialistPrompt('fr_writer', context, []);
      
      expect(prompt).toBeTruthy();
    });
  });
}); 