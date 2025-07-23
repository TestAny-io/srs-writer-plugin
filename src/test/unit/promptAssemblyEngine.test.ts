/**
 * PromptAssemblyEngine SRS加载功能单元测试
 * 测试Content specialist的动态SRS加载功能
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PromptAssemblyEngine, SpecialistType, SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';

// Mock fs/promises module
jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

describe('PromptAssemblyEngine SRS加载功能测试', () => {
  let promptAssemblyEngine: PromptAssemblyEngine;
  
  beforeEach(() => {
    promptAssemblyEngine = new PromptAssemblyEngine('/test/rules');
    jest.clearAllMocks();
  });

  describe('loadProjectSRSContent', () => {
    test('应该成功加载SRS.md文件', async () => {
      const srsContent = '# 软件需求规格说明书\n这是SRS内容';
      (fs.readFile as jest.Mock).mockResolvedValue(srsContent);

      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: '/test/project'
        }
      };

      await (promptAssemblyEngine as any).loadProjectSRSContent(context);

      expect(fs.readFile).toHaveBeenCalledWith('/test/project/SRS.md', 'utf-8');
      expect(context.SRS_CONTENT).toBe(srsContent);
      expect(context.CURRENT_SRS).toBe(srsContent);
    });

    test('应该尝试多种SRS文件名', async () => {
      const srsContent = '# 软件需求规格说明书';
      
      // 前三次读取失败，第四次成功
      (fs.readFile as jest.Mock)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockRejectedValueOnce(new Error('File not found'))
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(srsContent);

      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: '/test/project'
        }
      };

      await (promptAssemblyEngine as any).loadProjectSRSContent(context);

      // 验证尝试了多个文件名
      expect(fs.readFile).toHaveBeenCalledTimes(4);
      expect(fs.readFile).toHaveBeenNthCalledWith(1, '/test/project/SRS.md', 'utf-8');
      expect(fs.readFile).toHaveBeenNthCalledWith(2, '/test/project/srs.md', 'utf-8');
      expect(fs.readFile).toHaveBeenNthCalledWith(3, '/test/project/Software_Requirements_Specification.md', 'utf-8');
      expect(fs.readFile).toHaveBeenNthCalledWith(4, '/test/project/requirements.md', 'utf-8');
      
      expect(context.SRS_CONTENT).toBe(srsContent);
    });

    test('没有baseDir时应该直接返回', async () => {
      const context: SpecialistContext = {
        projectMetadata: {}
      };

      await (promptAssemblyEngine as any).loadProjectSRSContent(context);

      expect(fs.readFile).not.toHaveBeenCalled();
      expect(context.SRS_CONTENT).toBeUndefined();
    });

    test('所有SRS文件都不存在时应该设置空字符串', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: '/test/project'
        }
      };

      await (promptAssemblyEngine as any).loadProjectSRSContent(context);

      expect(context.SRS_CONTENT).toBe('');
      expect(context.CURRENT_SRS).toBe('');
    });

    test('读取文件时发生错误应该设置空字符串', async () => {
      (fs.readFile as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: '/test/project'
        }
      };

      await (promptAssemblyEngine as any).loadProjectSRSContent(context);

      expect(context.SRS_CONTENT).toBe('');
      expect(context.CURRENT_SRS).toBe('');
    });
  });

  describe('assembleSpecialistPrompt集成测试', () => {
    test('Content specialist应该自动加载SRS内容', async () => {
      const srsContent = '# SRS内容';
      (fs.readFile as jest.Mock).mockResolvedValue(srsContent);

      // Mock loadSpecificTemplateWithConfig方法
      (promptAssemblyEngine as any).loadSpecificTemplateWithConfig = jest.fn().mockResolvedValue({
        content: 'specialist template content',
        config: {}
      });

      // Mock其他方法
      (promptAssemblyEngine as any).loadBaseTemplatesByConfig = jest.fn().mockResolvedValue([]);
      (promptAssemblyEngine as any).loadDomainTemplateByConfig = jest.fn().mockResolvedValue('');
      (promptAssemblyEngine as any).validateAssembledPrompt = jest.fn().mockResolvedValue(undefined);

      const specialistType: SpecialistType = {
        name: 'fr_writer',
        category: 'content'
      };

      const context: SpecialistContext = {
        userRequirements: 'test requirements',
        projectMetadata: {
          baseDir: '/test/project'
        }
      };

      const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      // 验证SRS内容被加载
      expect(fs.readFile).toHaveBeenCalledWith('/test/project/SRS.md', 'utf-8');
      expect(result).toContain('SRS内容');
    });

    test('Process specialist不应该加载SRS内容', async () => {
      // Mock方法
      (promptAssemblyEngine as any).loadSpecificTemplateWithConfig = jest.fn().mockResolvedValue({
        content: 'specialist template content',
        config: {}
      });
      (promptAssemblyEngine as any).loadBaseTemplatesByConfig = jest.fn().mockResolvedValue([]);
      (promptAssemblyEngine as any).loadDomainTemplateByConfig = jest.fn().mockResolvedValue('');
      (promptAssemblyEngine as any).validateAssembledPrompt = jest.fn().mockResolvedValue(undefined);

      const specialistType: SpecialistType = {
        name: 'git_operator',
        category: 'process'
      };

      const context: SpecialistContext = {
        userRequirements: 'test requirements',
        projectMetadata: {
          baseDir: '/test/project'
        }
      };

      await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      // 验证没有尝试读取SRS文件
      expect(fs.readFile).not.toHaveBeenCalled();
    });
  });
}); 