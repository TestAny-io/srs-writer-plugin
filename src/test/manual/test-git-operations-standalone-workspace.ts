/**
 * 独立测试：工作区 Git 初始化功能（不依赖 VS Code）
 * 
 * 直接测试 Git 命令，不依赖 VS Code 环境
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

/**
 * 简单的 logger 替代
 */
const logger = {
    info: (msg: string) => console.log(`ℹ️ ${msg}`),
    warn: (msg: string) => console.log(`⚠️ ${msg}`),
    error: (msg: string) => console.log(`❌ ${msg}`)
};

/**
 * 检查目录是否为 Git 仓库
 */
function checkGitRepository(projectDir: string): boolean {
    try {
        const gitDir = path.join(projectDir, '.git');
        return fs.existsSync(gitDir);
    } catch (error) {
        return false;
    }
}

/**
 * 初始化 Git 仓库并设置 main 分支
 */
function initializeGitRepository(workspacePath: string): {
    success: boolean;
    message: string;
    error?: string;
    operation?: 'created' | 'no-change' | 'failed';
    branchName?: string;
} {
    try {
        logger.info(`🌿 [Git Init] Starting Git repository initialization in: ${workspacePath}`);
        
        // 1. 检查是否已经是 Git 仓库
        if (checkGitRepository(workspacePath)) {
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
 * 创建 .gitignore 文件
 */
function createGitIgnoreFile(workspacePath: string): {
    success: boolean;
    message: string;
    error?: string;
    operation?: 'created' | 'no-change' | 'failed';
} {
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
 * 创建初始提交
 */
function createInitialCommit(
    workspacePath: string, 
    message: string = 'init commit'
): {
    success: boolean;
    message: string;
    error?: string;
    operation?: 'created' | 'no-change' | 'failed';
    commitHash?: string;
} {
    try {
        logger.info(`🌿 [Git Init] Creating initial commit in: ${workspacePath}`);
        
        // 1. 检查是否为 Git 仓库
        if (!checkGitRepository(workspacePath)) {
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
 * 测试完整的工作区 Git 初始化流程
 */
async function testCompleteWorkspaceGitFlow() {
    console.log('🧪 开始测试完整的工作区 Git 初始化流程...');
    
    // 创建临时测试目录
    const testDir = path.join(os.tmpdir(), `srs-workspace-git-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    try {
        console.log(`📁 测试目录: ${testDir}`);
        
        // 模拟 createWorkspaceAndInitialize 的流程
        
        // Step 1: 创建工作区目录结构
        console.log('\n🔬 Step 1: 创建工作区目录结构');
        const templatesDir = path.join(testDir, '.templates');
        fs.mkdirSync(templatesDir, { recursive: true });
        
        // 创建一些模板文件
        const templateFiles = [
            { path: '.templates/srs-template.md', content: '# SRS Template\n\nThis is a template file.' },
            { path: 'README.md', content: '# My SRS Workspace\n\nCreated with SRS Writer Plugin.' },
            { path: 'project-notes.md', content: '# Project Notes\n\nAdd your notes here.' }
        ];
        
        for (const file of templateFiles) {
            const filePath = path.join(testDir, file.path);
            const dir = path.dirname(filePath);
            
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, file.content);
            console.log(`📝 创建文件: ${file.path}`);
        }
        
        // Step 2: Git 仓库初始化
        console.log('\n🔬 Step 2: Git 仓库初始化');
        const initResult = await initializeGitRepository(testDir);
        console.log('初始化结果:', initResult);
        
        if (!initResult.success) {
            throw new Error(`Git 初始化失败: ${initResult.error}`);
        }
        
        // Step 3: 创建 .gitignore 文件
        console.log('\n🔬 Step 3: 创建 .gitignore 文件');
        const gitignoreResult = await createGitIgnoreFile(testDir);
        console.log('.gitignore 结果:', gitignoreResult);
        
        if (!gitignoreResult.success) {
            throw new Error(`创建 .gitignore 失败: ${gitignoreResult.error}`);
        }
        
        // Step 4: 创建初始提交
        console.log('\n🔬 Step 4: 创建初始提交');
        const commitResult = await createInitialCommit(testDir, 'init commit');
        console.log('提交结果:', commitResult);
        
        if (!commitResult.success) {
            throw new Error(`创建初始提交失败: ${commitResult.error}`);
        }
        
        // Step 5: 验证最终状态
        console.log('\n🔬 Step 5: 验证最终状态');
        
        // 检查当前分支
        const currentBranch = execSync('git branch --show-current', { 
            cwd: testDir, 
            encoding: 'utf8' 
        }).trim();
        console.log(`🌿 当前分支: ${currentBranch}`);
        
        if (currentBranch !== 'main') {
            throw new Error(`期望分支为 main，实际为 ${currentBranch}`);
        }
        
        // 检查提交历史
        const commitCount = execSync('git rev-list --count HEAD', { 
            cwd: testDir, 
            encoding: 'utf8' 
        }).trim();
        console.log(`📊 提交数量: ${commitCount}`);
        
        if (commitCount !== '1') {
            throw new Error(`期望 1 个提交，实际为 ${commitCount}`);
        }
        
        // 检查工作区状态
        const status = execSync('git status --porcelain', { 
            cwd: testDir, 
            encoding: 'utf8' 
        }).trim();
        console.log(`🔍 工作区状态: ${status ? '有未提交更改' : '干净'}`);
        
        // 检查 .gitignore 是否被正确应用
        const gitignoreContent = fs.readFileSync(path.join(testDir, '.gitignore'), 'utf8');
        if (!gitignoreContent.includes('.templates/')) {
            throw new Error('.gitignore 不包含 .templates/ 规则');
        }
        
        // 检查 .templates 目录是否被忽略
        const trackedFiles = execSync('git ls-files', { 
            cwd: testDir, 
            encoding: 'utf8' 
        }).trim().split('\n');
        
        const hasTemplateFiles = trackedFiles.some(file => file.startsWith('.templates/'));
        if (hasTemplateFiles) {
            console.log('⚠️ 警告: .templates 文件被跟踪了，但应该被忽略');
        } else {
            console.log('✅ .templates 文件正确被忽略');
        }
        
        console.log('\n🎉 完整流程测试成功！');
        
        // 显示最终的文件结构
        console.log('\n📂 最终文件结构:');
        const allFiles = execSync('find . -type f | head -20', { 
            cwd: testDir, 
            encoding: 'utf8' 
        }).trim().split('\n');
        allFiles.forEach(file => console.log(`  ${file}`));
        
    } catch (error) {
        console.error('\n❌ 测试失败:', (error as Error).message);
        throw error;
    } finally {
        // 清理测试目录
        try {
            fs.rmSync(testDir, { recursive: true, force: true });
            console.log(`\n🧹 清理测试目录: ${testDir}`);
        } catch (cleanupError) {
            console.log('⚠️ 清理测试目录失败:', (cleanupError as Error).message);
        }
    }
}

/**
 * 测试边界情况
 */
async function testEdgeCases() {
    console.log('\n🧪 开始测试边界情况...');
    
    // 测试1: 在已有 Git 仓库的目录中初始化
    console.log('\n🔬 测试1: 在已有 Git 仓库的目录中初始化');
    const existingGitDir = path.join(os.tmpdir(), `existing-git-${Date.now()}`);
    fs.mkdirSync(existingGitDir, { recursive: true });
    
    try {
        // 先手动创建一个 Git 仓库
        execSync('git init', { cwd: existingGitDir });
        
        // 然后测试我们的函数
        const result = await initializeGitRepository(existingGitDir);
        console.log('结果:', result);
        
        if (result.operation === 'no-change') {
            console.log('✅ 已有 Git 仓库正确处理');
        } else {
            throw new Error('已有 Git 仓库处理异常');
        }
        
    } finally {
        fs.rmSync(existingGitDir, { recursive: true, force: true });
    }
    
    // 测试2: 重复创建 .gitignore
    console.log('\n🔬 测试2: 重复创建 .gitignore');
    const testDir2 = path.join(os.tmpdir(), `gitignore-test-${Date.now()}`);
    fs.mkdirSync(testDir2, { recursive: true });
    
    try {
        // 先创建一个 .gitignore
        const result1 = await createGitIgnoreFile(testDir2);
        console.log('第一次创建:', result1);
        
        // 再次创建
        const result2 = await createGitIgnoreFile(testDir2);
        console.log('第二次创建:', result2);
        
        if (result2.operation === 'no-change') {
            console.log('✅ 重复创建 .gitignore 正确处理');
        } else {
            throw new Error('重复创建 .gitignore 处理异常');
        }
        
    } finally {
        fs.rmSync(testDir2, { recursive: true, force: true });
    }
    
    console.log('\n🎉 边界情况测试完成！');
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('🚀 开始运行工作区 Git 初始化的完整测试套件...\n');
    
    try {
        await testCompleteWorkspaceGitFlow();
        await testEdgeCases();
        
        console.log('\n✅ 所有测试通过！Git 初始化功能工作正常。');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    runAllTests().catch(console.error);
}
