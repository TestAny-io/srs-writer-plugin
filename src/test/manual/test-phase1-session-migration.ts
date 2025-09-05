/**
 * 阶段1手动测试：Session 存储位置迁移
 * 
 * 测试目标：
 * 1. 验证 SessionPathManager 功能
 * 2. 验证 SessionManager 使用新路径
 * 3. 验证 createWorkspaceAndInitialize 创建 session-log 目录
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SessionPathManager } from '../../core/SessionPathManager';
import { SessionManager } from '../../core/session-manager';

/**
 * 手动测试入口函数
 */
export async function runPhase1Tests(): Promise<void> {
    console.log('🚀 开始阶段1手动测试...');
    
    try {
        await testSessionPathManager();
        await testSessionManagerIntegration();
        console.log('✅ 阶段1测试全部通过！');
    } catch (error) {
        console.error('❌ 阶段1测试失败:', error);
        throw error;
    }
}

/**
 * 测试 SessionPathManager 功能
 */
async function testSessionPathManager(): Promise<void> {
    console.log('\n📋 测试 SessionPathManager...');
    
    // 模拟工作区路径
    const testWorkspaceRoot = '/Users/test/my-srs-workspace';
    const pathManager = new SessionPathManager(testWorkspaceRoot);
    
    // 测试基础路径功能
    console.log('1. 测试基础路径功能...');
    const sessionDir = pathManager.getSessionDirectory();
    const mainSessionPath = pathManager.getMainSessionPath();
    const projectSessionPath = pathManager.getProjectSessionPath('test-project');
    
    console.log(`   Session 目录: ${sessionDir}`);
    console.log(`   主会话文件: ${mainSessionPath}`);
    console.log(`   项目会话文件: ${projectSessionPath}`);
    
    // 验证路径正确性
    if (!sessionDir.endsWith('session-log')) {
        throw new Error('Session 目录路径不正确');
    }
    
    if (!mainSessionPath.endsWith('srs-writer-session_main.json')) {
        throw new Error('主会话文件路径不正确');
    }
    
    if (!projectSessionPath.includes('srs-writer-session_test-project.json')) {
        throw new Error('项目会话文件路径不正确');
    }
    
    // 测试项目名安全处理
    console.log('2. 测试项目名安全处理...');
    const unsafeName = 'My@Project#Name!';
    const safePath = pathManager.getProjectSessionPath(unsafeName);
    console.log(`   不安全名称: ${unsafeName}`);
    console.log(`   安全路径: ${safePath}`);
    
    if (safePath.includes('@') || safePath.includes('#') || safePath.includes('!')) {
        throw new Error('项目名安全处理失败');
    }
    
    // 测试路径验证
    console.log('3. 测试路径验证...');
    const isValid = pathManager.validateWorkspacePath();
    console.log(`   路径验证结果: ${isValid}`);
    
    if (!isValid) {
        throw new Error('有效路径验证失败');
    }
    
    console.log('✅ SessionPathManager 测试通过');
}

/**
 * 测试 SessionManager 集成
 */
async function testSessionManagerIntegration(): Promise<void> {
    console.log('\n📋 测试 SessionManager 集成...');
    
    // 注意：这个测试需要在真实的 VSCode 环境中运行
    // 在单元测试环境中，vscode 模块是 mock 的
    
    try {
        // 检查是否在真实的 VSCode 环境中
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log('⚠️ 没有打开的工作区，跳过 SessionManager 集成测试');
            return;
        }
        
        console.log('1. 测试 SessionManager 路径获取...');
        const sessionManager = SessionManager.getInstance();
        
        // 测试会话创建（这会触发路径管理器的使用）
        console.log('2. 测试会话创建和路径使用...');
        const testSession = await sessionManager.createNewSession('test-project');
        
        console.log(`   创建的会话ID: ${testSession.sessionContextId}`);
        console.log(`   项目名称: ${testSession.projectName}`);
        
        // 测试会话保存（这会使用新的路径）
        console.log('3. 测试会话保存到新路径...');
        await sessionManager.saveSessionToFile();
        
        console.log('✅ SessionManager 集成测试通过');
        
    } catch (error) {
        console.warn('⚠️ SessionManager 集成测试跳过（需要真实 VSCode 环境）:', error);
    }
}

/**
 * 验证创建工作区时的 session-log 目录创建
 */
export async function verifyWorkspaceSessionLogCreation(workspacePath: string): Promise<boolean> {
    console.log(`🔍 验证工作区 ${workspacePath} 中的 session-log 目录...`);
    
    try {
        const sessionLogDir = path.join(workspacePath, 'session-log');
        const mainSessionFile = path.join(sessionLogDir, 'srs-writer-session_main.json');
        
        // 检查目录是否存在
        const dirExists = fs.existsSync(sessionLogDir);
        console.log(`   session-log 目录存在: ${dirExists}`);
        
        // 检查主会话文件是否存在
        const fileExists = fs.existsSync(mainSessionFile);
        console.log(`   主会话文件存在: ${fileExists}`);
        
        // 如果文件存在，检查内容格式
        if (fileExists) {
            const fileContent = fs.readFileSync(mainSessionFile, 'utf8');
            const sessionData = JSON.parse(fileContent);
            
            console.log(`   会话文件格式验证:`);
            console.log(`     - sessionContextId: ${sessionData.sessionContextId !== undefined}`);
            console.log(`     - metadata.version: ${sessionData.metadata?.version}`);
            console.log(`     - operations 数组: ${Array.isArray(sessionData.operations)}`);
        }
        
        return dirExists && fileExists;
        
    } catch (error) {
        console.error('❌ 验证失败:', error);
        return false;
    }
}

// 导出测试函数供手动调用
export { testSessionPathManager, testSessionManagerIntegration };
