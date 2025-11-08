/**
 * 路径解析存在性检查测试
 * 
 * 验证新增的文件存在性检查和智能回退机制
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { resolveWorkspacePath, PathResolutionOptions } from '../../utils/path-resolver';

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
    }
}));

// 🚀 Phase 1.1: Mock fs for BaseDirValidator
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    statSync: jest.fn(),
    realpathSync: jest.fn(),
    promises: jest.requireActual('fs').promises  // Keep real promises for test setup
}));

// Mock SessionManager
const mockGetCurrentSession = jest.fn();
jest.mock('../../core/session-manager', () => ({
    SessionManager: {
        getInstance: () => ({
            getCurrentSession: mockGetCurrentSession
        })
    }
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

describe('Path Resolver Existence Check Tests', () => {
    let tempDir: string;
    let projectDir: string;
    let workspaceDir: string;

    beforeAll(async () => {
        // 创建测试目录结构
        // 🚀 Phase 1.1: projectDir必须在workspaceDir内才能通过BaseDirValidator
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'path-existence-test-'));
        workspaceDir = tempDir;  // workspace就是temp dir
        projectDir = path.join(workspaceDir, 'project');  // project在workspace内

        await fs.mkdir(projectDir, { recursive: true });

        // 创建测试文件
        await fs.writeFile(path.join(projectDir, 'project-file.json'), '{"in": "project"}');
        await fs.mkdir(path.join(workspaceDir, '.session-log'), { recursive: true });
        await fs.writeFile(path.join(workspaceDir, '.session-log', 'session.json'), '{"in": "workspace"}');
    });

    afterAll(async () => {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('清理测试目录失败:', error);
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // 重置VSCode mock
        const vscode = require('vscode');
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: workspaceDir } }];

        // 🚀 Phase 1.1: Setup fs mocks for BaseDirValidator
        const fsSync = require('fs');
        // existsSync用实际文件系统检查（因为测试创建了真实文件）
        (fsSync.existsSync as jest.Mock).mockImplementation((p: string) => {
            try {
                return require('fs').existsSync(p);
            } catch {
                return true;  // 默认返回true以通过其他验证
            }
        });
        (fsSync.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
        (fsSync.realpathSync as jest.Mock).mockImplementation((p: string) => p);
    });

    describe('存在性检查禁用（默认行为）', () => {
        it('应该保持原有行为：不检查存在性', async () => {
            mockGetCurrentSession.mockResolvedValue({
                baseDir: projectDir
            });

            const result = await resolveWorkspacePath('non-existent.json');
            
            // 应该返回项目目录下的路径，即使文件不存在
            expect(result).toBe(path.join(projectDir, 'non-existent.json'));
        });
    });

    describe('存在性检查启用', () => {
        it('文件在项目目录存在时应该使用项目路径', async () => {
            mockGetCurrentSession.mockResolvedValue({
                baseDir: projectDir
            });

            const options: PathResolutionOptions = {
                checkExistence: true,
                contextName: '测试文件'
            };

            const result = await resolveWorkspacePath('project-file.json', options);
            
            expect(result).toBe(path.join(projectDir, 'project-file.json'));
        });

        it('文件在项目目录不存在但在工作区存在时应该回退', async () => {
            mockGetCurrentSession.mockResolvedValue({
                baseDir: projectDir
            });

            const options: PathResolutionOptions = {
                checkExistence: true,
                contextName: '会话文件'
            };

            const result = await resolveWorkspacePath('.session-log/session.json', options);
            
            // 应该回退到工作区路径
            expect(result).toBe(path.join(workspaceDir, '.session-log/session.json'));
        });

        it('文件在两个位置都不存在时应该抛出错误', async () => {
            mockGetCurrentSession.mockResolvedValue({
                baseDir: projectDir
            });

            const options: PathResolutionOptions = {
                checkExistence: true,
                contextName: '不存在的文件'
            };

            await expect(
                resolveWorkspacePath('totally-non-existent.json', options)
            ).rejects.toThrow('不存在的文件在所有位置都不存在: totally-non-existent.json');
        });

        it('文件在两个位置都不存在时应该支持scaffold错误类型', async () => {
            mockGetCurrentSession.mockResolvedValue({
                baseDir: projectDir
            });

            const options: PathResolutionOptions = {
                checkExistence: true,
                errorType: 'scaffold',
                contextName: '不存在的YAML文件'
            };

            // 应该尝试抛出ScaffoldError，如果导入失败则回退到Error
            await expect(
                resolveWorkspacePath('non-existent.yaml', options)
            ).rejects.toThrow();
        });
    });

    describe('回退机制触发条件', () => {
        it('SessionContext没有baseDir时应该直接使用工作区', async () => {
            mockGetCurrentSession.mockResolvedValue({});  // 没有baseDir

            const options: PathResolutionOptions = {
                checkExistence: true
            };

            const result = await resolveWorkspacePath('.session-log/session.json', options);
            expect(result).toBe(path.join(workspaceDir, '.session-log/session.json'));
        });

        it('SessionManager失败时应该回退到工作区', async () => {
            mockGetCurrentSession.mockRejectedValue(new Error('Session error'));

            const options: PathResolutionOptions = {
                checkExistence: true
            };

            const result = await resolveWorkspacePath('.session-log/session.json', options);
            expect(result).toBe(path.join(workspaceDir, '.session-log/session.json'));
        });
    });

    describe('UAT场景重现', () => {
        it('应该正确处理会话日志文件的查找', async () => {
            // 创建UAT场景的测试文件
            const sessionLogPath = '.session-log/srs-writer-session_blackpinkfanwebapp.json';
            const workspaceSessionFile = path.join(workspaceDir, sessionLogPath);
            
            // 确保目录存在并创建文件
            await fs.mkdir(path.dirname(workspaceSessionFile), { recursive: true });
            await fs.writeFile(workspaceSessionFile, '{"session": "data"}');
            
            // 项目目录下没有这个文件，但工作区有
            mockGetCurrentSession.mockResolvedValue({
                baseDir: projectDir
            });

            const options: PathResolutionOptions = {
                checkExistence: true,
                contextName: '会话日志文件'
            };

            const result = await resolveWorkspacePath(sessionLogPath, options);
            
            // 应该回退到工作区路径
            expect(result).toBe(workspaceSessionFile);
        });
    });
});
