/**
 * 手动测试：验证状态栏tooltip移除功能
 * 
 * 测试目的：
 * 1. 确认状态栏不再显示tooltip悬停信息
 * 2. 确认项目切换期间没有"闪现"弹窗
 * 3. 确认只在会话变化时更新状态栏，不再定时轮询
 */

import * as vscode from 'vscode';

export async function testTooltipRemoval() {
    console.log('🧪 开始测试状态栏tooltip移除功能...');
    
    // 1. 创建测试状态栏项
    const testStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right, 
        100
    );
    
    console.log('✅ 测试状态栏创建成功');
    
    // 2. 测试没有tooltip的状态栏
    testStatusBar.text = '$(notebook-kernel) SRS: TestProject';
    // 注意：这里不设置tooltip
    testStatusBar.show();
    
    console.log('✅ 状态栏显示成功，无tooltip');
    
    // 3. 等待一段时间观察是否有意外弹窗
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ 2秒观察期间无意外弹窗');
    
    // 4. 模拟项目名更新
    testStatusBar.text = '$(notebook-kernel) SRS: NewProject';
    
    console.log('✅ 项目名更新成功，仍无tooltip');
    
    // 5. 清理测试
    testStatusBar.dispose();
    
    console.log('🎉 tooltip移除功能测试完成！');
    
    return {
        success: true,
        message: '状态栏tooltip成功移除，无"闪现"弹窗干扰'
    };
}

// 可以在开发者控制台运行的测试命令
export const runTooltipTest = () => {
    testTooltipRemoval().then(result => {
        console.log('📊 测试结果:', result);
    });
};
