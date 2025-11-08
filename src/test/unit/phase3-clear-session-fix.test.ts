/**
 * 阶段3测试：clearSession() 方法修复验证
 * 
 * 测试目标：
 * 1. 验证 clearSession() 不再删除会话文件
 * 2. 验证内存状态正确清理
 * 3. 验证观察者通知机制正常
 */

import * as path from 'path';
import { SessionManager } from '../../core/session-manager';
import { SessionPathManager } from '../../core/SessionPathManager';

// Mock VSCode
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }],
        fs: {
            stat: jest.fn(),
            createDirectory: jest.fn(),
            readFile: jest.fn(),
            writeFile: jest.fn()
        }
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    },
    ExtensionContext: jest.fn()
}));

// Mock fs promises
jest.mock('fs', () => ({
    promises: {
        access: jest.fn().mockResolvedValue(undefined),
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue('{}'),
        unlink: jest.fn().mockResolvedValue(undefined)  // Mock 文件删除操作
    },
    existsSync: jest.fn().mockReturnValue(true),
    statSync: jest.fn(),      // 🚀 Phase 1.1: Add for BaseDirValidator
    realpathSync: jest.fn()   // 🚀 Phase 1.1: Add for BaseDirValidator
}));

describe('阶段3: clearSession() 方法修复', () => {
    let sessionManager: SessionManager;
    let mockObserver: any;
    
    beforeEach(() => {
        // 清理单例
        (SessionManager as any).instance = null;

        // 创建新的实例
        const mockContext = {
            globalStoragePath: '/test/global-storage'
        } as any;

        sessionManager = SessionManager.getInstance(mockContext);

        // 创建模拟观察者
        mockObserver = {
            onSessionChanged: jest.fn()
        };
        sessionManager.subscribe(mockObserver);

        // 重置所有 mocks
        jest.clearAllMocks();

        // Setup mock implementations for BaseDirValidator
        const fs = require('fs');
        (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
        (fs.realpathSync as jest.Mock).mockImplementation((p: string) => p);
    });

    describe('文件删除行为', () => {
        
        test('clearSession() 不应该删除任何会话文件', async () => {
            // 先创建一个会话
            await sessionManager.createNewSession('test-project');
            
            // Mock fs.promises.unlink 来检测文件删除操作
            const fs = require('fs');
            const unlinkSpy = jest.spyOn(fs.promises, 'unlink');
            
            // 执行 clearSession
            await sessionManager.clearSession();
            
            // 🎯 关键验证：不应该调用任何文件删除操作
            expect(unlinkSpy).not.toHaveBeenCalled();
        });
        
        test('clearSession() 应该保留项目会话文件', async () => {
            // 创建项目会话
            await sessionManager.createNewSession('important-project');
            
            // Mock writeFile 来验证保存操作
            const fs = require('fs');
            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile');
            const unlinkSpy = jest.spyOn(fs.promises, 'unlink');
            
            // 执行 clearSession
            await sessionManager.clearSession();
            
            // 验证：没有删除任何文件
            expect(unlinkSpy).not.toHaveBeenCalled();
            
            // 验证：会话文件应该仍然存在（通过没有删除操作来验证）
            // 实际的文件仍然在 .session-log/srs-writer-session_important-project.json
        });
        
        test('clearSession() 应该保留主会话文件', async () => {
            // 创建主会话（无项目名）
            await sessionManager.createNewSession();
            
            // Mock fs 操作
            const fs = require('fs');
            const unlinkSpy = jest.spyOn(fs.promises, 'unlink');
            
            // 执行 clearSession
            await sessionManager.clearSession();
            
            // 验证：没有删除主会话文件
            expect(unlinkSpy).not.toHaveBeenCalled();
        });
    });

    describe('内存状态清理', () => {
        
        test('clearSession() 应该正确清空内存中的会话状态', async () => {
            // 先创建一个会话
            const session = await sessionManager.createNewSession('test-project');
            expect(session.projectName).toBe('test-project');
            
            // 验证会话存在
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('test-project');
            
            // 执行 clearSession
            await sessionManager.clearSession();
            
            // 验证内存状态已清空
            const clearedSession = await sessionManager.getCurrentSession();
            expect(clearedSession).toBeNull();
        });
    });

    describe('观察者通知', () => {
        
        test('clearSession() 应该通知所有观察者', async () => {
            // 先创建一个会话
            await sessionManager.createNewSession('test-project');
            
            // 重置观察者调用记录
            mockObserver.onSessionChanged.mockClear();
            
            // 执行 clearSession
            await sessionManager.clearSession();
            
            // 验证观察者被通知，且传递的是 null（表示会话被清理）
            expect(mockObserver.onSessionChanged).toHaveBeenCalledWith(null);
        });
        
        test('clearSession() 通知观察者时应该传递 null', async () => {
            // 创建会话并清理
            await sessionManager.createNewSession('test-project');
            mockObserver.onSessionChanged.mockClear();
            
            await sessionManager.clearSession();
            
            // 验证观察者收到的是 null，表示会话已清理
            expect(mockObserver.onSessionChanged).toHaveBeenCalledTimes(1);
            expect(mockObserver.onSessionChanged).toHaveBeenCalledWith(null);
        });
    });

    describe('重构后的行为验证', () => {
        
        test('多次 clearSession() 调用应该是安全的', async () => {
            // 创建会话
            await sessionManager.createNewSession('test-project');
            
            // 第一次清理
            await sessionManager.clearSession();
            
            // 第二次清理（应该是安全的）
            await expect(sessionManager.clearSession()).resolves.not.toThrow();
            
            // 验证状态仍然是 null
            const session = await sessionManager.getCurrentSession();
            expect(session).toBeNull();
        });
        
        test('clearSession() 后应该能够创建新会话', async () => {
            // 创建并清理会话
            await sessionManager.createNewSession('old-project');
            await sessionManager.clearSession();
            
            // 创建新会话应该正常工作
            const newSession = await sessionManager.createNewSession('new-project');
            expect(newSession.projectName).toBe('new-project');
            expect(newSession.sessionContextId).toBeDefined();
            
            // 验证新会话是当前会话
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('new-project');
        });
    });
});
