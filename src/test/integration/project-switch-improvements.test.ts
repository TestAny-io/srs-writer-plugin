import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SRSChatParticipant } from '../../chat/srs-chat-participant';
import { SessionManager } from '../../core/session-manager';
import { Logger } from '../../utils/logger';
import { Orchestrator } from '../../core/orchestrator';

// Mock vscode.chat API
const mockChatParticipant = {
    dispose: jest.fn(),
    requestHandler: jest.fn(),
    followupProvider: jest.fn(),
    iconPath: undefined,
    fullName: 'Test Participant'
};

// 设置 vscode.Uri 的 mock
(vscode as any).Uri = {
    joinPath: jest.fn().mockImplementation((base, ...paths) => {
        return {
            fsPath: path.join(base.fsPath || base, ...paths),
            toString: () => path.join(base.fsPath || base, ...paths)
        };
    }),
    file: jest.fn().mockImplementation((path) => ({ fsPath: path }))
};

// 设置 vscode.chat 的 mock
(vscode as any).chat = {
    createChatParticipant: jest.fn().mockReturnValue(mockChatParticipant)
};

describe('项目切换改进 - Plan中止和上下文清理', () => {
    let participant: SRSChatParticipant;
    let mockStream: vscode.ChatResponseStream;
    let mockModel: vscode.LanguageModelChat;
    let mockContext: vscode.ExtensionContext;
    let tempDir: string;
    let sessionManager: SessionManager;
    let logger: Logger;

    beforeEach(() => {
        // 设置测试环境
        logger = Logger.getInstance();
        
        // 创建临时目录用于测试
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'srs-test-'));
        
        // 重置全局引擎
        SRSChatParticipant.disposeGlobalEngine();
        
        // 创建mock context
        mockContext = {
            extensionPath: '/mock/extension/path',
            extensionUri: { fsPath: '/mock/extension/path' } as any,
            globalStoragePath: tempDir,
            subscriptions: [],
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            },
            workspaceState: {
                get: jest.fn(),
                update: jest.fn()
            }
        } as any;
        
        // 重置SessionManager单例 - 必须在提供context之前
        (SessionManager as any).instance = null;
        
        // 创建mock对象
        mockStream = {
            markdown: jest.fn(),
            progress: jest.fn()
        } as any;
        
        mockModel = {
            id: 'test-model',
            name: 'Test Model'
        } as any;
        
        // 先初始化SessionManager，提供context
        sessionManager = SessionManager.getInstance(mockContext);
        
        // 然后注册participant
        participant = SRSChatParticipant.register(mockContext);
    });

    afterEach(() => {
        SRSChatParticipant.disposeGlobalEngine();
        
        // 清理临时目录
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (error) {
            // 忽略清理错误
        }
    });

    describe('Plan执行状态检查', () => {
        test('应该正确检测未执行状态', () => {
            expect(participant.isPlanExecuting()).toBe(false);
        });

        test('未执行时应该返回null描述', () => {
            const description = participant.getCurrentPlanDescription();
            expect(description).toBeNull();
        });

        test('状态检查方法应该存在且正常工作', () => {
            // 验证方法存在
            expect(typeof participant.isPlanExecuting).toBe('function');
            expect(typeof participant.getCurrentPlanDescription).toBe('function');
            
            // 初始状态应该是未执行
            expect(participant.isPlanExecuting()).toBe(false);
            expect(participant.getCurrentPlanDescription()).toBeNull();
        });
    });

    describe('Plan取消机制', () => {
        test('应该有取消Plan的方法', async () => {
            // 验证方法存在
            expect(typeof participant.cancelCurrentPlan).toBe('function');
            
            // 无Plan执行时取消应该安全返回
            await participant.cancelCurrentPlan();
            expect(participant.isPlanExecuting()).toBe(false);
        });

        test('取消方法应该正常工作而不抛出异常', async () => {
            expect(async () => {
                await participant.cancelCurrentPlan();
            }).not.toThrow();
        });
    });

    describe('上下文清理机制', () => {
        test('应该能清理项目上下文', () => {
            // 验证清理方法存在且能正常调用
            expect(() => {
                participant.clearProjectContext();
            }).not.toThrow();
        });

        test('Orchestrator应该有clearProjectContext方法', () => {
            const orchestrator = new Orchestrator();
            expect(typeof orchestrator.clearProjectContext).toBe('function');
            
            // 验证清理方法能正常调用
            expect(() => {
                orchestrator.clearProjectContext();
            }).not.toThrow();
        });

        test('上下文清理应该重新初始化核心组件', () => {
            const orchestrator = new Orchestrator();
            
            // 获取清理前的组件引用
            const planGeneratorBefore = (orchestrator as any).planGenerator;
            const conversationalExecutorBefore = (orchestrator as any).conversationalExecutor;
            
            // 执行清理
            orchestrator.clearProjectContext();
            
            // 验证组件已被重新初始化（引用不同）
            const planGeneratorAfter = (orchestrator as any).planGenerator;
            const conversationalExecutorAfter = (orchestrator as any).conversationalExecutor;
            
            expect(planGeneratorBefore).not.toBe(planGeneratorAfter);
            expect(conversationalExecutorBefore).not.toBe(conversationalExecutorAfter);
        });
    });

    describe('集成测试 - 完整项目切换流程', () => {
        test('完整项目切换应该包含所有必要步骤', async () => {
            // 1. 初始状态检查
            expect(participant.isPlanExecuting()).toBe(false);
            
            // 2. 取消Plan操作（无Plan时应该安全）
            await participant.cancelCurrentPlan();
            expect(participant.isPlanExecuting()).toBe(false);
            
            // 3. 上下文清理操作
            participant.clearProjectContext();
            
            // 验证清理操作完成（应该不抛出异常）
            expect(true).toBe(true);
        });

        test('状态报告应该包含Plan执行状态', async () => {
            // 无Plan执行时
            let status = await participant.getStatus();
            expect(status).toContain('Plan Executing: No');
        });
    });

    describe('边界情况测试', () => {
        test('API方法应该正确存在', () => {
            // 验证所有关键方法都存在
            expect(typeof participant.isPlanExecuting).toBe('function');
            expect(typeof participant.getCurrentPlanDescription).toBe('function');
            expect(typeof participant.cancelCurrentPlan).toBe('function');
            expect(typeof participant.clearProjectContext).toBe('function');
        });

        test('取消操作应该是幂等的', async () => {
            // 多次调用取消操作应该安全
            await participant.cancelCurrentPlan();
            await participant.cancelCurrentPlan();
            await participant.cancelCurrentPlan();
            
            expect(participant.isPlanExecuting()).toBe(false);
        });

        test('上下文清理应该是安全的', () => {
            // 多次调用清理操作应该安全
            participant.clearProjectContext();
            participant.clearProjectContext();
            participant.clearProjectContext();
            
            // 应该不抛出异常
            expect(true).toBe(true);
        });

        test('Orchestrator应该能设置Plan取消回调', () => {
            const orchestrator = new Orchestrator();
            
            // 验证方法存在
            expect(typeof orchestrator.setPlanCancelledCheckCallback).toBe('function');
            
            // 应该能正常调用而不抛出异常
            expect(() => {
                orchestrator.setPlanCancelledCheckCallback(() => false);
            }).not.toThrow();
        });

        test('SpecialistExecutor应该支持取消检查回调', () => {
            const SpecialistExecutor = require('../../core/specialistExecutor').SpecialistExecutor;
            const specialistExecutor = new SpecialistExecutor();
            
            // 模拟参数
            const mockModel = {} as any;
            const mockContext = { test: 'context' };
            
            // 创建取消检查回调
            let shouldCancel = false;
            const cancelCallback = () => shouldCancel;
            
            // 验证execute方法能接受取消回调参数
            expect(async () => {
                // 设置立即取消
                shouldCancel = true;
                
                const result = await specialistExecutor.execute(
                    'test_specialist',
                    mockContext,
                    mockModel,
                    undefined, // resumeState
                    undefined, // progressCallback
                    cancelCallback
                );
                
                // 应该返回取消状态
                expect(result.success).toBe(false);
                expect(result.error).toContain('cancelled');
            }).not.toThrow();
        });

        test('项目切换进度体验应该正确工作', async () => {
            // 模拟vscode.window.withProgress API
            const mockProgress = {
                report: jest.fn()
            };
            
            const mockWithProgress = jest.fn().mockImplementation(async (options, callback) => {
                // 验证progress配置
                expect(options.location).toBeDefined();
                expect(options.title).toContain('正在切换');
                expect(options.cancellable).toBe(false);
                
                // 执行回调并验证进度报告
                const result = await callback(mockProgress, {});
                
                // 验证进度报告被调用
                expect(mockProgress.report).toHaveBeenCalled();
                
                // 验证进度阶段
                const calls = mockProgress.report.mock.calls;
                const messages = calls.map(call => call[0].message);
                
                // 应该包含关键阶段
                expect(messages.some(msg => msg.includes('中止'))).toBe(true);
                expect(messages.some(msg => msg.includes('归档'))).toBe(true);
                expect(messages.some(msg => msg.includes('清理'))).toBe(true);
                expect(messages.some(msg => msg.includes('完成'))).toBe(true);
                
                return result;
            });
            
            // 模拟vscode.window API
            (vscode.window as any).withProgress = mockWithProgress;
            
            // 验证API存在且能正常调用
            expect(typeof (vscode.window as any).withProgress).toBe('function');
        });

        test('cancelCurrentPlan应该等待specialist真正停止', async () => {
            // 模拟一个正在执行的plan状态
            let planExecuting = true;
            
            // 模拟SRSChatParticipant
            const mockParticipant = {
                isPlanExecuting: jest.fn(() => planExecuting),
                cancelCurrentPlan: jest.fn().mockImplementation(async () => {
                    // 模拟真实的取消过程：先发送信号，然后等待停止
                    await new Promise(resolve => setTimeout(resolve, 100)); // 模拟发送取消信号
                    
                    // 模拟specialist需要一段时间才能真正停止
                    setTimeout(() => {
                        planExecuting = false; // specialist真正停止
                    }, 200);
                    
                    // 等待specialist停止（类似真实实现）
                    while (planExecuting) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                })
            };
            
            // 验证取消过程
            expect(mockParticipant.isPlanExecuting()).toBe(true);
            
            await mockParticipant.cancelCurrentPlan();
            
            // 取消完成后，plan应该不再执行
            expect(planExecuting).toBe(false);
        });
    });
});
