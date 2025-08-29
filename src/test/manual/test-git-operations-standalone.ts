/**
 * 独立测试：Git 操作功能（不依赖 VS Code）
 * 
 * 测试 Git 操作的核心逻辑
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * 简化的 Git 操作函数（不依赖 Logger）
 */

/**
 * 检查目录是否为 Git 仓库
 */
async function checkGitRepository(projectDir: string): Promise<boolean> {
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
async function getGitStatus(projectDir: string): Promise<{
    hasUnstagedChanges: boolean;
    hasStagedChanges: boolean;
    isClean: boolean;
}> {
    try {
        const result = execSync('git status --porcelain', { 
            cwd: projectDir, 
            encoding: 'utf8' 
        });
        
        const lines = result.trim().split('\n').filter(line => line.length > 0);
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
async function createAutoCommit(projectDir: string, message: string): Promise<{
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
async function checkBranchExists(projectDir: string, branchName: string): Promise<boolean> {
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
async function getCurrentBranch(projectDir: string): Promise<string | null> {
    try {
        const result = execSync('git branch --show-current', { 
            cwd: projectDir, 
            encoding: 'utf8' 
        });
        return result.trim() || null;
    } catch (error) {
        console.warn(`Failed to get current branch: ${(error as Error).message}`);
        return null;
    }
}

/**
 * 创建并切换到项目分支（核心功能）
 */
async function createProjectBranch(
    projectDir: string, 
    projectName: string
): Promise<{
    success: boolean;
    message: string;
    error?: string;
    branchName?: string;
    wasCreated?: boolean;
    wasSwitched?: boolean;
    commitCreated?: boolean;
    commitHash?: string;
}> {
    const branchName = `SRS/${projectName}`;
    
    try {
        console.log(`🌿 [Git] Starting branch operation for project: ${projectName}`);
        
        // 1. 检查是否为 Git 仓库
        if (!await checkGitRepository(projectDir)) {
            console.warn(`🌿 [Git] Directory ${projectDir} is not a Git repository`);
            return {
                success: false,
                message: `Directory is not a Git repository`,
                error: 'NOT_GIT_REPO'
            };
        }

        // 获取当前分支信息
        const currentBranch = await getCurrentBranch(projectDir);
        console.log(`🌿 [Git] Current branch: ${currentBranch || 'unknown'}`);

        // 2. 检查分支是否已存在
        const branchExists = await checkBranchExists(projectDir, branchName);
        if (branchExists) {
            // 分支已存在，直接切换
            console.log(`🌿 [Git] Branch ${branchName} already exists, switching to it`);
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
        console.log(`🌿 [Git] Working directory status - Clean: ${gitStatus.isClean}, Staged: ${gitStatus.hasStagedChanges}, Unstaged: ${gitStatus.hasUnstagedChanges}`);
        
        let commitResult: { success: boolean; commitHash?: string; error?: string } | null = null;

        // 4. 处理已 stage 的更改：先提交
        if (gitStatus.hasStagedChanges) {
            console.log(`🌿 [Git] Found staged changes, creating auto-commit before branch creation`);
            const commitMessage = `Auto-commit before creating branch for project: ${projectName}`;
            commitResult = await createAutoCommit(projectDir, commitMessage);
            
            if (!commitResult.success) {
                console.error(`🌿 [Git] Failed to create auto-commit: ${commitResult.error}`);
                return {
                    success: false,
                    message: `Failed to commit staged changes before creating branch`,
                    error: commitResult.error
                };
            }
            
            console.log(`🌿 [Git] Created auto-commit ${commitResult.commitHash}`);
        }

        // 5. 创建并切换到新分支
        console.log(`🌿 [Git] Creating and switching to new branch: ${branchName}`);
        execSync(`git checkout -b "${branchName}"`, { cwd: projectDir });

        const resultMessage = `Successfully created and switched to branch ${branchName}`;
        console.log(`🌿 [Git] ${resultMessage}`);

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
        console.error(`🌿 [Git] ${errorMessage}`);
        return {
            success: false,
            message: errorMessage,
            error: (error as Error).message
        };
    }
}

/**
 * 测试环境设置
 */
async function setupTestEnvironment(): Promise<string> {
    const testDir = path.join(__dirname, '../../../test-temp/git-test-project');
    
    // 清理旧的测试目录
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    // 创建新的测试目录
    fs.mkdirSync(testDir, { recursive: true });
    
    // 初始化 Git 仓库
    execSync('git init', { cwd: testDir });
    execSync('git config user.name "Test User"', { cwd: testDir });
    execSync('git config user.email "test@example.com"', { cwd: testDir });
    
    // 创建初始文件和提交
    fs.writeFileSync(path.join(testDir, 'README.md'), '# Test Project\n\nThis is a test project.');
    execSync('git add README.md', { cwd: testDir });
    execSync('git commit -m "Initial commit"', { cwd: testDir });
    
    console.log(`✅ Test environment setup complete: ${testDir}`);
    return testDir;
}

/**
 * 测试场景1：在干净的 main 分支上创建项目分支
 */
async function testCleanMainBranch() {
    console.log('\n🧪 Testing: Clean main branch scenario');
    
    const testDir = await setupTestEnvironment();
    
    try {
        // 验证初始状态
        const isGitRepo = await checkGitRepository(testDir);
        const currentBranch = await getCurrentBranch(testDir);
        const gitStatus = await getGitStatus(testDir);
        
        console.log(`📋 Initial state:`);
        console.log(`  - Is Git repo: ${isGitRepo}`);
        console.log(`  - Current branch: ${currentBranch}`);
        console.log(`  - Is clean: ${gitStatus.isClean}`);
        
        // 创建项目分支
        const result = await createProjectBranch(testDir, 'TestProject');
        
        console.log(`📋 Result:`);
        console.log(`  - Success: ${result.success}`);
        console.log(`  - Message: ${result.message}`);
        console.log(`  - Branch name: ${result.branchName}`);
        console.log(`  - Was created: ${result.wasCreated}`);
        console.log(`  - Was switched: ${result.wasSwitched}`);
        
        // 验证结果
        const newBranch = await getCurrentBranch(testDir);
        console.log(`  - Current branch after: ${newBranch}`);
        
        if (result.success && newBranch === 'SRS/TestProject') {
            console.log('✅ Test PASSED: Clean main branch scenario');
            return true;
        } else {
            console.log('❌ Test FAILED: Clean main branch scenario');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test ERROR:', error);
        return false;
    }
}

/**
 * 测试场景2：有已 stage 更改时创建分支
 */
async function testWithStagedChanges() {
    console.log('\n🧪 Testing: Staged changes scenario');
    
    const testDir = await setupTestEnvironment();
    
    try {
        // 创建并 stage 更改
        fs.writeFileSync(path.join(testDir, 'staged-file.txt'), 'This file will be staged.');
        execSync('git add staged-file.txt', { cwd: testDir });
        
        // 验证状态
        const gitStatus = await getGitStatus(testDir);
        console.log(`📋 Before branch creation:`);
        console.log(`  - Has staged changes: ${gitStatus.hasStagedChanges}`);
        console.log(`  - Has unstaged changes: ${gitStatus.hasUnstagedChanges}`);
        
        // 创建项目分支
        const result = await createProjectBranch(testDir, 'TestProjectWithStaged');
        
        console.log(`📋 Result:`);
        console.log(`  - Success: ${result.success}`);
        console.log(`  - Message: ${result.message}`);
        console.log(`  - Commit created: ${result.commitCreated}`);
        console.log(`  - Commit hash: ${result.commitHash}`);
        
        // 验证提交是否创建
        if (result.success && result.commitCreated) {
            console.log('✅ Test PASSED: Staged changes auto-committed');
            return true;
        } else {
            console.log('❌ Test FAILED: Staged changes scenario');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test ERROR:', error);
        return false;
    }
}

/**
 * 测试场景3：分支已存在时的处理
 */
async function testExistingBranch() {
    console.log('\n🧪 Testing: Existing branch scenario');
    
    const testDir = await setupTestEnvironment();
    
    try {
        // 先创建分支
        execSync('git checkout -b SRS/ExistingProject', { cwd: testDir });
        execSync('git checkout main', { cwd: testDir });
        
        // 验证分支存在
        const branchExists = await checkBranchExists(testDir, 'SRS/ExistingProject');
        console.log(`📋 Branch exists: ${branchExists}`);
        
        // 尝试创建同名分支
        const result = await createProjectBranch(testDir, 'ExistingProject');
        
        console.log(`📋 Result:`);
        console.log(`  - Success: ${result.success}`);
        console.log(`  - Message: ${result.message}`);
        console.log(`  - Was created: ${result.wasCreated}`);
        console.log(`  - Was switched: ${result.wasSwitched}`);
        
        if (result.success && !result.wasCreated && result.wasSwitched) {
            console.log('✅ Test PASSED: Existing branch handled correctly');
            return true;
        } else {
            console.log('❌ Test FAILED: Existing branch scenario');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test ERROR:', error);
        return false;
    }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('🚀 Starting Git branch creation tests...\n');
    
    const results = [
        await testCleanMainBranch(),
        await testWithStagedChanges(),
        await testExistingBranch()
    ];
    
    const passedTests = results.filter(r => r).length;
    const totalTests = results.length;
    
    console.log(`\n🏁 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests PASSED!');
    } else {
        console.log('⚠️ Some tests FAILED!');
    }
    
    return passedTests === totalTests;
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    runAllTests().catch(console.error);
}

export { runAllTests };
