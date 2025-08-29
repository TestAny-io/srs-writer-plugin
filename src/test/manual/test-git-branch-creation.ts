/**
 * 手动测试：Git 分支创建功能
 * 
 * 测试 createNewProjectFolder 工具中的 Git 分支创建功能
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { 
    createProjectBranch, 
    checkGitRepository, 
    getGitStatus, 
    getCurrentBranch,
    checkBranchExists 
} from '../../tools/atomic/git-operations';

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
        } else {
            console.log('❌ Test FAILED: Clean main branch scenario');
        }
        
    } catch (error) {
        console.error('❌ Test ERROR:', error);
    }
}

/**
 * 测试场景2：有未 stage 更改时创建分支
 */
async function testWithUnstagedChanges() {
    console.log('\n🧪 Testing: Unstaged changes scenario');
    
    const testDir = await setupTestEnvironment();
    
    try {
        // 创建未 stage 的更改
        fs.writeFileSync(path.join(testDir, 'new-file.txt'), 'This is a new file with unstaged changes.');
        fs.appendFileSync(path.join(testDir, 'README.md'), '\n\nThis is an unstaged change.');
        
        // 验证状态
        const gitStatus = await getGitStatus(testDir);
        console.log(`📋 Before branch creation:`);
        console.log(`  - Has unstaged changes: ${gitStatus.hasUnstagedChanges}`);
        console.log(`  - Has staged changes: ${gitStatus.hasStagedChanges}`);
        console.log(`  - Is clean: ${gitStatus.isClean}`);
        
        // 创建项目分支
        const result = await createProjectBranch(testDir, 'TestProjectWithChanges');
        
        console.log(`📋 Result:`);
        console.log(`  - Success: ${result.success}`);
        console.log(`  - Message: ${result.message}`);
        console.log(`  - Branch name: ${result.branchName}`);
        
        // 验证更改是否跟随到新分支
        const statusAfter = await getGitStatus(testDir);
        console.log(`📋 After branch creation:`);
        console.log(`  - Has unstaged changes: ${statusAfter.hasUnstagedChanges}`);
        console.log(`  - Current branch: ${await getCurrentBranch(testDir)}`);
        
        if (result.success && statusAfter.hasUnstagedChanges) {
            console.log('✅ Test PASSED: Unstaged changes followed to new branch');
        } else {
            console.log('❌ Test FAILED: Unstaged changes scenario');
        }
        
    } catch (error) {
        console.error('❌ Test ERROR:', error);
    }
}

/**
 * 测试场景3：有已 stage 更改时创建分支
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
        } else {
            console.log('❌ Test FAILED: Staged changes scenario');
        }
        
    } catch (error) {
        console.error('❌ Test ERROR:', error);
    }
}

/**
 * 测试场景4：分支已存在时的处理
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
        } else {
            console.log('❌ Test FAILED: Existing branch scenario');
        }
        
    } catch (error) {
        console.error('❌ Test ERROR:', error);
    }
}

/**
 * 测试场景5：非 Git 仓库的处理
 */
async function testNonGitRepository() {
    console.log('\n🧪 Testing: Non-Git repository scenario');
    
    const testDir = path.join(__dirname, '../../../test-temp/non-git-project');
    
    // 创建非 Git 目录
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    
    try {
        // 尝试在非 Git 目录创建分支
        const result = await createProjectBranch(testDir, 'NonGitProject');
        
        console.log(`📋 Result:`);
        console.log(`  - Success: ${result.success}`);
        console.log(`  - Message: ${result.message}`);
        console.log(`  - Error: ${result.error}`);
        
        if (!result.success && result.error === 'NOT_GIT_REPO') {
            console.log('✅ Test PASSED: Non-Git repository handled correctly');
        } else {
            console.log('❌ Test FAILED: Non-Git repository scenario');
        }
        
    } catch (error) {
        console.error('❌ Test ERROR:', error);
    }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('🚀 Starting Git branch creation tests...\n');
    
    await testCleanMainBranch();
    await testWithUnstagedChanges();
    await testWithStagedChanges();
    await testExistingBranch();
    await testNonGitRepository();
    
    console.log('\n🏁 All tests completed!');
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    runAllTests().catch(console.error);
}

export {
    runAllTests,
    testCleanMainBranch,
    testWithUnstagedChanges,
    testWithStagedChanges,
    testExistingBranch,
    testNonGitRepository
};
