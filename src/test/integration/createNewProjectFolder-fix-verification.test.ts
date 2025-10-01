/**
 * 全面测试 createNewProjectFolder 嵌套目录修复
 * 
 * 测试目标：
 * 1. 验证修复后不会创建嵌套目录
 * 2. 确保自动重命名逻辑正常工作
 * 3. 验证向后兼容性（非项目目录创建）
 * 4. 测试边界情况和错误处理
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { createNewProjectFolder } from '../../tools/internal/createNewProjectFolderTool';
import { createDirectory } from '../../tools/atomic/filesystem-tools';
import { SessionManager } from '../../core/session-manager';

describe('createNewProjectFolder 嵌套目录修复验证', () => {
    let sessionManager: SessionManager;
    let workspaceRoot: string;
    let testProjectNames: string[];

    beforeAll(async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        workspaceRoot = workspaceFolder.uri.fsPath;
        testProjectNames = [];
        
        console.log(`🧪 测试环境初始化：`);
        console.log(`   工作区根目录: ${workspaceRoot}`);
    });

    beforeEach(async () => {
        sessionManager = SessionManager.getInstance();
        
        // 清理当前会话
        try {
            await sessionManager.startNewSession();
        } catch (error) {
            console.warn(`清理会话失败: ${(error as Error).message}`);
        }
    });

    afterEach(async () => {
        // 清理测试创建的目录
        for (const projectName of testProjectNames) {
            const testProjectDir = path.join(workspaceRoot, projectName);
            const nestedTestProjectDir = path.join(testProjectDir, projectName);
            
            try {
                if (fs.existsSync(nestedTestProjectDir)) {
                    fs.rmSync(nestedTestProjectDir, { recursive: true, force: true });
                }
                if (fs.existsSync(testProjectDir)) {
                    fs.rmSync(testProjectDir, { recursive: true, force: true });
                }
            } catch (error) {
                console.warn(`清理目录失败: ${(error as Error).message}`);
            }
        }
        testProjectNames = [];
    });

    describe('🎯 核心修复验证', () => {
        test('应该创建正确的单层目录结构，不产生嵌套', async () => {
            const testProjectName = `FixTest_${Date.now()}`;
            testProjectNames.push(testProjectName);
            
            console.log(`\n🧪 测试项目: ${testProjectName}`);
            
            const testProjectDir = path.join(workspaceRoot, testProjectName);
            const nestedTestProjectDir = path.join(testProjectDir, testProjectName);
            
            // 确认调用前目录不存在
            expect(fs.existsSync(testProjectDir)).toBe(false);
            expect(fs.existsSync(nestedTestProjectDir)).toBe(false);

            // 调用 createNewProjectFolder
            const result = await createNewProjectFolder({
                projectName: testProjectName,
                summary: `修复验证测试 - ${testProjectName}`,
                confirmWithUser: false
            });

            console.log(`📊 调用结果:`, {
                success: result.success,
                projectName: result.projectName,
                directoryName: result.directoryName,
                error: result.error
            });

            // 验证结果
            expect(result.success).toBe(true);
            expect(result.projectName).toBe(testProjectName);

            // 关键验证：检查目录结构
            const mainDirExists = fs.existsSync(testProjectDir);
            const nestedDirExists = fs.existsSync(nestedTestProjectDir);
            
            console.log(`📁 目录状态:`);
            console.log(`   主目录存在: ${mainDirExists}`);
            console.log(`   嵌套目录存在: ${nestedDirExists}`);
            
            // 断言
            expect(mainDirExists).toBe(true);
            expect(nestedDirExists).toBe(false); // 🎯 关键：不应该有嵌套目录
            
            // 验证会话状态
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe(testProjectName);
            expect(currentSession?.baseDir).toBe(testProjectDir);
        }, 30000);

        test('应该正确处理自动重命名逻辑', async () => {
            const baseProjectName = `RenameTest_${Date.now()}`;
            testProjectNames.push(baseProjectName, `${baseProjectName}_1`);
            
            console.log(`\n🧪 测试自动重命名: ${baseProjectName}`);
            
            // 1. 先手动创建同名目录
            const originalDir = path.join(workspaceRoot, baseProjectName);
            fs.mkdirSync(originalDir, { recursive: true });
            
            console.log(`📁 预创建目录: ${originalDir}`);
            
            // 2. 调用 createNewProjectFolder，应该自动重命名
            const result = await createNewProjectFolder({
                projectName: baseProjectName,
                summary: `自动重命名测试 - ${baseProjectName}`,
                confirmWithUser: false
            });

            console.log(`📊 重命名结果:`, {
                success: result.success,
                projectName: result.projectName,
                directoryRenamed: result.directoryRenamed,
                directoryName: result.directoryName
            });

            // 验证自动重命名
            expect(result.success).toBe(true);
            expect(result.projectName).toBe(`${baseProjectName}_1`);
            expect(result.directoryRenamed).toBe(true);
            
            // 验证目录结构
            const originalDirExists = fs.existsSync(originalDir);
            const renamedDir = path.join(workspaceRoot, `${baseProjectName}_1`);
            const renamedDirExists = fs.existsSync(renamedDir);
            const nestedDir = path.join(renamedDir, `${baseProjectName}_1`);
            const nestedDirExists = fs.existsSync(nestedDir);
            
            console.log(`📁 重命名后目录状态:`);
            console.log(`   原目录存在: ${originalDirExists}`);
            console.log(`   重命名目录存在: ${renamedDirExists}`);
            console.log(`   嵌套目录存在: ${nestedDirExists}`);
            
            expect(originalDirExists).toBe(true);  // 原目录应该保持
            expect(renamedDirExists).toBe(true);   // 重命名目录应该存在
            expect(nestedDirExists).toBe(false);   // 🎯 不应该有嵌套目录
        }, 30000);
    });

    describe('🔄 向后兼容性测试', () => {
        test('非项目目录创建应该保持原有行为', async () => {
            const testProjectName = `CompatTest_${Date.now()}`;
            testProjectNames.push(testProjectName);
            
            console.log(`\n🧪 测试向后兼容性: ${testProjectName}`);
            
            // 1. 先创建一个项目会话
            await sessionManager.startNewSession(testProjectName);
            const session = await sessionManager.getCurrentSession();
            
            console.log(`📝 当前会话baseDir: ${session?.baseDir}`);
            
            // 2. 在项目会话存在的情况下，创建非项目目录
            const subDirName = 'subdirectory';
            const result = await createDirectory({
                path: subDirName,
                isProjectDirectory: false  // 🎯 非项目目录
            });

            console.log(`📊 非项目目录创建结果:`, result);
            
            expect(result.success).toBe(true);
            
            // 3. 验证路径解析行为
            // 非项目目录应该使用智能路径解析，可能基于会话的baseDir
            const expectedPath = session?.baseDir 
                ? path.join(session.baseDir, subDirName)
                : path.join(workspaceRoot, testProjectName, subDirName);
                
            const actualDirExists = fs.existsSync(expectedPath);
            console.log(`📁 预期路径: ${expectedPath}`);
            console.log(`📁 目录存在: ${actualDirExists}`);
            
            // 这个测试主要确保非项目目录创建不会出错
            // 具体路径解析行为取决于resolveWorkspacePath的实现
        }, 20000);

        test('绝对路径项目目录创建应该正常工作', async () => {
            const testProjectName = `AbsoluteTest_${Date.now()}`;
            testProjectNames.push(testProjectName);
            
            console.log(`\n🧪 测试绝对路径: ${testProjectName}`);
            
            const absolutePath = path.join(workspaceRoot, testProjectName);
            
            const result = await createDirectory({
                path: absolutePath,  // 绝对路径
                isProjectDirectory: true
            });

            console.log(`📊 绝对路径创建结果:`, result);
            
            expect(result.success).toBe(true);
            
            const dirExists = fs.existsSync(absolutePath);
            const nestedDir = path.join(absolutePath, testProjectName);
            const nestedDirExists = fs.existsSync(nestedDir);
            
            console.log(`📁 绝对路径目录状态:`);
            console.log(`   主目录存在: ${dirExists}`);
            console.log(`   嵌套目录存在: ${nestedDirExists}`);
            
            expect(dirExists).toBe(true);
            expect(nestedDirExists).toBe(false);  // 绝对路径也不应该有嵌套
        }, 20000);
    });

    describe('🚨 边界情况和错误处理', () => {
        test('无工作区时应该正确处理错误', async () => {
            // 这个测试比较难模拟，因为我们在VSCode环境中运行
            // 但可以测试错误处理逻辑
            console.log(`\n🧪 测试错误处理逻辑`);
            
            // 测试空项目名
            const result = await createNewProjectFolder({
                projectName: '',
                summary: '空项目名测试',
                confirmWithUser: false
            });

            console.log(`📊 空项目名结果:`, {
                success: result.success,
                projectName: result.projectName,
                error: result.error
            });
            
            // 空项目名应该被处理为 'unnamed'
            expect(result.success).toBe(true);
            expect(result.projectName).toBe('unnamed');
        }, 10000);

        test('特殊字符项目名应该正确处理', async () => {
            const testProjectName = `Special_Test-${Date.now()}.project`;
            testProjectNames.push(testProjectName);
            
            console.log(`\n🧪 测试特殊字符项目名: ${testProjectName}`);
            
            const result = await createNewProjectFolder({
                projectName: testProjectName,
                summary: `特殊字符测试 - ${testProjectName}`,
                confirmWithUser: false
            });

            console.log(`📊 特殊字符结果:`, {
                success: result.success,
                projectName: result.projectName,
                error: result.error
            });
            
            expect(result.success).toBe(true);
            
            const testProjectDir = path.join(workspaceRoot, testProjectName);
            const nestedTestProjectDir = path.join(testProjectDir, testProjectName);
            
            expect(fs.existsSync(testProjectDir)).toBe(true);
            expect(fs.existsSync(nestedTestProjectDir)).toBe(false);
        }, 20000);
    });

    describe('🔍 详细路径解析验证', () => {
        test('验证修复前后的路径解析差异', async () => {
            const testProjectName = `PathTest_${Date.now()}`;
            testProjectNames.push(testProjectName);
            
            console.log(`\n🧪 详细路径解析测试: ${testProjectName}`);
            
            // 1. 创建会话但不创建目录
            await sessionManager.startNewSession(testProjectName);
            const session = await sessionManager.getCurrentSession();
            
            console.log(`📝 会话信息:`);
            console.log(`   项目名: ${session?.projectName}`);
            console.log(`   baseDir: ${session?.baseDir}`);
            
            // 2. 直接调用 createDirectory 测试路径解析
            const result = await createDirectory({
                path: testProjectName,
                isProjectDirectory: true
            });

            console.log(`📊 路径解析结果:`, result);
            
            // 3. 验证最终创建的路径
            const expectedCorrectPath = path.join(workspaceRoot, testProjectName);
            const possibleNestedPath = path.join(expectedCorrectPath, testProjectName);
            
            const correctPathExists = fs.existsSync(expectedCorrectPath);
            const nestedPathExists = fs.existsSync(possibleNestedPath);
            
            console.log(`📁 路径验证:`);
            console.log(`   正确路径: ${expectedCorrectPath} - 存在: ${correctPathExists}`);
            console.log(`   嵌套路径: ${possibleNestedPath} - 存在: ${nestedPathExists}`);
            
            expect(result.success).toBe(true);
            expect(correctPathExists).toBe(true);
            expect(nestedPathExists).toBe(false); // 🎯 修复的核心验证
        }, 20000);
    });
});
