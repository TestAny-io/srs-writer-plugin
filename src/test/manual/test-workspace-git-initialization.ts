/**
 * 手动测试：工作区 Git 初始化功能
 * 
 * 测试 createWorkspaceAndInitialize 功能中的 Git 初始化增强
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
    initializeGitRepository, 
    createGitIgnoreFile, 
    createInitialCommit,
    checkGitRepository 
} from '../../tools/atomic/git-operations';

/**
 * 测试 Git 仓库初始化
 */
export async function testGitRepositoryInitialization() {
    console.log('🧪 开始测试 Git 仓库初始化功能...');
    
    // 创建临时测试目录
    const testDir = path.join(os.tmpdir(), `srs-git-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    try {
        console.log(`📁 测试目录: ${testDir}`);
        
        // 测试1: 初始化 Git 仓库
        console.log('\n🔬 测试1: 初始化 Git 仓库');
        const initResult = await initializeGitRepository(testDir);
        console.log('结果:', initResult);
        
        if (initResult.success) {
            console.log('✅ Git 仓库初始化成功');
            
            // 验证 .git 目录是否存在
            const gitDirExists = fs.existsSync(path.join(testDir, '.git'));
            console.log(`📂 .git 目录存在: ${gitDirExists}`);
            
            // 验证是否为 Git 仓库
            const isGitRepo = await checkGitRepository(testDir);
            console.log(`🔍 Git 仓库检查: ${isGitRepo}`);
        } else {
            console.log('❌ Git 仓库初始化失败:', initResult.error);
        }
        
        // 测试2: 重复初始化（应该返回 no-change）
        console.log('\n🔬 测试2: 重复初始化 Git 仓库');
        const duplicateInitResult = await initializeGitRepository(testDir);
        console.log('结果:', duplicateInitResult);
        
        if (duplicateInitResult.operation === 'no-change') {
            console.log('✅ 重复初始化正确处理');
        } else {
            console.log('❌ 重复初始化处理异常');
        }
        
        // 测试3: 创建 .gitignore 文件
        console.log('\n🔬 测试3: 创建 .gitignore 文件');
        const gitignoreResult = await createGitIgnoreFile(testDir);
        console.log('结果:', gitignoreResult);
        
        if (gitignoreResult.success) {
            console.log('✅ .gitignore 文件创建成功');
            
            // 验证 .gitignore 文件内容
            const gitignorePath = path.join(testDir, '.gitignore');
            if (fs.existsSync(gitignorePath)) {
                const content = fs.readFileSync(gitignorePath, 'utf8');
                console.log('📄 .gitignore 内容预览:');
                console.log(content.split('\n').slice(0, 5).join('\n') + '...');
                
                // 检查是否包含关键内容
                const hasTemplates = content.includes('.templates/');
                const hasOSFiles = content.includes('.DS_Store');
                console.log(`🔍 包含 .templates/: ${hasTemplates}`);
                console.log(`🔍 包含 OS 文件: ${hasOSFiles}`);
            }
        } else {
            console.log('❌ .gitignore 文件创建失败:', gitignoreResult.error);
        }
        
        // 测试4: 创建一些测试文件
        console.log('\n🔬 测试4: 创建测试文件');
        const testFiles = [
            'README.md',
            'test.txt',
            '.templates/example.md'
        ];
        
        for (const file of testFiles) {
            const filePath = path.join(testDir, file);
            const dir = path.dirname(filePath);
            
            // 确保目录存在
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // 创建文件
            const content = file === 'README.md' 
                ? '# Test Workspace\n\nThis is a test workspace for SRS Writer.'
                : file === '.templates/example.md'
                ? '# Example Template\n\nThis is an example template file.'
                : 'This is a test file.';
                
            fs.writeFileSync(filePath, content);
            console.log(`📝 创建文件: ${file}`);
        }
        
        // 测试5: 创建初始提交
        console.log('\n🔬 测试5: 创建初始提交');
        const commitResult = await createInitialCommit(testDir, 'init commit');
        console.log('结果:', commitResult);
        
        if (commitResult.success) {
            console.log('✅ 初始提交创建成功');
            console.log(`📝 提交哈希: ${commitResult.commitHash}`);
        } else {
            console.log('❌ 初始提交创建失败:', commitResult.error);
        }
        
        // 测试6: 验证 Git 状态
        console.log('\n🔬 测试6: 验证最终 Git 状态');
        try {
            const { execSync } = require('child_process');
            
            // 检查当前分支
            const currentBranch = execSync('git branch --show-current', { 
                cwd: testDir, 
                encoding: 'utf8' 
            }).trim();
            console.log(`🌿 当前分支: ${currentBranch}`);
            
            // 检查提交历史
            const commitCount = execSync('git rev-list --count HEAD', { 
                cwd: testDir, 
                encoding: 'utf8' 
            }).trim();
            console.log(`📊 提交数量: ${commitCount}`);
            
            // 检查工作区状态
            const status = execSync('git status --porcelain', { 
                cwd: testDir, 
                encoding: 'utf8' 
            }).trim();
            console.log(`🔍 工作区状态: ${status ? '有未提交更改' : '干净'}`);
            
        } catch (gitError) {
            console.log('❌ Git 状态检查失败:', (gitError as Error).message);
        }
        
        console.log('\n🎉 测试完成！');
        
    } finally {
        // 清理测试目录
        try {
            fs.rmSync(testDir, { recursive: true, force: true });
            console.log(`🧹 清理测试目录: ${testDir}`);
        } catch (cleanupError) {
            console.log('⚠️ 清理测试目录失败:', (cleanupError as Error).message);
        }
    }
}

/**
 * 测试边界情况
 */
export async function testEdgeCases() {
    console.log('\n🧪 开始测试边界情况...');
    
    // 测试1: 在不存在的目录中初始化
    console.log('\n🔬 测试1: 在不存在的目录中初始化');
    const nonExistentDir = path.join(os.tmpdir(), 'non-existent-dir');
    const result1 = await initializeGitRepository(nonExistentDir);
    console.log('结果:', result1);
    
    // 测试2: 在只读目录中初始化（如果可能的话）
    console.log('\n🔬 测试2: 权限测试（跳过，避免系统问题）');
    
    // 测试3: 在已有 Git 仓库的目录中初始化
    console.log('\n🔬 测试3: 在已有 Git 仓库的目录中初始化');
    const existingGitDir = path.join(os.tmpdir(), `existing-git-${Date.now()}`);
    fs.mkdirSync(existingGitDir, { recursive: true });
    
    try {
        // 先手动创建一个 Git 仓库
        const { execSync } = require('child_process');
        execSync('git init', { cwd: existingGitDir });
        
        // 然后测试我们的函数
        const result3 = await initializeGitRepository(existingGitDir);
        console.log('结果:', result3);
        
        if (result3.operation === 'no-change') {
            console.log('✅ 已有 Git 仓库正确处理');
        } else {
            console.log('❌ 已有 Git 仓库处理异常');
        }
        
    } finally {
        fs.rmSync(existingGitDir, { recursive: true, force: true });
    }
    
    console.log('\n🎉 边界情况测试完成！');
}

/**
 * 运行所有测试
 */
export async function runAllGitInitTests() {
    console.log('🚀 开始运行 Git 初始化功能的完整测试套件...\n');
    
    try {
        await testGitRepositoryInitialization();
        await testEdgeCases();
        
        console.log('\n✅ 所有测试完成！');
        
    } catch (error) {
        console.error('\n❌ 测试过程中发生错误:', error);
    }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    runAllGitInitTests().catch(console.error);
}
