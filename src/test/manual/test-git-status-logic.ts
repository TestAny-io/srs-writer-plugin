/**
 * 测试和修复 getGitStatus 函数的逻辑
 */

import { execSync } from 'child_process';

/**
 * 当前有问题的 getGitStatus 实现
 */
function getCurrentGitStatus(projectDir: string) {
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
            isClean: lines.length === 0,
            lines // 用于调试
        };
    } catch (error) {
        return {
            hasUnstagedChanges: false,
            hasStagedChanges: false,
            isClean: true,
            lines: []
        };
    }
}

/**
 * 修复后的 getGitStatus 实现
 */
function getFixedGitStatus(projectDir: string) {
    try {
        const result = execSync('git status --porcelain', { 
            cwd: projectDir, 
            encoding: 'utf8' 
        });
        
        const lines = result.trim().split('\n').filter(line => line.length > 0);
        
        // 🔧 修复：正确解析 git status --porcelain 格式
        // 格式：XY filename
        // X = 暂存区状态，Y = 工作区状态
        // ' ' = 无更改，'M' = 修改，'A' = 添加，'D' = 删除，'?' = 未跟踪
        
        const hasUnstagedChanges = lines.some(line => {
            const workingTreeStatus = line[1];
            return workingTreeStatus !== ' ';
        });
        
        const hasStagedChanges = lines.some(line => {
            const indexStatus = line[0];
            return indexStatus !== ' ' && indexStatus !== '?';
        });
        
        return {
            hasUnstagedChanges,
            hasStagedChanges,
            isClean: lines.length === 0,
            lines // 用于调试
        };
    } catch (error) {
        return {
            hasUnstagedChanges: false,
            hasStagedChanges: false,
            isClean: true,
            lines: []
        };
    }
}

/**
 * 测试和对比两种实现
 */
function testGitStatusLogic() {
    console.log('🧪 测试 Git Status 逻辑...');
    
    const workDir = process.cwd();
    console.log(`📁 工作目录: ${workDir}`);
    
    // 获取原始的 git status 输出
    try {
        const rawStatus = execSync('git status --porcelain', { 
            cwd: workDir, 
            encoding: 'utf8' 
        });
        
        console.log('\n📋 原始 git status --porcelain 输出:');
        if (rawStatus.trim()) {
            rawStatus.trim().split('\n').forEach((line, index) => {
                const indexStatus = line[0];
                const workingTreeStatus = line[1];
                const filename = line.substring(3);
                console.log(`  ${index + 1}. "${indexStatus}${workingTreeStatus}" ${filename}`);
                console.log(`     暂存区: "${indexStatus}" | 工作区: "${workingTreeStatus}"`);
            });
        } else {
            console.log('  (无输出 - 工作区干净)');
        }
        
        // 测试当前实现
        console.log('\n❌ 当前实现结果:');
        const currentResult = getCurrentGitStatus(workDir);
        console.log(`  hasUnstagedChanges: ${currentResult.hasUnstagedChanges}`);
        console.log(`  hasStagedChanges: ${currentResult.hasStagedChanges}`);
        console.log(`  isClean: ${currentResult.isClean}`);
        
        // 测试修复后实现
        console.log('\n✅ 修复后实现结果:');
        const fixedResult = getFixedGitStatus(workDir);
        console.log(`  hasUnstagedChanges: ${fixedResult.hasUnstagedChanges}`);
        console.log(`  hasStagedChanges: ${fixedResult.hasStagedChanges}`);
        console.log(`  isClean: ${fixedResult.isClean}`);
        
        // 对比差异
        console.log('\n🔍 差异分析:');
        if (currentResult.hasStagedChanges !== fixedResult.hasStagedChanges) {
            console.log(`  🚨 hasStagedChanges 不一致: ${currentResult.hasStagedChanges} -> ${fixedResult.hasStagedChanges}`);
        }
        if (currentResult.hasUnstagedChanges !== fixedResult.hasUnstagedChanges) {
            console.log(`  🚨 hasUnstagedChanges 不一致: ${currentResult.hasUnstagedChanges} -> ${fixedResult.hasUnstagedChanges}`);
        }
        if (currentResult.isClean !== fixedResult.isClean) {
            console.log(`  🚨 isClean 不一致: ${currentResult.isClean} -> ${fixedResult.isClean}`);
        }
        
        // 验证修复是否解决了问题
        console.log('\n🎯 问题验证:');
        if (currentResult.hasStagedChanges && !fixedResult.hasStagedChanges) {
            console.log('  ✅ 修复成功！原来错误地认为有暂存更改，现在正确识别为无暂存更改');
        } else if (currentResult.hasStagedChanges === fixedResult.hasStagedChanges) {
            console.log('  ⚠️ 两种实现结果相同，可能不是这个问题');
        }
        
    } catch (error) {
        console.log(`❌ 测试失败: ${(error as Error).message}`);
    }
}

// 运行测试
if (require.main === module) {
    testGitStatusLogic();
}
