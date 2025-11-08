/**
 * 路径解析工具单元测试
 * 
 * 测试新创建的公共路径解析工具的各种场景
 */

import * as path from 'path';
import { resolveWorkspacePath, getCurrentWorkspaceFolder, PathResolutionOptions } from '../../utils/path-resolver';

// Mock VSCode API
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [
            {
                uri: {
                    fsPath: '/mock/workspace/root'
                }
            }
        ]
    },
    Uri: {
        joinPath: jest.fn((base, ...segments) => ({
            fsPath: path.join(base.fsPath, ...segments)
        }))
    }
}));

// 🚀 Phase 1.1: Mock fs for BaseDirValidator
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    statSync: jest.fn(),
    realpathSync: jest.fn()
}));

// Mock SessionManager
const mockGetCurrentSession = jest.fn();
const mockSessionManager = {
    getInstance: jest.fn(() => ({
        getCurrentSession: mockGetCurrentSession
    }))
};

jest.mock('../../core/session-manager', () => ({
    SessionManager: mockSessionManager
}));

// Mock Logger
jest.mock('../../utils/logger', () => ({
    Logger: {
        getInstance: () => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        })
    }
}));

describe('PathResolver', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // 🚀 Phase 1.1: Setup fs mocks for BaseDirValidator
        const fs = require('fs');
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
        (fs.realpathSync as jest.Mock).mockImplementation((p: string) => p);
    });

    describe('getCurrentWorkspaceFolder', () => {
        it('应该返回第一个工作区文件夹', () => {
            const result = getCurrentWorkspaceFolder();
            expect(result).toBeDefined();
            expect(result?.uri.fsPath).toBe('/mock/workspace/root');
        });

        it('当没有工作区时应该返回undefined', () => {
            const vscode = require('vscode');
            vscode.workspace.workspaceFolders = undefined;
            
            const result = getCurrentWorkspaceFolder();
            expect(result).toBeUndefined();
            
            // 恢复mock
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/mock/workspace/root' } }];
        });
    });

    describe('resolveWorkspacePath', () => {
        describe('绝对路径处理', () => {
            it('应该直接返回绝对路径', async () => {
                const absolutePath = '/absolute/path/to/file.json';
                const result = await resolveWorkspacePath(absolutePath);
                expect(result).toBe(absolutePath);
            });
        });

        describe('SessionContext baseDir 优先级', () => {
            it('应该优先使用SessionContext的baseDir', async () => {
                // Mock SessionManager返回有效的session
                // 🚀 Phase 1.1: baseDir必须在workspace内才能通过验证
                const mockSession = {
                    baseDir: '/mock/workspace/root/project'
                };
                mockGetCurrentSession.mockResolvedValue(mockSession);

                const result = await resolveWorkspacePath('config/settings.json');
                expect(result).toBe('/mock/workspace/root/project/config/settings.json');
            });

            it('当SessionContext没有baseDir时应该回退到工作区', async () => {
                // Mock SessionManager返回没有baseDir的session
                const mockSession = {};
                mockGetCurrentSession.mockResolvedValue(mockSession);

                const result = await resolveWorkspacePath('config/settings.json');
                expect(result).toBe('/mock/workspace/root/config/settings.json');
            });

            it('当SessionManager失败时应该回退到工作区', async () => {
                // Mock SessionManager抛出异常
                mockGetCurrentSession.mockRejectedValue(new Error('Session error'));

                const result = await resolveWorkspacePath('config/settings.json');
                expect(result).toBe('/mock/workspace/root/config/settings.json');
            });
        });

        describe('错误处理', () => {
            it('当没有工作区且errorType为standard时应该抛出Error', async () => {
                const vscode = require('vscode');
                vscode.workspace.workspaceFolders = undefined;
                mockGetCurrentSession.mockResolvedValue({});

                await expect(resolveWorkspacePath('test.json')).rejects.toThrow('未找到VSCode工作区');
                
                // 恢复mock
                vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/mock/workspace/root' } }];
            });

            it('当没有工作区且errorType为scaffold时应该尝试抛出ScaffoldError', async () => {
                const vscode = require('vscode');
                vscode.workspace.workspaceFolders = undefined;
                mockGetCurrentSession.mockResolvedValue({});

                const options: PathResolutionOptions = {
                    errorType: 'scaffold',
                    contextName: 'YAML文件'
                };

                // 由于无法真正导入ScaffoldError，应该回退到标准Error
                await expect(resolveWorkspacePath('test.yaml', options)).rejects.toThrow();
                
                // 恢复mock
                vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/mock/workspace/root' } }];
            });
        });

        describe('路径拼接', () => {
            it('应该正确拼接相对路径', async () => {
                // 🚀 Phase 1.1: baseDir必须在workspace内才能通过验证
                const mockSession = {
                    baseDir: '/mock/workspace/root/project'
                };
                mockGetCurrentSession.mockResolvedValue(mockSession);

                const testCases = [
                    { input: 'file.json', expected: '/mock/workspace/root/project/file.json' },
                    { input: 'config/app.json', expected: '/mock/workspace/root/project/config/app.json' },
                    { input: 'docs/README.md', expected: '/mock/workspace/root/project/docs/README.md' },
                    { input: 'requirements/fr.yaml', expected: '/mock/workspace/root/project/requirements/fr.yaml' }
                ];

                for (const testCase of testCases) {
                    const result = await resolveWorkspacePath(testCase.input);
                    expect(result).toBe(testCase.expected);
                }
            });
        });

        describe('选项参数', () => {
            it('应该正确使用contextName', async () => {
                // 🚀 Phase 1.1: baseDir必须在workspace内才能通过验证
                const mockSession = { baseDir: '/mock/workspace/root/project' };
                mockGetCurrentSession.mockResolvedValue(mockSession);

                const options: PathResolutionOptions = {
                    contextName: 'JSON配置文件'
                };

                const result = await resolveWorkspacePath('config.json', options);
                expect(result).toBe('/mock/workspace/root/project/config.json');
                // contextName主要用于日志和错误消息，这里主要验证不会抛出异常
            });
        });
    });
});
