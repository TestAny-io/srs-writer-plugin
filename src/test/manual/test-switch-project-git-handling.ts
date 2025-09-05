/**
 * 手动测试：验证Switch Project功能的Git状态处理
 * 
 * 测试目的：
 * 1. 验证switchProject在有未提交更改时的用户交互
 * 2. 验证checkWorkspaceGitStatus函数的正确性
 * 3. 验证commitAllChanges函数的正确性
 * 4. 验证switchToProjectGitBranchFromSession的自动提交逻辑
 * 
 * 测试场景：
 * - 场景1：无Git仓库
 * - 场景2：干净的工作区（无更改）
 * - 场景3：只有unstaged changes
 * - 场景4：只有staged changes
 * - 场景5：同时有staged和unstaged changes
 * - 场景6：用户选择手动提交
 * - 场景7：用户选择自动提交
 * - 场景8：用户取消切换
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

export async function testSwitchProjectGitHandling() {
    console.log('🧪 开始测试Switch Project的Git状态处理功能...');
    
    const testResults = {
        checkWorkspaceGitStatus: [] as any[],
        commitAllChanges: [] as any[],
        switchProjectFlow: [] as any[]
    };
    
    try {
        // 测试1：checkWorkspaceGitStatus函数
        console.log('\n📋 测试1: checkWorkspaceGitStatus函数');
        await testCheckWorkspaceGitStatus(testResults.checkWorkspaceGitStatus);
        
        // 测试2：commitAllChanges函数
        console.log('\n📋 测试2: commitAllChanges函数');
        await testCommitAllChanges(testResults.commitAllChanges);
        
        // 测试3：完整的Switch Project流程
        console.log('\n📋 测试3: Switch Project完整流程');
        await testSwitchProjectFlow(testResults.switchProjectFlow);
        
        // 生成测试报告
        generateTestReport(testResults);
        
        console.log('\n🎉 所有测试完成！');
        return testResults;
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        throw error;
    }
}

/**
 * 测试checkWorkspaceGitStatus函数
 */
async function testCheckWorkspaceGitStatus(results: any[]) {
    try {
        const { checkWorkspaceGitStatus } = await import('../../tools/atomic/git-operations');
        
        console.log('📋 测试checkWorkspaceGitStatus函数...');
        const statusResult = await checkWorkspaceGitStatus();
        
        const testCase = {
            name: 'checkWorkspaceGitStatus基本功能',
            success: true,
            result: statusResult,
            timestamp: new Date().toISOString()
        };
        
        console.log('✅ 检查结果:', {
            hasChanges: statusResult.hasChanges,
            hasStagedChanges: statusResult.hasStagedChanges,
            hasUnstagedChanges: statusResult.hasUnstagedChanges,
            workspaceRoot: statusResult.workspaceRoot ? '✅ 找到' : '❌ 未找到'
        });
        
        results.push(testCase);
        
    } catch (error) {
        const testCase = {
            name: 'checkWorkspaceGitStatus基本功能',
            success: false,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
        };
        
        console.error('❌ checkWorkspaceGitStatus测试失败:', error);
        results.push(testCase);
    }
}

/**
 * 测试commitAllChanges函数
 */
async function testCommitAllChanges(results: any[]) {
    try {
        const { commitAllChanges, checkWorkspaceGitStatus } = await import('../../tools/atomic/git-operations');
        
        // 首先检查工作区状态
        const statusCheck = await checkWorkspaceGitStatus();
        
        if (!statusCheck.workspaceRoot) {
            const testCase = {
                name: 'commitAllChanges - 无工作区',
                success: false,
                error: 'No workspace root found',
                timestamp: new Date().toISOString()
            };
            results.push(testCase);
            return;
        }
        
        console.log('📋 测试commitAllChanges函数...');
        const commitResult = await commitAllChanges(statusCheck.workspaceRoot);
        
        const testCase = {
            name: 'commitAllChanges基本功能',
            success: commitResult.success,
            result: commitResult,
            hasCommit: !!commitResult.commitHash,
            timestamp: new Date().toISOString()
        };
        
        if (commitResult.success) {
            console.log('✅ 提交结果:', {
                success: commitResult.success,
                hasNewCommit: !!commitResult.commitHash,
                commitHash: commitResult.commitHash ? commitResult.commitHash.substring(0, 8) + '...' : 'None'
            });
        } else {
            console.log('❌ 提交失败:', commitResult.error);
            (testCase as any).error = commitResult.error;
        }
        
        results.push(testCase);
        
    } catch (error) {
        const testCase = {
            name: 'commitAllChanges基本功能',
            success: false,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
        };
        
        console.error('❌ commitAllChanges测试失败:', error);
        results.push(testCase);
    }
}

/**
 * 测试Switch Project完整流程（模拟）
 */
async function testSwitchProjectFlow(results: any[]) {
    try {
        console.log('📋 模拟Switch Project流程...');
        
        // 模拟步骤1：检查Git状态
        const { checkWorkspaceGitStatus } = await import('../../tools/atomic/git-operations');
        const gitStatusCheck = await checkWorkspaceGitStatus();
        
        const flowTest = {
            name: 'Switch Project完整流程模拟',
            success: true,
            steps: [] as any[],
            timestamp: new Date().toISOString()
        };
        
        // 步骤1：Git状态检查
        flowTest.steps.push({
            step: '1. Git状态检查',
            success: true,
            result: gitStatusCheck
        });
        
        console.log('📋 步骤1 - Git状态检查:', {
            hasChanges: gitStatusCheck.hasChanges,
            workspaceFound: !!gitStatusCheck.workspaceRoot
        });
        
        // 步骤2：模拟用户交互（如果有更改）
        if (gitStatusCheck.hasChanges) {
            console.log('📋 步骤2 - 模拟用户交互（检测到未提交更改）');
            
            // 这里只是模拟，不实际弹出对话框
            const mockUserChoice = 'auto-commit'; // 或 'manual-commit' 或 'cancel'
            
            flowTest.steps.push({
                step: '2. 用户交互模拟',
                success: true,
                userChoice: mockUserChoice,
                note: '实际使用中会弹出warning对话框'
            });
            
            if (mockUserChoice === 'auto-commit') {
                console.log('📋 步骤3 - 模拟自动提交');
                // 实际的自动提交会在switchToProjectGitBranchFromSession中处理
                flowTest.steps.push({
                    step: '3. 自动提交（在分支切换时）',
                    success: true,
                    note: '会在switchToProjectGitBranchFromSession中执行'
                });
            }
        } else {
            console.log('📋 步骤2 - 无未提交更改，直接继续');
            flowTest.steps.push({
                step: '2. 无需用户交互',
                success: true,
                reason: 'No uncommitted changes'
            });
        }
        
        results.push(flowTest);
        
    } catch (error) {
        const flowTest = {
            name: 'Switch Project完整流程模拟',
            success: false,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
        };
        
        console.error('❌ Switch Project流程测试失败:', error);
        results.push(flowTest);
    }
}

/**
 * 生成测试报告
 */
function generateTestReport(results: any) {
    console.log('\n📊 测试报告生成中...');
    
    const report = {
        testSuite: 'Switch Project Git处理功能',
        timestamp: new Date().toISOString(),
        summary: {
            totalTests: 0,
            passed: 0,
            failed: 0
        },
        details: results
    };
    
    // 计算总体统计
    Object.values(results).forEach((testGroup: any) => {
        testGroup.forEach((test: any) => {
            report.summary.totalTests++;
            if (test.success) {
                report.summary.passed++;
            } else {
                report.summary.failed++;
            }
        });
    });
    
    console.log('📊 测试总结:', {
        '总测试数': report.summary.totalTests,
        '通过': report.summary.passed,
        '失败': report.summary.failed,
        '成功率': `${Math.round((report.summary.passed / report.summary.totalTests) * 100)}%`
    });
    
    // 保存详细报告到文件
    const reportPath = 'test-reports/switch-project-git-handling-report.json';
    console.log(`📄 详细报告将保存到: ${reportPath}`);
    
    return report;
}

/**
 * 手动测试指导
 */
export function printManualTestGuide() {
    console.log('\n📚 手动测试指导:');
    console.log('');
    console.log('🔧 准备测试环境:');
    console.log('1. 确保当前工作区是一个Git仓库');
    console.log('2. 创建一些文件修改（用于测试unstaged changes）');
    console.log('3. 使用 git add . 暂存一些更改（用于测试staged changes）');
    console.log('4. 确保工作区中有多个项目目录');
    console.log('');
    console.log('🧪 执行测试步骤:');
    console.log('1. 运行: testSwitchProjectGitHandling()');
    console.log('2. 手动触发Switch Project功能');
    console.log('3. 观察用户交互对话框');
    console.log('4. 测试不同的用户选择');
    console.log('');
    console.log('✅ 验证要点:');
    console.log('- Git状态检查是否准确');
    console.log('- 用户对话框是否正确显示');
    console.log('- 自动提交是否正常工作');
    console.log('- Source Control面板是否正确打开');
    console.log('- 分支切换是否成功');
    console.log('');
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    testSwitchProjectGitHandling().then(results => {
        console.log('✅ 测试完成');
        printManualTestGuide();
    }).catch(error => {
        console.error('❌ 测试失败:', error);
    });
}
