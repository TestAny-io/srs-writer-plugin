/**
 * 手动验证脚本：项目切换修复效果
 * 验证从项目A切换到项目B时的正确行为
 */

import * as vscode from 'vscode';
import { SessionManager } from '../../core/session-manager';

export async function verifySessionSwitchingFix(): Promise<void> {
    console.log('🚀 开始验证项目切换修复效果...');
    
    // 模拟扩展上下文
    const mockContext = {
        subscriptions: [],
        globalStoragePath: '/tmp/test-storage',
        workspaceState: { get: jest.fn(), update: jest.fn() },
        globalState: { get: jest.fn(), update: jest.fn() }
    } as any;
    
    const sessionManager = SessionManager.getInstance(mockContext);
    
    try {
        console.log('\n📋 测试场景：从项目A切换到项目B');
        
        // 步骤1：创建项目A的session
        console.log('1. 创建项目A session...');
        const projectASession = await sessionManager.createNewSession('projectA');
        console.log(`   ✅ 项目A session创建: ${projectASession.sessionContextId}`);
        
        // 步骤2：模拟项目A的一些活动
        await sessionManager.updateSession({
            activeFiles: ['a1.md', 'a2.md']
        });
        console.log('   ✅ 项目A添加了活动文件');
        
        // 步骤3：切换到项目B
        console.log('2. 切换到项目B...');
        await sessionManager.switchToProjectSession('projectB');
        
        // 步骤4：验证结果
        const currentSession = await sessionManager.getCurrentSession();
        console.log(`   ✅ 当前session: ${currentSession?.projectName} (${currentSession?.sessionContextId})`);
        
        if (currentSession?.projectName === 'projectB') {
            console.log('✅ 项目切换成功！');
            
            if (currentSession.sessionContextId !== projectASession.sessionContextId) {
                console.log('✅ 使用了正确的目标项目session，没有混合状态');
            } else {
                console.log('⚠️  警告：可能仍在使用source project的session ID');
            }
        } else {
            console.log('❌ 项目切换失败');
        }
        
        console.log('\n🎯 验证完成');
        
    } catch (error) {
        console.error('❌ 验证过程中出错:', error);
    }
}

// 如果直接运行此文件
if (require.main === module) {
    verifySessionSwitchingFix().then(() => {
        console.log('验证脚本执行完成');
    });
}
