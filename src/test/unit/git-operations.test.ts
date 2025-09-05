/**
 * 单元测试：Git操作工具函数
 * 
 * 测试checkWorkspaceGitStatus和commitAllChanges函数的核心逻辑
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

// Mock VSCode模块
const mockVscode = {
    workspace: {
        workspaceFolders: [
            {
                uri: {
                    fsPath: '/mock/workspace/path'
                }
            }
        ]
    }
};

// Mock模块解析
jest.mock('vscode', () => mockVscode, { virtual: true });

// Mock child_process
jest.mock('child_process');
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

// Mock fs
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Git操作工具测试', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('checkWorkspaceGitStatus', () => {
        it('应该正确检测无Git仓库的情况', async () => {
            // 模拟非Git仓库
            mockedFs.existsSync.mockReturnValue(false);
            
            const { checkWorkspaceGitStatus } = await import('../../tools/atomic/git-operations');
            const result = await checkWorkspaceGitStatus();
            
            expect(result.hasChanges).toBe(false);
            expect(result.hasStagedChanges).toBe(false);
            expect(result.hasUnstagedChanges).toBe(false);
            expect(result.workspaceRoot).toBe('/mock/workspace/path');
        });

        it('应该正确检测有Git仓库但无更改的情况', async () => {
            // 模拟Git仓库存在
            mockedFs.existsSync.mockReturnValue(true);
            // 模拟git status --porcelain返回空
            mockedExecSync.mockReturnValue('');
            
            const { checkWorkspaceGitStatus } = await import('../../tools/atomic/git-operations');
            const result = await checkWorkspaceGitStatus();
            
            expect(result.hasChanges).toBe(false);
            expect(result.hasStagedChanges).toBe(false);
            expect(result.hasUnstagedChanges).toBe(false);
            expect(result.workspaceRoot).toBe('/mock/workspace/path');
        });

        it('应该正确检测有unstaged changes的情况', async () => {
            // 模拟Git仓库存在
            mockedFs.existsSync.mockReturnValue(true);
            // 模拟git status --porcelain返回unstaged changes
            mockedExecSync.mockReturnValue(' M file1.txt\n ?? file2.txt\n');
            
            const { checkWorkspaceGitStatus } = await import('../../tools/atomic/git-operations');
            const result = await checkWorkspaceGitStatus();
            
            expect(result.hasChanges).toBe(true);
            expect(result.hasStagedChanges).toBe(false);
            expect(result.hasUnstagedChanges).toBe(true);
        });

        it('应该正确检测有staged changes的情况', async () => {
            // 模拟Git仓库存在
            mockedFs.existsSync.mockReturnValue(true);
            // 模拟git status --porcelain返回staged changes
            mockedExecSync.mockReturnValue('M  file1.txt\nA  file2.txt\n');
            
            const { checkWorkspaceGitStatus } = await import('../../tools/atomic/git-operations');
            const result = await checkWorkspaceGitStatus();
            
            expect(result.hasChanges).toBe(true);
            expect(result.hasStagedChanges).toBe(true);
            expect(result.hasUnstagedChanges).toBe(false);
        });

        it('应该正确检测同时有staged和unstaged changes的情况', async () => {
            // 模拟Git仓库存在
            mockedFs.existsSync.mockReturnValue(true);
            // 模拟git status --porcelain返回mixed changes
            mockedExecSync.mockReturnValue('MM file1.txt\nAM file2.txt\n ?? file3.txt\n');
            
            const { checkWorkspaceGitStatus } = await import('../../tools/atomic/git-operations');
            const result = await checkWorkspaceGitStatus();
            
            expect(result.hasChanges).toBe(true);
            expect(result.hasStagedChanges).toBe(true);
            expect(result.hasUnstagedChanges).toBe(true);
        });
    });

    describe('commitAllChanges', () => {
        it('应该成功提交所有更改', async () => {
            const mockCommitHash = 'abc123def456';
            
            // 模拟Git仓库存在
            mockedFs.existsSync.mockReturnValue(true);
            
            // 模拟git命令执行
            mockedExecSync
                .mockReturnValueOnce('') // git add .
                .mockReturnValueOnce('M  file1.txt\n') // git status --porcelain (有更改)
                .mockReturnValueOnce('') // git commit
                .mockReturnValueOnce(mockCommitHash); // git rev-parse HEAD
            
            const { commitAllChanges } = await import('../../tools/atomic/git-operations');
            const result = await commitAllChanges('/mock/workspace/path');
            
            expect(result.success).toBe(true);
            expect(result.commitHash).toBe(mockCommitHash);
            expect(result.error).toBeUndefined();
        });

        it('应该处理无更改需要提交的情况', async () => {
            // 模拟Git仓库存在
            mockedFs.existsSync.mockReturnValue(true);
            
            // 模拟git命令执行
            mockedExecSync
                .mockReturnValueOnce('') // git add .
                .mockReturnValueOnce(''); // git status --porcelain (无更改)
            
            const { commitAllChanges } = await import('../../tools/atomic/git-operations');
            const result = await commitAllChanges('/mock/workspace/path');
            
            expect(result.success).toBe(true);
            expect(result.commitHash).toBeUndefined();
            expect(result.error).toBeUndefined();
        });

        it('应该正确生成时间戳格式的提交消息', async () => {
            const mockCommitHash = 'abc123def456';
            
            // 模拟Git仓库存在
            mockedFs.existsSync.mockReturnValue(true);
            
            // 模拟当前时间 (UTC时间)
            const mockDate = new Date('2025-01-09T14:30:00.000Z');
            jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
            
            // 模拟git命令执行
            mockedExecSync
                .mockReturnValueOnce('') // git add .
                .mockReturnValueOnce('M  file1.txt\n') // git status --porcelain (有更改)
                .mockReturnValueOnce('') // git commit
                .mockReturnValueOnce(mockCommitHash); // git rev-parse HEAD
            
            const { commitAllChanges } = await import('../../tools/atomic/git-operations');
            await commitAllChanges('/mock/workspace/path');
            
            // 验证commit命令使用了正确的时间戳格式（考虑时区转换）
            expect(mockedExecSync).toHaveBeenCalledWith(
                expect.stringMatching(/git commit -m "auto-commit at 2025-01-09, \d{2}:\d{2}"/),
                expect.any(Object)
            );
        });

        it('应该处理非Git仓库的情况', async () => {
            // 模拟非Git仓库
            mockedFs.existsSync.mockReturnValue(false);
            
            const { commitAllChanges } = await import('../../tools/atomic/git-operations');
            const result = await commitAllChanges('/mock/workspace/path');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Not a Git repository');
        });

        it('应该处理Git命令执行失败的情况', async () => {
            // 模拟Git仓库存在
            mockedFs.existsSync.mockReturnValue(true);
            
            // 模拟git命令执行失败
            mockedExecSync
                .mockReturnValueOnce('') // git add .
                .mockReturnValueOnce('M  file1.txt\n') // git status --porcelain (有更改)
                .mockImplementationOnce(() => {
                    throw new Error('Git commit failed');
                });
            
            const { commitAllChanges } = await import('../../tools/atomic/git-operations');
            const result = await commitAllChanges('/mock/workspace/path');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Git commit failed');
        });
    });

    describe('discardAllChanges', () => {
        it('应该成功丢弃所有更改', async () => {
            // 模拟Git仓库存在
            mockedFs.existsSync.mockReturnValue(true);
            
            // 模拟git命令执行
            mockedExecSync
                .mockReturnValueOnce('') // git reset HEAD
                .mockReturnValueOnce('') // git checkout -- .
                .mockReturnValueOnce(''); // git clean -fd
            
            const { discardAllChanges } = await import('../../tools/atomic/git-operations');
            const result = await discardAllChanges('/mock/workspace/path');
            
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            
            // 验证执行了正确的git命令
            expect(mockedExecSync).toHaveBeenCalledWith('git reset HEAD', expect.any(Object));
            expect(mockedExecSync).toHaveBeenCalledWith('git checkout -- .', expect.any(Object));
            expect(mockedExecSync).toHaveBeenCalledWith('git clean -f', expect.any(Object)); // 🚀 阶段3修复：只清理文件，不删除目录
        });

        it('应该处理非Git仓库的情况', async () => {
            // 模拟非Git仓库
            mockedFs.existsSync.mockReturnValue(false);
            
            const { discardAllChanges } = await import('../../tools/atomic/git-operations');
            const result = await discardAllChanges('/mock/workspace/path');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Not a Git repository');
        });

        it('应该处理git clean失败的情况（不影响整体成功）', async () => {
            // 模拟Git仓库存在
            mockedFs.existsSync.mockReturnValue(true);
            
            // 模拟git命令执行，clean失败
            mockedExecSync
                .mockReturnValueOnce('') // git reset HEAD
                .mockReturnValueOnce('') // git checkout -- .
                .mockImplementationOnce(() => {
                    throw new Error('Git clean failed');
                });
            
            const { discardAllChanges } = await import('../../tools/atomic/git-operations');
            const result = await discardAllChanges('/mock/workspace/path');
            
            expect(result.success).toBe(true); // 即使clean失败，整体操作仍然成功
            expect(result.error).toBeUndefined();
        });

        it('应该处理关键git命令失败的情况', async () => {
            // 模拟Git仓库存在
            mockedFs.existsSync.mockReturnValue(true);
            
            // 模拟git reset失败
            mockedExecSync.mockImplementationOnce(() => {
                throw new Error('Git reset failed');
            });
            
            const { discardAllChanges } = await import('../../tools/atomic/git-operations');
            const result = await discardAllChanges('/mock/workspace/path');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Git reset failed');
        });
    });
});
