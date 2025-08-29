/**
 * 诊断 Git Commit 失败的原因
 * 
 * 用于调试为什么 createAutoCommit 会失败
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 检查 Git 配置
 */
function checkGitConfig(workDir: string) {
    console.log('\n🔧 检查 Git 配置:');
    
    try {
        // 检查用户名
        const userName = execSync('git config user.name', { 
            cwd: workDir, 
            encoding: 'utf8' 
        }).trim();
        console.log(`  👤 用户名: ${userName}`);
    } catch (error) {
        console.log(`  ❌ 用户名未配置: ${(error as Error).message}`);
        return false;
    }
    
    try {
        // 检查邮箱
        const userEmail = execSync('git config user.email', { 
            cwd: workDir, 
            encoding: 'utf8' 
        }).trim();
        console.log(`  📧 邮箱: ${userEmail}`);
    } catch (error) {
        console.log(`  ❌ 邮箱未配置: ${(error as Error).message}`);
        return false;
    }
    
    return true;
}

/**
 * 检查 Git 仓库状态
 */
function checkGitStatus(workDir: string) {
    console.log('\n📊 检查 Git 仓库状态:');
    
    try {
        // 检查当前分支
        const currentBranch = execSync('git branch --show-current', { 
            cwd: workDir, 
            encoding: 'utf8' 
        }).trim();
        console.log(`  🌿 当前分支: ${currentBranch}`);
        
        // 检查工作区状态
        const status = execSync('git status --porcelain', { 
            cwd: workDir, 
            encoding: 'utf8' 
        }).trim();
        
        if (status) {
            console.log(`  📝 工作区状态:`);
            const lines = status.split('\n');
            lines.forEach(line => {
                const statusCode = line.substring(0, 2);
                const fileName = line.substring(3);
                let statusDesc = '';
                
                if (statusCode[0] === 'A') statusDesc += '已添加 ';
                if (statusCode[0] === 'M') statusDesc += '已修改 ';
                if (statusCode[0] === 'D') statusDesc += '已删除 ';
                if (statusCode[0] === '?') statusDesc += '未跟踪 ';
                
                if (statusCode[1] === 'M') statusDesc += '(工作区修改) ';
                if (statusCode[1] === 'D') statusDesc += '(工作区删除) ';
                
                console.log(`    ${statusCode} ${fileName} - ${statusDesc}`);
            });
        } else {
            console.log(`  ✅ 工作区干净`);
        }
        
        // 检查暂存区
        const staged = execSync('git diff --cached --name-only', { 
            cwd: workDir, 
            encoding: 'utf8' 
        }).trim();
        
        if (staged) {
            console.log(`  📋 暂存区文件:`);
            staged.split('\n').forEach(file => {
                console.log(`    + ${file}`);
            });
        } else {
            console.log(`  📋 暂存区为空`);
        }
        
    } catch (error) {
        console.log(`  ❌ 检查状态失败: ${(error as Error).message}`);
    }
}

/**
 * 尝试模拟提交并诊断失败原因
 */
function diagnoseCommitFailure(workDir: string, message: string) {
    console.log('\n🧪 诊断提交失败原因:');
    console.log(`  📝 提交消息: "${message}"`);
    
    try {
        // 尝试提交
        const result = execSync(`git commit -m "${message}"`, { 
            cwd: workDir, 
            encoding: 'utf8',
            stdio: 'pipe'
        });
        console.log(`  ✅ 提交成功: ${result.trim()}`);
        return true;
    } catch (error: any) {
        console.log(`  ❌ 提交失败:`);
        console.log(`    错误代码: ${error.status}`);
        console.log(`    错误信息: ${error.message}`);
        
        if (error.stderr) {
            console.log(`    stderr: ${error.stderr.toString()}`);
        }
        
        if (error.stdout) {
            console.log(`    stdout: ${error.stdout.toString()}`);
        }
        
        // 分析常见错误
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('user.name') || errorMsg.includes('user.email')) {
            console.log(`  💡 建议: 配置 Git 用户信息`);
            console.log(`    git config user.name "Your Name"`);
            console.log(`    git config user.email "your.email@example.com"`);
        }
        
        if (errorMsg.includes('nothing to commit')) {
            console.log(`  💡 建议: 暂存区为空，没有内容可提交`);
        }
        
        if (errorMsg.includes('merge conflict')) {
            console.log(`  💡 建议: 存在合并冲突，需要先解决冲突`);
        }
        
        return false;
    }
}

/**
 * 提供修复建议
 */
function provideSolutions(workDir: string) {
    console.log('\n💡 修复建议:');
    
    // 检查是否需要配置用户信息
    if (!checkGitConfig(workDir)) {
        console.log('\n🔧 方案1: 配置 Git 用户信息');
        console.log('  在你的工作区根目录执行:');
        console.log('  git config user.name "Your Name"');
        console.log('  git config user.email "your.email@example.com"');
        console.log('  或者配置全局:');
        console.log('  git config --global user.name "Your Name"');
        console.log('  git config --global user.email "your.email@example.com"');
    }
    
    console.log('\n🔧 方案2: 改进错误处理');
    console.log('  修改 createAutoCommit 函数，提供更详细的错误信息');
    
    console.log('\n🔧 方案3: 添加预检查');
    console.log('  在执行 commit 前检查 Git 配置和仓库状态');
}

/**
 * 主诊断函数
 */
export function diagnoseGitCommitIssue() {
    console.log('🚀 开始诊断 Git Commit 失败问题...');
    
    const workDir = process.cwd();
    console.log(`📁 工作目录: ${workDir}`);
    
    // 检查是否为 Git 仓库
    if (!fs.existsSync(path.join(workDir, '.git'))) {
        console.log('❌ 当前目录不是 Git 仓库');
        return;
    }
    
    // 检查 Git 配置
    const hasValidConfig = checkGitConfig(workDir);
    
    // 检查仓库状态
    checkGitStatus(workDir);
    
    // 模拟失败的提交
    const testMessage = "Auto-commit before creating branch for project: CommissionRuleConfig";
    const commitSuccess = diagnoseCommitFailure(workDir, testMessage);
    
    // 提供解决方案
    if (!commitSuccess || !hasValidConfig) {
        provideSolutions(workDir);
    }
    
    console.log('\n🎯 总结:');
    console.log(`  Git 配置: ${hasValidConfig ? '✅ 正常' : '❌ 缺失'}`);
    console.log(`  提交测试: ${commitSuccess ? '✅ 成功' : '❌ 失败'}`);
}

// 如果直接运行此文件
if (require.main === module) {
    diagnoseGitCommitIssue();
}
