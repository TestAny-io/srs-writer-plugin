/**
 * Git 操作工具 - 用于项目分支管理
 * 
 * 功能：
 * - 创建项目分支 (SRS/项目名称)
 * - 智能处理工作区状态
 * - 记录操作到会话日志
 * - 工作区 Git 初始化
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

export interface GitOperationResult {
    success: boolean;
    message: string;
    error?: string;
    branchName?: string;
    wasCreated?: boolean;
    wasSwitched?: boolean;
    commitCreated?: boolean;
    commitHash?: string;
    operation?: 'created' | 'switched' | 'no-change' | 'failed';
}

/**
 * 检查目录是否为 Git 仓库
 */
export async function checkGitRepository(projectDir: string): Promise<boolean> {
    try {
        const gitDir = path.join(projectDir, '.git');
        return fs.existsSync(gitDir);
    } catch (error) {
        return false;
    }
}

/**
 * 检查 Git 工作区状态
 */
export async function getGitStatus(projectDir: string): Promise<{
    hasUnstagedChanges: boolean;
    hasStagedChanges: boolean;
    isClean: boolean;
}> {
    try {
        const result = execSync('git status --porcelain', { 
            cwd: projectDir, 
            encoding: 'utf8' 
        });
        
        // 🔧 修复：不要 trim() 整个结果，避免删除重要的前导空格
        const lines = result.split('\n').filter(line => line.length > 0);
        const hasUnstagedChanges = lines.some(line => line[1] !== ' ');
        const hasStagedChanges = lines.some(line => line[0] !== ' ' && line[0] !== '?');
        
        return {
            hasUnstagedChanges,
            hasStagedChanges,
            isClean: lines.length === 0
        };
    } catch (error) {
        return {
            hasUnstagedChanges: false,
            hasStagedChanges: false,
            isClean: true
        };
    }
}

/**
 * 创建自动提交（处理已 stage 的更改）
 */
export async function createAutoCommit(projectDir: string, message: string): Promise<{
    success: boolean;
    commitHash?: string;
    error?: string;
}> {
    try {
        execSync(`git commit -m "${message}"`, { cwd: projectDir });
        const commitHash = execSync('git rev-parse HEAD', { 
            cwd: projectDir, 
            encoding: 'utf8' 
        }).trim();
        
        return {
            success: true,
            commitHash
        };
    } catch (error) {
        return {
            success: false,
            error: (error as Error).message
        };
    }
}

/**
 * 检查分支是否存在
 */
export async function checkBranchExists(projectDir: string, branchName: string): Promise<boolean> {
    try {
        execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, { cwd: projectDir });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * 获取当前分支名称
 */
export async function getCurrentBranch(projectDir: string): Promise<string | null> {
    try {
        const result = execSync('git branch --show-current', { 
            cwd: projectDir, 
            encoding: 'utf8' 
        });
        return result.trim() || null;
    } catch (error) {
        logger.warn(`Failed to get current branch: ${(error as Error).message}`);
        return null;
    }
}

/**
 * 创建并切换到项目分支（核心功能）
 * 
 * 处理逻辑：
 * 1. 检查是否为 Git 仓库
 * 2. 检查分支是否已存在
 * 3. 处理已 stage 的更改（自动提交）
 * 4. 创建并切换分支（未 stage 的更改会自动跟随）
 */
export async function createProjectBranch(
    projectDir: string, 
    projectName: string
): Promise<GitOperationResult> {
    const branchName = `SRS/${projectName}`;
    
    try {
        logger.info(`🌿 [Git] Starting branch operation for project: ${projectName}`);
        
        // 1. 检查是否为 Git 仓库
        if (!await checkGitRepository(projectDir)) {
            logger.warn(`🌿 [Git] Directory ${projectDir} is not a Git repository`);
            return {
                success: false,
                message: `Directory is not a Git repository`,
                error: 'NOT_GIT_REPO'
            };
        }

        // 获取当前分支信息
        const currentBranch = await getCurrentBranch(projectDir);
        logger.info(`🌿 [Git] Current branch: ${currentBranch || 'unknown'}`);

        // 2. 检查分支是否已存在
        const branchExists = await checkBranchExists(projectDir, branchName);
        if (branchExists) {
            // 分支已存在，直接切换
            logger.info(`🌿 [Git] Branch ${branchName} already exists, switching to it`);
            execSync(`git checkout "${branchName}"`, { cwd: projectDir });
            return {
                success: true,
                message: `Switched to existing branch ${branchName}`,
                branchName,
                wasCreated: false,
                wasSwitched: true
            };
        }

        // 3. 检查工作区状态
        const gitStatus = await getGitStatus(projectDir);
        logger.info(`🌿 [Git] Working directory status - Clean: ${gitStatus.isClean}, Staged: ${gitStatus.hasStagedChanges}, Unstaged: ${gitStatus.hasUnstagedChanges}`);
        
        let commitResult: { success: boolean; commitHash?: string; error?: string } | null = null;

        // 4. 处理已 stage 的更改：先提交
        if (gitStatus.hasStagedChanges) {
            logger.info(`🌿 [Git] Found staged changes, creating auto-commit before branch creation`);
            const commitMessage = `Auto-commit before creating branch for project: ${projectName}`;
            commitResult = await createAutoCommit(projectDir, commitMessage);
            
            if (!commitResult.success) {
                logger.error(`🌿 [Git] Failed to create auto-commit: ${commitResult.error}`);
                return {
                    success: false,
                    message: `Failed to commit staged changes before creating branch`,
                    error: commitResult.error
                };
            }
            
            logger.info(`🌿 [Git] Created auto-commit ${commitResult.commitHash}`);
        }

        // 5. 创建并切换到新分支
        // 注意：未stage的更改会自动跟随到新分支（Git默认行为）
        logger.info(`🌿 [Git] Creating and switching to new branch: ${branchName}`);
        execSync(`git checkout -b "${branchName}"`, { cwd: projectDir });

        const resultMessage = `Successfully created and switched to branch ${branchName}`;
        logger.info(`🌿 [Git] ${resultMessage}`);

        return {
            success: true,
            message: resultMessage,
            branchName,
            wasCreated: true,
            wasSwitched: true,
            commitCreated: !!commitResult?.success,
            commitHash: commitResult?.commitHash
        };

    } catch (error) {
        const errorMessage = `Failed to create branch ${branchName}: ${(error as Error).message}`;
        logger.error(`🌿 [Git] ${errorMessage}`);
        return {
            success: false,
            message: errorMessage,
            error: (error as Error).message
        };
    }
}

/**
 * 🚀 新增：初始化 Git 仓库并设置 main 分支
 */
export async function initializeGitRepository(workspacePath: string): Promise<GitOperationResult> {
    try {
        logger.info(`🌿 [Git Init] Starting Git repository initialization in: ${workspacePath}`);
        
        // 1. 检查是否已经是 Git 仓库
        if (await checkGitRepository(workspacePath)) {
            logger.info(`🌿 [Git Init] Directory is already a Git repository`);
            return {
                success: true,
                message: 'Git repository already exists',
                operation: 'no-change'
            };
        }
        
        // 2. 初始化 Git 仓库
        logger.info(`🌿 [Git Init] Initializing Git repository...`);
        execSync('git init', { cwd: workspacePath });
        
        // 3. 设置默认分支为 main
        logger.info(`🌿 [Git Init] Setting default branch to main...`);
        execSync('git branch -M main', { cwd: workspacePath });
        
        logger.info(`🌿 [Git Init] Git repository initialized successfully with main branch`);
        return {
            success: true,
            message: 'Git repository initialized with main branch',
            operation: 'created',
            branchName: 'main'
        };
        
    } catch (error) {
        const errorMessage = `Failed to initialize Git repository: ${(error as Error).message}`;
        logger.error(`🌿 [Git Init] ${errorMessage}`);
        return {
            success: false,
            message: errorMessage,
            operation: 'failed',
            error: (error as Error).message
        };
    }
}

/**
 * 🚀 新增：创建 .gitignore 文件，排除不需要同步的文件
 */
export async function createGitIgnoreFile(workspacePath: string): Promise<GitOperationResult> {
    try {
        logger.info(`🌿 [Git Init] Creating .gitignore file in: ${workspacePath}`);
        
        const gitignoreContent = `# Templates (local use only)
.templates/

# VS Code Settings (optional)
.vscode/settings.json

# OS Files
.DS_Store
Thumbs.db

# Temporary Files
*.tmp
*.temp
.cache/
`;
        
        const gitignorePath = path.join(workspacePath, '.gitignore');
        
        // 检查 .gitignore 是否已存在
        if (fs.existsSync(gitignorePath)) {
            logger.info(`🌿 [Git Init] .gitignore file already exists`);
            return {
                success: true,
                message: '.gitignore file already exists',
                operation: 'no-change'
            };
        }
        
        // 创建 .gitignore 文件
        fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
        
        logger.info(`🌿 [Git Init] .gitignore file created successfully`);
        return {
            success: true,
            message: '.gitignore file created successfully',
            operation: 'created'
        };
        
    } catch (error) {
        const errorMessage = `Failed to create .gitignore file: ${(error as Error).message}`;
        logger.error(`🌿 [Git Init] ${errorMessage}`);
        return {
            success: false,
            message: errorMessage,
            operation: 'failed',
            error: (error as Error).message
        };
    }
}

/**
 * 🚀 新增：创建初始提交
 */
export async function createInitialCommit(
    workspacePath: string, 
    message: string = 'init commit'
): Promise<GitOperationResult> {
    try {
        logger.info(`🌿 [Git Init] Creating initial commit in: ${workspacePath}`);
        
        // 1. 检查是否为 Git 仓库
        if (!await checkGitRepository(workspacePath)) {
            const errorMessage = 'Not a Git repository';
            logger.error(`🌿 [Git Init] ${errorMessage}`);
            return {
                success: false,
                message: errorMessage,
                operation: 'failed',
                error: 'NOT_GIT_REPO'
            };
        }
        
        // 2. 添加所有文件到暂存区
        logger.info(`🌿 [Git Init] Adding all files to staging area...`);
        execSync('git add .', { cwd: workspacePath });
        
        // 3. 检查是否有文件需要提交
        try {
            const status = execSync('git status --porcelain', { 
                cwd: workspacePath, 
                encoding: 'utf8' 
            });
            
            if (!status.trim()) {
                logger.info(`🌿 [Git Init] No changes to commit`);
                return {
                    success: true,
                    message: 'No changes to commit',
                    operation: 'no-change'
                };
            }
        } catch (statusError) {
            // 如果获取状态失败，继续尝试提交
            logger.warn(`🌿 [Git Init] Failed to get status, continuing with commit...`);
        }
        
        // 4. 创建初始提交
        logger.info(`🌿 [Git Init] Creating commit with message: "${message}"`);
        execSync(`git commit -m "${message}"`, { cwd: workspacePath });
        
        // 5. 获取提交哈希
        const commitHash = execSync('git rev-parse HEAD', { 
            cwd: workspacePath, 
            encoding: 'utf8' 
        }).trim();
        
        logger.info(`🌿 [Git Init] Initial commit created successfully: ${commitHash}`);
        return {
            success: true,
            message: `Initial commit created: "${message}"`,
            operation: 'created',
            commitHash
        };
        
    } catch (error) {
        const errorMessage = `Failed to create initial commit: ${(error as Error).message}`;
        logger.error(`🌿 [Git Init] ${errorMessage}`);
        return {
            success: false,
            message: errorMessage,
            operation: 'failed',
            error: (error as Error).message
        };
    }
}

/**
 * 工具导出 - 符合注册表格式
 */
export const gitOperationsToolImplementations = {
    checkGitRepository,
    getGitStatus,
    createAutoCommit,
    checkBranchExists,
    getCurrentBranch,
    createProjectBranch,
    initializeGitRepository,
    createGitIgnoreFile,
    createInitialCommit
};