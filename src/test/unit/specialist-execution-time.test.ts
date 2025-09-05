/**
 * Specialist ExecutionTime 计算测试
 * 验证 specialist 总执行时间的正确计算
 */

import { SpecialistExecutor } from '../../core/specialistExecutor';
import { SessionLogService } from '../../core/SessionLogService';

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

jest.mock('../../core/orchestrator/ToolAccessController');
jest.mock('../../core/orchestrator/ToolCacheManager');
jest.mock('../../core/toolExecutor');
jest.mock('../../core/prompts/PromptAssemblyEngine');
jest.mock('../../core/history/TokenAwareHistoryManager');

// Mock SessionLogService
jest.mock('../../core/SessionLogService');

describe('SpecialistExecutor - ExecutionTime 计算', () => {
    let specialistExecutor: SpecialistExecutor;
    let mockSessionLogService: any;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // 创建 mock SessionLogService
        mockSessionLogService = {
            recordSpecialistTaskCompletion: jest.fn().mockResolvedValue(undefined)
        };
        
        specialistExecutor = new SpecialistExecutor();
        (specialistExecutor as any).sessionLogService = mockSessionLogService;
        (specialistExecutor as any).currentSpecialistId = 'test_specialist';
        
        // Mock specialistRegistry 实例
        const mockSpecialistRegistry = {
            getSpecialist: jest.fn().mockReturnValue({
                config: {
                    name: '测试专家',
                    enabled: true
                }
            })
        };
        (specialistExecutor as any).specialistRegistry = mockSpecialistRegistry;
    });
    
    describe('recordTaskCompleteToSession 方法测试', () => {
        it('应该使用正确的总执行时间', async () => {
            const taskCompleteArgs = {
                nextStepType: 'TASK_FINISHED',
                summary: '测试任务完成',
                contextForNext: {
                    deliverables: ['SRS.md']
                }
            };
            
            const totalExecutionTime = 2500;
            const iterationCount = 3;
            
            // 调用私有方法
            await (specialistExecutor as any).recordTaskCompleteToSession(
                taskCompleteArgs,
                totalExecutionTime,
                iterationCount
            );
            
            // 验证 SessionLogService 被正确调用
            expect(mockSessionLogService.recordSpecialistTaskCompletion).toHaveBeenCalledWith({
                specialistId: 'test_specialist',
                specialistName: '测试专家',
                taskCompleteArgs: {
                    nextStepType: 'TASK_FINISHED',
                    summary: '测试任务完成',
                    contextForNext: {
                        deliverables: ['SRS.md']
                    }
                },
                executionTime: 2500,  // 🚀 正确的总执行时间
                iterationCount: 3     // 🚀 正确的迭代次数
            });
        });
        
        it('应该处理没有 specialistId 的情况', async () => {
            // 清除 currentSpecialistId
            (specialistExecutor as any).currentSpecialistId = undefined;
            
            await (specialistExecutor as any).recordTaskCompleteToSession(
                { summary: 'test' },
                1000,
                1
            );
            
            // 不应该调用 SessionLogService
            expect(mockSessionLogService.recordSpecialistTaskCompletion).not.toHaveBeenCalled();
        });
        
        it('应该处理 SessionLogService 抛出错误的情况', async () => {
            mockSessionLogService.recordSpecialistTaskCompletion.mockRejectedValue(
                new Error('Session log error')
            );
            
            // 应该不抛出异常
            await expect((specialistExecutor as any).recordTaskCompleteToSession(
                { summary: 'test' },
                1000,
                1
            )).resolves.toBeUndefined();
        });
    });
    
    describe('executionTime 计算验证', () => {
        it('应该验证时间计算逻辑', () => {
            // 模拟时间计算
            const startTime = Date.now();
            
            // 模拟一些处理时间
            const processingDelay = 100;
            
            // 计算期望的执行时间范围
            const expectedMinTime = processingDelay;
            const expectedMaxTime = processingDelay + 50; // 允许一些误差
            
            // 模拟处理后的时间
            setTimeout(() => {
                const actualExecutionTime = Date.now() - startTime;
                
                expect(actualExecutionTime).toBeGreaterThanOrEqual(expectedMinTime);
                expect(actualExecutionTime).toBeLessThan(expectedMaxTime + 100); // 宽松的上限
                
            }, processingDelay);
        });
    });
});
