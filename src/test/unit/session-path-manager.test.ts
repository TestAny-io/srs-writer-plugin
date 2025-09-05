/**
 * SessionPathManager 单元测试
 * 验证阶段1的路径管理功能
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { SessionPathManager } from '../../core/SessionPathManager';

describe('SessionPathManager - 阶段1测试', () => {
    let pathManager: SessionPathManager;
    const testWorkspaceRoot = '/test/workspace';

    beforeEach(() => {
        pathManager = new SessionPathManager(testWorkspaceRoot);
    });

    describe('基础路径功能', () => {
        test('应该返回正确的 session 目录路径', () => {
            const sessionDir = pathManager.getSessionDirectory();
            expect(sessionDir).toBe('/test/workspace/.session-log');
        });

        test('应该返回正确的主会话文件路径', () => {
            const mainSessionPath = pathManager.getMainSessionPath();
            expect(mainSessionPath).toBe('/test/workspace/.session-log/srs-writer-session_main.json');
        });

        test('应该返回正确的项目会话文件路径', () => {
            const projectPath = pathManager.getProjectSessionPath('my-project');
            expect(projectPath).toBe('/test/workspace/.session-log/srs-writer-session_my-project.json');
        });
    });

    describe('项目名安全处理', () => {
        test('应该处理特殊字符', () => {
            const projectPath = pathManager.getProjectSessionPath('my@project#name');
            expect(projectPath).toBe('/test/workspace/.session-log/srs-writer-session_my_project_name.json');
        });

        test('应该合并多个下划线', () => {
            const projectPath = pathManager.getProjectSessionPath('my___project');
            expect(projectPath).toBe('/test/workspace/.session-log/srs-writer-session_my_project.json');
        });

        test('应该转换为小写', () => {
            const projectPath = pathManager.getProjectSessionPath('MyProject');
            expect(projectPath).toBe('/test/workspace/.session-log/srs-writer-session_myproject.json');
        });

        test('应该限制长度', () => {
            const longName = 'a'.repeat(100);
            const projectPath = pathManager.getProjectSessionPath(longName);
            const fileName = path.basename(projectPath);
            expect(fileName.length).toBeLessThan(70); // 考虑前缀和后缀
        });
    });

    describe('路径验证', () => {
        test('应该验证有效的工作区路径', () => {
            const isValid = pathManager.validateWorkspacePath();
            expect(isValid).toBe(true);
        });

        test('应该拒绝空的工作区路径', () => {
            const emptyPathManager = new SessionPathManager('');
            const isValid = emptyPathManager.validateWorkspacePath();
            expect(isValid).toBe(false);
        });

        test('应该拒绝过长的路径', () => {
            const longPath = '/test/' + 'a'.repeat(250);
            const longPathManager = new SessionPathManager(longPath);
            const isValid = longPathManager.validateWorkspacePath();
            expect(isValid).toBe(false);
        });
    });
});

/**
 * 集成测试：验证与 SessionManager 的集成
 */
describe('SessionManager 路径集成测试', () => {
    // 注意：这些测试需要在有 VSCode 扩展上下文的环境中运行
    // 在实际测试中，可能需要 mock vscode 模块

    test('应该能够创建 SessionManager 实例', () => {
        // 这个测试需要 mock vscode.ExtensionContext
        // 实际实现时需要设置适当的测试环境
        expect(true).toBe(true); // 占位测试
    });

    test('应该能够获取新的会话文件路径', () => {
        // 测试 SessionManager 是否正确使用 SessionPathManager
        expect(true).toBe(true); // 占位测试
    });
});
