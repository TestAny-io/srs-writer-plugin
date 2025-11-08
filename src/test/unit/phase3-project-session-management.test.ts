/**
 * 阶段3测试：项目级会话文件支持和会话切换
 * 
 * 测试目标：
 * 1. 验证项目会话扫描功能
 * 2. 验证会话切换逻辑
 * 3. 验证项目列表合并功能
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
            writeFile: jest.fn(),
            readDirectory: jest.fn()
        }
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    },
    FileType: {
        File: 1,
        Directory: 2
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
    existsSync: jest.fn().mockReturnValue(true),
    statSync: jest.fn(),      // 🚀 Phase 1.1: Add for BaseDirValidator
    realpathSync: jest.fn()   // 🚀 Phase 1.1: Add for BaseDirValidator
}));

describe('阶段3: 项目级会话文件支持', () => {
    let sessionManager: SessionManager;
    let pathManager: SessionPathManager;
    
    beforeEach(() => {
        // 清理单例
        (SessionManager as any).instance = null;

        // 创建新的实例
        const mockContext = {
            globalStoragePath: '/test/global-storage'
        } as any;

        sessionManager = SessionManager.getInstance(mockContext);
        pathManager = new SessionPathManager('/test/workspace');

        // 重置所有 mocks
        jest.clearAllMocks();

        // Setup mock implementations for BaseDirValidator
        const fs = require('fs');
        (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
        (fs.realpathSync as jest.Mock).mockImplementation((p: string) => p);
    });

    describe('项目会话扫描功能', () => {
        
        test('应该能扫描 .session-log 目录中的项目会话文件', async () => {
            // Mock 目录内容
            const vscode = require('vscode');
            const mockFiles = [
                ['srs-writer-session_main.json', vscode.FileType.File],
                ['srs-writer-session_project1.json', vscode.FileType.File],
                ['srs-writer-session_project2.json', vscode.FileType.File],
                ['other-file.txt', vscode.FileType.File]
            ];
            
            vscode.workspace.fs.readDirectory.mockResolvedValue(mockFiles);
            vscode.workspace.fs.readFile.mockImplementation((uri: any) => {
                const fileName = path.basename(uri.fsPath);
                if (fileName.includes('project1')) {
                    return Promise.resolve(Buffer.from(JSON.stringify({
                        sessionContextId: 'test-id-1',
                        projectName: 'project1',
                        metadata: { lastModified: '2025-09-01T10:00:00.000Z' },
                        operations: [1, 2, 3]
                    })));
                } else if (fileName.includes('project2')) {
                    return Promise.resolve(Buffer.from(JSON.stringify({
                        sessionContextId: 'test-id-2',
                        projectName: 'project2',
                        metadata: { lastModified: '2025-09-01T11:00:00.000Z' },
                        operations: [1, 2]
                    })));
                }
                return Promise.resolve(Buffer.from('{}'));
            });
            
            const projectSessions = await sessionManager.listProjectSessions();
            
            expect(projectSessions).toHaveLength(2);
            expect(projectSessions[0].projectName).toBe('project1');
            expect(projectSessions[0].operationCount).toBe(3);
            expect(projectSessions[1].projectName).toBe('project2');
            expect(projectSessions[1].operationCount).toBe(2);
        });
        
        test('应该跳过主会话文件', async () => {
            const vscode = require('vscode');
            const mockFiles = [
                ['srs-writer-session_main.json', vscode.FileType.File],
                ['srs-writer-session_testproject.json', vscode.FileType.File]
            ];
            
            vscode.workspace.fs.readDirectory.mockResolvedValue(mockFiles);
            vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from(JSON.stringify({
                sessionContextId: 'test-id',
                projectName: 'testproject',
                metadata: { lastModified: '2025-09-01T10:00:00.000Z' },
                operations: []
            })));
            
            const projectSessions = await sessionManager.listProjectSessions();
            
            expect(projectSessions).toHaveLength(1);
            expect(projectSessions[0].projectName).toBe('testproject');
        });
        
        test('应该处理损坏的会话文件', async () => {
            const vscode = require('vscode');
            const mockFiles = [
                ['srs-writer-session_project1.json', vscode.FileType.File],
                ['srs-writer-session_project2.json', vscode.FileType.File]
            ];
            
            vscode.workspace.fs.readDirectory.mockResolvedValue(mockFiles);
            vscode.workspace.fs.readFile.mockImplementation((uri: any) => {
                const fileName = path.basename(uri.fsPath);
                if (fileName.includes('project1')) {
                    return Promise.resolve(Buffer.from('invalid json'));
                } else {
                    return Promise.resolve(Buffer.from(JSON.stringify({
                        sessionContextId: 'test-id-2',
                        projectName: 'project2',
                        metadata: { lastModified: '2025-09-01T11:00:00.000Z' },
                        operations: []
                    })));
                }
            });
            
            const projectSessions = await sessionManager.listProjectSessions();
            
            // 应该只返回有效的会话文件
            expect(projectSessions).toHaveLength(1);
            expect(projectSessions[0].projectName).toBe('project2');
        });
    });

    describe('会话切换功能', () => {
        
        test('应该能切换到已存在的项目会话', async () => {
            // Mock 现有会话
            const existingSession = {
                sessionContextId: 'existing-session-id',
                projectName: 'target-project',
                baseDir: '/test/workspace/target-project',
                metadata: { lastModified: '2025-09-01T10:00:00.000Z' },
                operations: []
            };
            
            // Mock loadSessionFileContent 返回现有会话
            const vscode = require('vscode');
            vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from(JSON.stringify(existingSession)));
            
            // Mock saveSessionToFile
            const fs = require('fs');
            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            
            await sessionManager.switchToProjectSession('target-project');
            
            // 验证当前会话已切换
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('target-project');
            expect(currentSession?.sessionContextId).toBe('existing-session-id');
        });
        
        test('应该为不存在会话的项目创建新会话', async () => {
            // Mock loadSessionFileContent 抛出错误（文件不存在）
            const vscode = require('vscode');
            vscode.workspace.fs.readFile.mockRejectedValue(new Error('File not found'));
            
            // Mock saveSessionToFile
            const fs = require('fs');
            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            
            await sessionManager.switchToProjectSession('new-project');
            
            // 验证创建了新会话
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('new-project');
            expect(currentSession?.sessionContextId).toBeDefined();
            expect(currentSession?.baseDir).toBe('/test/workspace/new-project');
        });
        
        test('切换前应该保存当前会话', async () => {
            // 先创建一个当前会话
            await sessionManager.createNewSession('current-project');
            
            // Mock fs
            const fs = require('fs');
            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            
            // Mock 目标会话
            const vscode = require('vscode');
            vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from(JSON.stringify({
                sessionContextId: 'target-id',
                projectName: 'target-project',
                metadata: { lastModified: '2025-09-01T10:00:00.000Z' }
            })));
            
            await sessionManager.switchToProjectSession('target-project');
            
            // 验证保存了当前会话（至少调用了一次 writeFile）
            expect(writeFileSpy).toHaveBeenCalled();
            
            // 验证切换成功
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('target-project');
        });
    });
});
