/**
 * 测试 getGitStatus 修复
 * 
 * 验证修复后的 getGitStatus 能正确处理前导空格
 */

import { execSync } from 'child_process';

/**
 * 修复前的 getGitStatus 实现（有bug）
 */
function getBuggyGitStatus(projectDir: string) {
    try {
        const result = execSync('git status --porcelain', { 
            cwd: projectDir, 
            encoding: 'utf8' 
        });
        
        // ❌ Bug: trim() 会删除前导空格
        const lines = result.trim().split('\n').filter(line => line.length > 0);
        const hasUnstagedChanges = lines.some(line => line[1] !== ' ');
        const hasStagedChanges = lines.some(line => line[0] !== ' ' && line[0] !== '?');
        
        return {
            hasUnstagedChanges,
            hasStagedChanges,
            isClean: lines.length === 0,
            lines
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
        
        // ✅ 修复：不要 trim() 整个结果，避免删除重要的前导空格
        const lines = result.split('\n').filter(line => line.length > 0);
        const hasUnstagedChanges = lines.some(line => line[1] !== ' ');
        const hasStagedChanges = lines.some(line => line[0] !== ' ' && line[0] !== '?');
        
        return {
            hasUnstagedChanges,
            hasStagedChanges,
            isClean: lines.length === 0,
            lines
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
 * 测试修复效果
 */
function testGitStatusFix() {
    console.log('🧪 测试 getGitStatus 修复效果...');
    
    const testDir = '/Users/kailaichen/Downloads/Source Code/srs-vscode-test';
    console.log(`📁 测试目录: ${testDir}`);
    
    try {
        // 获取原始 git status 输出
        const rawResult = execSync('git status --porcelain', { 
            cwd: testDir, 
            encoding: 'utf8' 
        });
        
        console.log('\n📋 原始 git status --porcelain 输出:');
        console.log(`Raw: ${JSON.stringify(rawResult)}`);
        
        if (rawResult.trim()) {
            rawResult.split('\n').filter(line => line.length > 0).forEach((line, i) => {
                console.log(`  ${i+1}. ${JSON.stringify(line)}`);
                console.log(`     Index: '${line[0]}', WorkTree: '${line[1]}'`);
            });
        }
        
        // 测试修复前的实现
        console.log('\n❌ 修复前的实现 (有bug):');
        const buggyResult = getBuggyGitStatus(testDir);
        console.log(`  hasUnstagedChanges: ${buggyResult.hasUnstagedChanges}`);
        console.log(`  hasStagedChanges: ${buggyResult.hasStagedChanges}`);
        console.log(`  isClean: ${buggyResult.isClean}`);
        console.log(`  处理后的行:`);
        buggyResult.lines.forEach((line, i) => {
            console.log(`    ${i+1}. ${JSON.stringify(line)}`);
        });
        
        // 测试修复后的实现
        console.log('\n✅ 修复后的实现:');
        const fixedResult = getFixedGitStatus(testDir);
        console.log(`  hasUnstagedChanges: ${fixedResult.hasUnstagedChanges}`);
        console.log(`  hasStagedChanges: ${fixedResult.hasStagedChanges}`);
        console.log(`  isClean: ${fixedResult.isClean}`);
        console.log(`  处理后的行:`);
        fixedResult.lines.forEach((line, i) => {
            console.log(`    ${i+1}. ${JSON.stringify(line)}`);
        });
        
        // 分析修复效果
        console.log('\n🔍 修复效果分析:');
        if (buggyResult.hasStagedChanges !== fixedResult.hasStagedChanges) {
            console.log(`  🎯 hasStagedChanges 修复: ${buggyResult.hasStagedChanges} -> ${fixedResult.hasStagedChanges}`);
            if (buggyResult.hasStagedChanges && !fixedResult.hasStagedChanges) {
                console.log(`  ✅ 修复成功！不再错误地认为有暂存更改`);
            }
        } else {
            console.log(`  ⚠️ hasStagedChanges 结果相同: ${buggyResult.hasStagedChanges}`);
        }
        
        if (buggyResult.hasUnstagedChanges !== fixedResult.hasUnstagedChanges) {
            console.log(`  🔄 hasUnstagedChanges 变化: ${buggyResult.hasUnstagedChanges} -> ${fixedResult.hasUnstagedChanges}`);
        }
        
        // 验证期望结果
        console.log('\n🎯 验证期望结果:');
        console.log(`  期望 hasStagedChanges: false (因为暂存区为空)`);
        console.log(`  实际 hasStagedChanges: ${fixedResult.hasStagedChanges}`);
        console.log(`  期望 hasUnstagedChanges: true (因为有工作区修改)`);
        console.log(`  实际 hasUnstagedChanges: ${fixedResult.hasUnstagedChanges}`);
        
        if (!fixedResult.hasStagedChanges && fixedResult.hasUnstagedChanges) {
            console.log(`  🎉 完美！修复后的结果符合期望`);
        } else {
            console.log(`  ⚠️ 结果不符合期望，可能还有其他问题`);
        }
        
    } catch (error) {
        console.error(`❌ 测试失败: ${(error as Error).message}`);
    }
}

// 运行测试
if (require.main === module) {
    testGitStatusFix();
}
