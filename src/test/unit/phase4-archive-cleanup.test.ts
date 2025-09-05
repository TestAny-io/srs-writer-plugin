/**
 * 阶段4测试：归档系统清理验证
 * 
 * 测试目标：
 * 1. 验证归档相关方法已被移除
 * 2. 验证新的startNewSession方法正常工作
 * 3. 验证向后兼容性（archiveCurrentAndStartNew仍可调用）
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
        readFile: jest.fn().mockResolvedValue('{}')
    },
    existsSync: jest.fn().mockReturnValue(true)
}));

describe('阶段4: 归档系统清理验证', () => {
    let sessionManager: SessionManager;
    let pathManager: SessionPathManager;

    beforeEach(() => {
        const mockContext = {
            globalStoragePath: '/test/storage',
            subscriptions: []
        } as any;

        sessionManager = SessionManager.getInstance(mockContext);
        pathManager = new SessionPathManager('/test/workspace');
        
        // 清理所有mock
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
        // 重置SessionManager单例
        (SessionManager as any).instance = undefined;
    });

    describe('归档方法移除验证', () => {
        test('archiveCurrentSession方法应该不存在', () => {
            // 验证方法已被移除
            expect((sessionManager as any).archiveCurrentSession).toBeUndefined();
        });

        test('listArchivedSessions方法应该不存在', () => {
            // 验证方法已被移除
            expect((sessionManager as any).listArchivedSessions).toBeUndefined();
        });

        test('autoArchiveExpiredSessions方法应该不存在', () => {
            // 验证方法已被移除
            expect((sessionManager as any).autoArchiveExpiredSessions).toBeUndefined();
        });

        test('getUserAssetFiles方法应该不存在', () => {
            // 验证方法已被移除
            expect((sessionManager as any).getUserAssetFiles).toBeUndefined();
        });

        test('generateArchiveFileName方法应该不存在', () => {
            // 验证私有方法已被移除
            expect((sessionManager as any).generateArchiveFileName).toBeUndefined();
        });

        test('archiveDirectoryPath getter应该不存在', () => {
            // 验证getter已被移除
            expect((sessionManager as any).archiveDirectoryPath).toBeUndefined();
        });
    });

    describe('新的startNewSession方法', () => {
        test('应该能够创建新会话并返回简化结果', async () => {
            const projectName = 'test-project';
            
            const result = await sessionManager.startNewSession(projectName);
            
            // 验证返回结果结构
            expect(result.success).toBe(true);
            expect(result.newSession).toBeDefined();
            expect(result.newSession?.projectName).toBe(projectName);
            expect(result.error).toBeUndefined();
            
            // 验证不包含归档相关字段
            expect((result as any).filesPreserved).toBeUndefined();
            expect((result as any).archivedSession).toBeUndefined();
        });

        test('文件保存失败时应该仍然返回成功的会话对象（降级策略）', async () => {
            // Mock文件写入失败
            const fs = require('fs');
            const writeFileMock = jest.spyOn(fs.promises, 'writeFile').mockRejectedValueOnce(new Error('Write failed'));
            
            const result = await sessionManager.startNewSession('test-project');
            
            // 🎯 验证降级策略：即使文件保存失败，会话创建仍然成功
            expect(result.success).toBe(true);
            expect(result.newSession).toBeDefined();
            expect(result.newSession?.projectName).toBe('test-project');
            expect(result.error).toBeUndefined();
            
            // 🎯 这验证了系统的健壮性设计：
            // - 内存中的会话对象成功创建
            // - 文件保存失败不影响核心功能
            // - 用户可以继续工作，重启后状态会尝试恢复
            
            console.log('✅ 降级策略验证：文件保存失败时会话仍然可用');
            
            // 恢复mock
            writeFileMock.mockRestore();
        });
    });

    describe('向后兼容性验证', () => {
        test('archiveCurrentAndStartNew方法应该仍然可调用', async () => {
            // 验证方法存在
            expect(sessionManager.archiveCurrentAndStartNew).toBeDefined();
            expect(typeof sessionManager.archiveCurrentAndStartNew).toBe('function');
        });

        test('archiveCurrentAndStartNew应该委托给startNewSession', async () => {
            const projectName = 'compat-test';
            
            // 监听startNewSession调用
            const startNewSessionSpy = jest.spyOn(sessionManager, 'startNewSession');
            
            const result = await sessionManager.archiveCurrentAndStartNew(projectName);
            
            // 验证调用了startNewSession
            expect(startNewSessionSpy).toHaveBeenCalledWith(projectName);
            
            // 验证返回相同结构
            expect(result.success).toBe(true);
            expect(result.newSession?.projectName).toBe(projectName);
        });
    });

    describe('代码简化验证', () => {
        test('SessionManager实例应该更轻量', () => {
            // 验证不再有归档相关的属性
            const managerKeys = Object.getOwnPropertyNames(sessionManager);
            
            // 不应该包含归档相关属性
            expect(managerKeys).not.toContain('archiveDirectoryPath');
            expect(managerKeys).not.toContain('archiveConfig');
            
            console.log('✅ SessionManager已简化，移除了归档相关属性');
        });
    });
});
