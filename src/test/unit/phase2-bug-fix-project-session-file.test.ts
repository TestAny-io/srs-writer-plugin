/**
 * 阶段2 Bug修复测试：项目级会话文件路径问题
 * 
 * Bug描述：创建新项目时，会话保存到 srs-writer-session_main.json 而不是 srs-writer-session_{projectName}.json
 * 
 * 修复：修改 SessionManager.sessionFilePath getter，根据当前项目名动态选择正确的会话文件路径
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

describe('阶段2 Bug修复：项目级会话文件路径', () => {
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
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('sessionFilePath getter 行为', () => {
        
        test('没有当前会话时，应该返回主会话文件路径', () => {
            // 确保没有当前会话
            expect(sessionManager.getCurrentSession()).resolves.toBeNull();
            
            // sessionFilePath 是私有的，我们通过 SessionPathManager 验证逻辑
            const mainPath = pathManager.getMainSessionPath();
            expect(mainPath).toBe('/test/workspace/.session-log/srs-writer-session_main.json');
        });
        
        test('有项目名的会话时，应该返回项目级会话文件路径', () => {
            const projectName = 'test-project';
            const projectPath = pathManager.getProjectSessionPath(projectName);
            
            expect(projectPath).toBe('/test/workspace/.session-log/srs-writer-session_test-project.json');
            expect(projectPath).not.toContain('_main.json');
        });
        
        test('项目名包含特殊字符时，应该正确处理', () => {
            const projectName = 'My Project-2024!';
            const projectPath = pathManager.getProjectSessionPath(projectName);
            
            // 应该经过安全处理
            expect(projectPath).toBe('/test/workspace/.session-log/srs-writer-session_my_project-2024_.json');
        });
    });

    describe('新会话创建和保存', () => {
        
        test('创建有项目名的新会话时，应该保存到正确的项目文件', async () => {
            const projectName = 'mobile-app';
            
            // Mock writeFile 来验证保存路径
            const fs = require('fs');
            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            
            // 创建新会话
            const newSession = await sessionManager.createNewSession(projectName);
            
            // 验证会话内容
            expect(newSession.projectName).toBe(projectName);
            expect(newSession.sessionContextId).toBeDefined();
            
            // 验证保存路径
            expect(writeFileSpy).toHaveBeenCalledWith(
                expect.stringContaining('srs-writer-session_mobile-app.json'),
                expect.any(String),
                'utf8'
            );
            
            // 确保不是保存到主会话文件
            expect(writeFileSpy).not.toHaveBeenCalledWith(
                expect.stringContaining('srs-writer-session_main.json'),
                expect.any(String),
                'utf8'
            );
        });
        
        test('创建没有项目名的新会话时，应该保存到主会话文件', async () => {
            // Mock writeFile
            const fs = require('fs');
            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            
            // 创建没有项目名的新会话
            const newSession = await sessionManager.createNewSession();
            
            // 验证会话内容
            expect(newSession.projectName).toBeNull();
            expect(newSession.sessionContextId).toBeDefined();
            
            // 验证保存路径
            expect(writeFileSpy).toHaveBeenCalledWith(
                expect.stringContaining('srs-writer-session_main.json'),
                expect.any(String),
                'utf8'
            );
        });
    });

    describe('startNewSession 方法验证', () => {
        
        test('创建新项目会话时，应该保存到项目级文件而不是主文件', async () => {
            const projectName = 'new-project-test';
            
            // Mock writeFile
            const fs = require('fs');
            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            
            // 调用 startNewSession
            const result = await sessionManager.startNewSession(projectName);
            
            // 验证结果
            expect(result.success).toBe(true);
            expect(result.newSession?.projectName).toBe(projectName);
            
            // 🚨 关键验证：应该保存到项目级文件，不是主文件
            expect(writeFileSpy).toHaveBeenCalledWith(
                expect.stringContaining('srs-writer-session_new-project-test.json'),
                expect.any(String),
                'utf8'
            );
            
            // 确保没有覆盖主会话文件
            expect(writeFileSpy).not.toHaveBeenCalledWith(
                expect.stringContaining('srs-writer-session_main.json'),
                expect.any(String),
                'utf8'
            );
        });
    });
});
