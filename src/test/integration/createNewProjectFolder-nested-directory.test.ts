/**
 * 测试 createNewProjectFolder 工具是否会创建嵌套目录
 * 
 * 目的：验证调用 createNewProjectFolder({ projectName: "TestProject" })
 * 是否会同时创建 TestProject 和 TestProject/TestProject 两个目录
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { createNewProjectFolder } from '../../tools/internal/createNewProjectFolderTool';
import { SessionManager } from '../../core/session-manager';

describe('createNewProjectFolder - 嵌套目录创建测试', () => {
    let sessionManager: SessionManager;
    let workspaceRoot: string;
    let testProjectName: string;

    beforeAll(async () => {
        // 获取工作区根目录
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        workspaceRoot = workspaceFolder.uri.fsPath;
        
        // 使用时间戳确保项目名唯一
        testProjectName = `TestProject_${Date.now()}`;
        
        console.log(`🧪 测试环境：`);
        console.log(`   工作区根目录: ${workspaceRoot}`);
        console.log(`   测试项目名: ${testProjectName}`);
    });

    beforeEach(async () => {
        // 每次测试前清理可能存在的测试目录
        const testProjectDir = path.join(workspaceRoot, testProjectName);
        const nestedTestProjectDir = path.join(testProjectDir, testProjectName);
        
        try {
            if (fs.existsSync(nestedTestProjectDir)) {
                fs.rmSync(nestedTestProjectDir, { recursive: true, force: true });
                console.log(`🧹 清理嵌套测试目录: ${nestedTestProjectDir}`);
            }
            if (fs.existsSync(testProjectDir)) {
                fs.rmSync(testProjectDir, { recursive: true, force: true });
                console.log(`🧹 清理测试目录: ${testProjectDir}`);
            }
        } catch (error) {
            console.warn(`清理测试目录失败: ${(error as Error).message}`);
        }

        // 获取 SessionManager 实例
        sessionManager = SessionManager.getInstance();
        
        // 清理当前会话，确保测试开始时没有项目会话
        try {
            const currentSession = await sessionManager.getCurrentSession();
            if (currentSession) {
                console.log(`🧹 清理现有会话: ${currentSession.projectName}`);
                // 这里需要清理会话，但不能直接访问私有方法
                // 我们通过创建一个新的空会话来清理
                await sessionManager.startNewSession();
            }
        } catch (error) {
            console.warn(`清理会话失败: ${(error as Error).message}`);
        }
    });

    afterEach(async () => {
        // 测试后清理
        const testProjectDir = path.join(workspaceRoot, testProjectName);
        const nestedTestProjectDir = path.join(testProjectDir, testProjectName);
        
        try {
            if (fs.existsSync(nestedTestProjectDir)) {
                fs.rmSync(nestedTestProjectDir, { recursive: true, force: true });
                console.log(`🧹 测试后清理嵌套目录: ${nestedTestProjectDir}`);
            }
            if (fs.existsSync(testProjectDir)) {
                fs.rmSync(testProjectDir, { recursive: true, force: true });
                console.log(`🧹 测试后清理主目录: ${testProjectDir}`);
            }
        } catch (error) {
            console.warn(`测试后清理失败: ${(error as Error).message}`);
        }
    });

    test('验证是否会创建嵌套目录结构', async () => {
        console.log(`\n🎯 开始测试：createNewProjectFolder("${testProjectName}")`);
        
        // 1. 记录调用前的状态
        const testProjectDir = path.join(workspaceRoot, testProjectName);
        const nestedTestProjectDir = path.join(testProjectDir, testProjectName);
        
        console.log(`📍 预期目录路径:`);
        console.log(`   主目录: ${testProjectDir}`);
        console.log(`   嵌套目录: ${nestedTestProjectDir}`);
        
        // 确认调用前目录不存在
        expect(fs.existsSync(testProjectDir)).toBe(false);
        expect(fs.existsSync(nestedTestProjectDir)).toBe(false);
        console.log(`✅ 确认调用前目录不存在`);

        // 2. 调用 createNewProjectFolder
        console.log(`🚀 调用 createNewProjectFolder...`);
        const result = await createNewProjectFolder({
            projectName: testProjectName,
            summary: `测试嵌套目录创建问题 - ${testProjectName}`,
            confirmWithUser: false
        });

        // 3. 检查调用结果
        console.log(`📊 调用结果:`, {
            success: result.success,
            projectName: result.projectName,
            directoryName: result.directoryName,
            message: result.message,
            error: result.error
        });

        // 4. 检查实际创建的目录结构
        const mainDirExists = fs.existsSync(testProjectDir);
        const nestedDirExists = fs.existsSync(nestedTestProjectDir);
        
        console.log(`📁 实际目录状态:`);
        console.log(`   主目录存在: ${mainDirExists}`);
        console.log(`   嵌套目录存在: ${nestedDirExists}`);
        
        // 如果主目录存在，列出其内容
        if (mainDirExists) {
            try {
                const mainDirContents = fs.readdirSync(testProjectDir);
                console.log(`   主目录内容: [${mainDirContents.join(', ')}]`);
            } catch (error) {
                console.log(`   无法读取主目录内容: ${(error as Error).message}`);
            }
        }

        // 5. 检查会话状态
        try {
            const currentSession = await sessionManager.getCurrentSession();
            console.log(`🔄 当前会话状态:`);
            console.log(`   项目名: ${currentSession?.projectName}`);
            console.log(`   baseDir: ${currentSession?.baseDir}`);
        } catch (error) {
            console.log(`   获取会话状态失败: ${(error as Error).message}`);
        }

        // 6. 断言验证
        expect(result.success).toBe(true);
        expect(mainDirExists).toBe(true);
        
        // 关键测试：是否创建了嵌套目录？
        if (nestedDirExists) {
            console.log(`❌ 检测到嵌套目录创建问题！`);
            console.log(`   创建了不应该存在的嵌套目录: ${nestedTestProjectDir}`);
            
            // 这是我们要验证的问题
            fail(`创建了嵌套目录 ${testProjectName}/${testProjectName}，这证实了路径解析问题的存在`);
        } else {
            console.log(`✅ 没有创建嵌套目录，目录结构正确`);
        }

        // 额外验证：主目录应该是空的或只包含预期的项目文件
        if (mainDirExists) {
            const mainDirContents = fs.readdirSync(testProjectDir);
            const hasUnexpectedSubdirectories = mainDirContents.some(item => {
                const itemPath = path.join(testProjectDir, item);
                return fs.statSync(itemPath).isDirectory() && item === testProjectName;
            });
            
            if (hasUnexpectedSubdirectories) {
                fail(`主目录中包含同名子目录，这证实了嵌套目录问题`);
            }
        }
    }, 30000); // 30秒超时

    test('验证路径解析逻辑的具体行为', async () => {
        console.log(`\n🔍 测试路径解析逻辑...`);
        
        // 先创建一个会话，设置baseDir
        console.log(`1️⃣ 创建会话并设置baseDir...`);
        await sessionManager.startNewSession(testProjectName);
        
        const session = await sessionManager.getCurrentSession();
        console.log(`   会话baseDir: ${session?.baseDir}`);
        
        // 然后模拟调用resolveWorkspacePath
        console.log(`2️⃣ 测试路径解析...`);
        const { resolveWorkspacePath } = await import('../../utils/path-resolver');
        
        try {
            const resolvedPath = await resolveWorkspacePath(testProjectName);
            console.log(`   输入路径: ${testProjectName}`);
            console.log(`   解析结果: ${resolvedPath}`);
            console.log(`   工作区根目录: ${workspaceRoot}`);
            
            // 检查是否出现了路径嵌套
            const expectedSimplePath = path.join(workspaceRoot, testProjectName);
            const possibleNestedPath = path.join(workspaceRoot, testProjectName, testProjectName);
            
            console.log(`   期望路径: ${expectedSimplePath}`);
            console.log(`   可能的嵌套路径: ${possibleNestedPath}`);
            
            if (resolvedPath === possibleNestedPath) {
                console.log(`❌ 路径解析确实产生了嵌套！`);
                console.log(`   这证实了我们的猜测：resolveWorkspacePath在有baseDir时会产生嵌套路径`);
            } else if (resolvedPath === expectedSimplePath) {
                console.log(`✅ 路径解析正确，没有嵌套`);
            } else {
                console.log(`❓ 路径解析结果意外: ${resolvedPath}`);
            }
            
            // 记录这个发现用于验证
            expect(resolvedPath).toBeDefined();
            
        } catch (error) {
            console.log(`   路径解析失败: ${(error as Error).message}`);
            throw error;
        }
    }, 10000);
});
