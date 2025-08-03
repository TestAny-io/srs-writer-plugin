/**
 * 模板加载集成测试
 * 验证方案3实现后，specialist执行时能否正确加载模板内容
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SpecialistExecutor } from '../../core/specialistExecutor';

// Mock VSCode
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: {
                fsPath: '/mock/workspace'
            }
        }],
        getConfiguration: jest.fn(),
        fs: {
            readFile: jest.fn()
        }
    },
    Uri: {
        joinPath: jest.fn()
    }
}));

describe('模板加载集成测试 (方案3)', () => {
    let specialistExecutor: SpecialistExecutor;
    const mockWorkspaceFolder = {
        uri: { fsPath: '/mock/workspace' }
    };

    beforeEach(() => {
        // 重置所有mock
        jest.clearAllMocks();
        
        // Mock VSCode workspace
        (vscode.workspace as any).workspaceFolders = [mockWorkspaceFolder];
        
        // Mock Uri.joinPath
        (vscode.Uri.joinPath as jest.Mock).mockImplementation((baseUri, ...pathSegments) => ({
            fsPath: path.join(baseUri.fsPath, ...pathSegments)
        }));
        
        specialistExecutor = new SpecialistExecutor();
    });

    describe('VSCode配置读取测试', () => {
        
        it('应该能正确读取adc_writer的模板配置', async () => {
            // Mock VSCode配置
            const mockConfig = {
                get: jest.fn().mockReturnValue({
                    ADC_WRITER_TEMPLATE: '.templates/ADC/ADC_template.md'
                })
            };
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
            
            // Mock文件读取
            const mockTemplateContent = '# ADC Template\\n\\nThis is the ADC template.';
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
                new TextEncoder().encode(mockTemplateContent)
            );
            
            // 调用loadTemplateFiles方法（需要访问私有方法）
            const templateFiles = await (specialistExecutor as any).loadTemplateFiles('adc_writer');
            
            // 验证结果
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('srs-writer.templates');
            expect(mockConfig.get).toHaveBeenCalledWith('adcWriter', {});
            expect(templateFiles).toEqual({
                ADC_WRITER_TEMPLATE: mockTemplateContent
            });
        });

        it('应该能正确读取user_journey_writer的模板配置', async () => {
            // Mock VSCode配置
            const mockConfig = {
                get: jest.fn().mockReturnValue({
                    USER_JOURNEY_WRITER_TEMPLATE: '.templates/user_journey/user_journey_template.md'
                })
            };
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
            
            // Mock文件读取
            const mockTemplateContent = '# User Journey Template\\n\\nThis is the user journey template.';
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
                new TextEncoder().encode(mockTemplateContent)
            );
            
            const templateFiles = await (specialistExecutor as any).loadTemplateFiles('user_journey_writer');
            
            expect(templateFiles).toEqual({
                USER_JOURNEY_WRITER_TEMPLATE: mockTemplateContent
            });
        });
    });

    describe('错误处理测试', () => {
        
        it('当模板文件不存在时应该返回空内容', async () => {
            // Mock VSCode配置
            const mockConfig = {
                get: jest.fn().mockReturnValue({
                    TEST_TEMPLATE: '.templates/non-existent/template.md'
                })
            };
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
            
            // Mock文件读取失败
            (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(
                new Error('File not found')
            );
            
            const templateFiles = await (specialistExecutor as any).loadTemplateFiles('test_writer');
            
            // 应该返回空内容而不是抛出错误
            expect(templateFiles).toEqual({
                TEST_TEMPLATE: ''
            });
        });

        it('当specialist不支持模板配置时应该返回空对象', async () => {
            const templateFiles = await (specialistExecutor as any).loadTemplateFiles('unsupported_specialist');
            
            expect(templateFiles).toEqual({});
        });
    });

    describe('context集成测试', () => {
        
        it('应该将模板内容正确添加到specialist context中', async () => {
            // Mock VSCode配置
            const mockConfig = {
                get: jest.fn().mockReturnValue({
                    ADC_WRITER_TEMPLATE: '.templates/ADC/ADC_template.md'
                })
            };
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
            
            // Mock文件读取
            const mockTemplateContent = '# ADC Template Content\\n\\nDetailed template...';
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
                new TextEncoder().encode(mockTemplateContent)
            );
            
            // Mock其他必要的方法
            (specialistExecutor as any).toolCacheManager = {
                getTools: jest.fn().mockResolvedValue({
                    definitions: [],
                    jsonSchema: '{}'
                })
            };
            
            // 创建模拟的execution context
            const mockContext = {
                currentStep: { description: 'Test task' },
                sessionData: { projectName: 'Test Project', baseDir: '/test' }
            };
            
            // 调用buildSpecialistContext方法
            const specialistContext = await (specialistExecutor as any).buildSpecialistContext(
                'adc_writer', mockContext, []
            );
            
            // 验证模板内容被正确添加到context中
            expect(specialistContext.ADC_WRITER_TEMPLATE).toBe(mockTemplateContent);
        });
    });

    describe('PromptAssemblyEngine集成验证', () => {
        
        it('模拟验证context中的模板变量能被PromptAssemblyEngine正确使用', () => {
            // 模拟context with template variables
            const mockContext: Record<string, string> = {
                ADC_WRITER_TEMPLATE: '# ADC Template\\n\\nThis is the content.',
                USER_JOURNEY_WRITER_TEMPLATE: '# User Journey Template\\n\\nJourney content.',
                FR_WRITER_TEMPLATE: '# FR Template\\n\\nFunctional requirements.'
            };
            
            // 模拟PromptAssemblyEngine的逻辑
            const templateVariables = Object.keys(mockContext)
                .filter(key => key.endsWith('_TEMPLATE'))
                .map(key => mockContext[key] || 'Chapter template not available')
                .join('\\n\\n');
            
            // 验证不再出现"Chapter template not available"
            expect(templateVariables).not.toContain('Chapter template not available');
            expect(templateVariables).toContain('ADC Template');
            expect(templateVariables).toContain('User Journey Template');
            expect(templateVariables).toContain('FR Template');
        });
        
        it('当模板变量为空时应该显示默认消息', () => {
            const mockContext: Record<string, string> = {
                ADC_WRITER_TEMPLATE: '',
                USER_JOURNEY_WRITER_TEMPLATE: 'Valid content'
            };
            
            const templateVariables = Object.keys(mockContext)
                .filter(key => key.endsWith('_TEMPLATE'))
                .map(key => mockContext[key] || 'Chapter template not available')
                .join('\\n\\n');
            
            expect(templateVariables).toContain('Chapter template not available');
            expect(templateVariables).toContain('Valid content');
        });
    });
});