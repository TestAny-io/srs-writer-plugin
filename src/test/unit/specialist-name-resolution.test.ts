/**
 * Specialist Name 解析测试
 * 验证从 SpecialistRegistry 获取 specialist 显示名称的功能
 */

import { SpecialistExecutor } from '../../core/specialistExecutor';

// Mock dependencies
jest.mock('vscode', () => ({
    extensions: {
        getExtension: jest.fn(() => ({
            extensionPath: '/test/extension/path'
        }))
    },
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }]
    }
}));

jest.mock('../../utils/logger', () => ({
    Logger: {
        getInstance: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            error: jest.fn()
        }))
    }
}));

// Mock other dependencies
jest.mock('../../core/orchestrator/ToolAccessController');
jest.mock('../../core/orchestrator/ToolCacheManager');
jest.mock('../../core/toolExecutor');
jest.mock('../../core/prompts/PromptAssemblyEngine');
jest.mock('../../core/history/TokenAwareHistoryManager');
jest.mock('../../core/SessionLogService');

describe('SpecialistExecutor - Specialist Name Resolution', () => {
    let specialistExecutor: SpecialistExecutor;
    let mockSpecialistRegistry: any;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // 创建 mock specialist registry
        mockSpecialistRegistry = {
            getSpecialist: jest.fn()
        };
        
        // Mock getSpecialistRegistry
        jest.doMock('../../core/specialistRegistry', () => ({
            getSpecialistRegistry: () => mockSpecialistRegistry
        }));
        
        specialistExecutor = new SpecialistExecutor();
        (specialistExecutor as any).specialistRegistry = mockSpecialistRegistry;
    });
    
    describe('getSpecialistName 私有方法测试', () => {
        it('应该从 SpecialistRegistry 获取正确的显示名称', () => {
            // 设置 mock 返回值
            mockSpecialistRegistry.getSpecialist.mockReturnValue({
                config: {
                    name: '总体描述专家',
                    enabled: true,
                    id: 'overall_description_writer',
                    category: 'content'
                }
            });
            
            // 通过反射调用私有方法
            const getSpecialistName = (specialistExecutor as any).getSpecialistName.bind(specialistExecutor);
            const result = getSpecialistName('overall_description_writer');
            
            expect(result).toBe('总体描述专家');
            expect(mockSpecialistRegistry.getSpecialist).toHaveBeenCalledWith('overall_description_writer');
        });
        
        it('应该处理 specialist 不存在的情况', () => {
            // 设置 mock 返回 undefined
            mockSpecialistRegistry.getSpecialist.mockReturnValue(undefined);
            
            const getSpecialistName = (specialistExecutor as any).getSpecialistName.bind(specialistExecutor);
            const result = getSpecialistName('unknown_specialist');
            
            // 应该返回 ID 作为 fallback
            expect(result).toBe('unknown_specialist');
        });
        
        it('应该处理 config.name 不存在的情况', () => {
            // 设置 mock 返回没有 name 字段的配置
            mockSpecialistRegistry.getSpecialist.mockReturnValue({
                config: {
                    enabled: true,
                    id: 'test_specialist',
                    category: 'content'
                    // name 字段缺失
                }
            });
            
            const getSpecialistName = (specialistExecutor as any).getSpecialistName.bind(specialistExecutor);
            const result = getSpecialistName('test_specialist');
            
            // 应该返回 ID 作为 fallback
            expect(result).toBe('test_specialist');
        });
        
        it('应该处理 SpecialistRegistry 抛出异常的情况', () => {
            // 设置 mock 抛出异常
            mockSpecialistRegistry.getSpecialist.mockImplementation(() => {
                throw new Error('Registry error');
            });
            
            const getSpecialistName = (specialistExecutor as any).getSpecialistName.bind(specialistExecutor);
            const result = getSpecialistName('test_specialist');
            
            // 应该返回 ID 作为 fallback
            expect(result).toBe('test_specialist');
        });
        
        it('应该处理常见的 specialist ID 映射', () => {
            const testCases = [
                { id: 'project_initializer', name: '项目初始化专家' },
                { id: 'overall_description_writer', name: '总体描述专家' },
                { id: 'fr_writer', name: '功能需求专家' },
                { id: 'content_writer', name: '内容编写专家' }
            ];
            
            testCases.forEach(({ id, name }) => {
                mockSpecialistRegistry.getSpecialist.mockReturnValue({
                    config: { name, enabled: true, id, category: 'content' }
                });
                
                const getSpecialistName = (specialistExecutor as any).getSpecialistName.bind(specialistExecutor);
                const result = getSpecialistName(id);
                
                expect(result).toBe(name);
            });
        });
    });
});
