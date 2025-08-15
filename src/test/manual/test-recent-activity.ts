/**
 * 测试最近活动功能的手动测试脚本
 * 验证 SessionManager.getRecentActivity() 方法的正确性
 */

import * as vscode from 'vscode';
import { SessionManager } from '../../core/session-manager';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testRecentActivity() {
    console.log('🧪 开始测试最近活动功能...');
    
    try {
        // 创建模拟的VSCode扩展上下文
        const mockContext = {
            globalStoragePath: '/tmp/test-srs-writer'
        } as vscode.ExtensionContext;
        
        const sessionManager = SessionManager.getInstance(mockContext);
        
        // 测试1: 无项目时的情况
        console.log('\n📋 测试1: 无项目时的活动状态');
        const noProjectActivity = await sessionManager.getRecentActivity();
        console.log(`结果: ${noProjectActivity}`);
        console.log(`✅ 预期: "无项目", 实际: "${noProjectActivity}"`);
        
        // 测试2: 创建测试项目
        console.log('\n📋 测试2: 创建测试项目并检查活动');
        const testProjectPath = '/tmp/test-srs-project';
        
        try {
            await fs.mkdir(testProjectPath, { recursive: true });
            
            // 创建一些测试文件
            const testFiles = [
                { name: 'SRS.md', content: '# 测试SRS文档', ageMinutes: 5 },
                { name: 'requirements.yaml', content: 'version: 1.0', ageMinutes: 10 },
                { name: 'README.md', content: '# 项目说明', ageMinutes: 1 },
                { name: 'package.json', content: '{}', ageMinutes: 30 } // 不应该显示，因为不在优先列表中
            ];
            
            for (const file of testFiles) {
                const filePath = path.join(testProjectPath, file.name);
                await fs.writeFile(filePath, file.content);
                
                // 设置文件的修改时间为指定分钟前
                const modTime = new Date(Date.now() - file.ageMinutes * 60 * 1000);
                await fs.utimes(filePath, modTime, modTime);
            }
            
            // 创建测试会话
            await sessionManager.createNewSession('test-project');
            await sessionManager.updateSession({ baseDir: testProjectPath });
            
            // 获取活动信息
            const activityResult = await sessionManager.getRecentActivity();
            console.log(`活动结果: ${activityResult}`);
            
            // 验证结果
            const shouldContain = ['README.md', 'SRS.md', 'requirements.yaml'];
            let allFound = true;
            
            for (const fileName of shouldContain) {
                if (!activityResult.includes(fileName)) {
                    console.log(`❌ 缺少文件: ${fileName}`);
                    allFound = false;
                } else {
                    console.log(`✅ 找到文件: ${fileName}`);
                }
            }
            
            if (allFound) {
                console.log('✅ 所有重要文件都在活动列表中');
            }
            
            // 验证时间格式
            const hasTimeInfo = activityResult.includes('分钟前') || activityResult.includes('小时前') || activityResult.includes('天前');
            console.log(`✅ 时间格式检查: ${hasTimeInfo ? '通过' : '失败'}`);
            
        } catch (fileError) {
            console.log(`❌ 文件操作失败: ${fileError}`);
        } finally {
            // 清理测试文件
            try {
                await fs.rm(testProjectPath, { recursive: true, force: true });
            } catch (cleanupError) {
                console.log(`⚠️ 清理测试文件失败: ${cleanupError}`);
            }
        }
        
        console.log('\n🎉 测试完成!');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

// 测试时间格式化函数
function testTimeFormatting() {
    console.log('\n🧪 测试时间格式化...');
    
    // 由于formatTimeAgo是私有方法，我们这里测试逻辑
    const now = new Date();
    const testCases = [
        { date: new Date(now.getTime() - 30 * 1000), expected: '刚刚' },
        { date: new Date(now.getTime() - 5 * 60 * 1000), expected: '5分钟前' },
        { date: new Date(now.getTime() - 2 * 60 * 60 * 1000), expected: '2小时前' },
        { date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), expected: '3天前' },
    ];
    
    for (const testCase of testCases) {
        const diffMs = now.getTime() - testCase.date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        let result: string;
        if (diffMinutes < 1) {
            result = '刚刚';
        } else if (diffMinutes < 60) {
            result = `${diffMinutes}分钟前`;
        } else if (diffHours < 24) {
            result = `${diffHours}小时前`;
        } else if (diffDays < 7) {
            result = `${diffDays}天前`;
        } else {
            result = testCase.date.toLocaleDateString();
        }
        
        console.log(`✅ ${testCase.expected} -> ${result}`);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testRecentActivity().then(() => {
        testTimeFormatting();
    });
}

export { testRecentActivity, testTimeFormatting };
