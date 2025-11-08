/**
 * BaseDir 验证器
 *
 * 提供 baseDir 路径的安全验证，包含 5 项基本检查：
 * 1. 非空验证
 * 2. 绝对路径验证
 * 3. 存在性验证
 * 4. 目录类型验证
 * 5. 工作区范围验证
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * BaseDir 验证错误代码
 */
export enum BaseDirErrorCode {
    EMPTY = 'BASEDIR_EMPTY',
    NOT_ABSOLUTE = 'BASEDIR_NOT_ABSOLUTE',
    NOT_EXIST = 'BASEDIR_NOT_EXIST',
    NOT_DIRECTORY = 'BASEDIR_NOT_DIR',
    OUTSIDE_WORKSPACE = 'BASEDIR_OUTSIDE_WORKSPACE',
    PATH_ESCAPE = 'PATH_ESCAPE'
}

/**
 * BaseDir 验证异常
 */
export class BaseDirValidationError extends Error {
    constructor(
        public code: BaseDirErrorCode,
        message: string,
        public details?: Record<string, any>
    ) {
        super(message);
        this.name = 'BaseDirValidationError';
        Error.captureStackTrace(this, BaseDirValidationError);
    }
}

/**
 * 验证选项
 */
export interface BaseDirValidationOptions {
    checkWithinWorkspace?: boolean;  // 默认 true
}

/**
 * BaseDir 验证器
 */
export class BaseDirValidator {
    // 🧪 测试用：允许注入 workspace root（用于单元测试）
    private static _testWorkspaceRoot: string | null = null;

    /**
     * 设置测试用的 workspace root（仅用于单元测试）
     * @internal
     */
    static setTestWorkspaceRoot(root: string | null): void {
        this._testWorkspaceRoot = root;
    }

    /**
     * 验证 baseDir 有效性
     *
     * 执行 5 项检查：
     * 1. 非空验证
     * 2. 绝对路径验证
     * 3. 存在性验证
     * 4. 目录类型验证
     * 5. 工作区范围验证
     *
     * @param baseDir 待验证的 baseDir
     * @param options 验证选项
     * @returns 验证后的绝对路径（解析符号链接后）
     * @throws BaseDirValidationError
     */
    static validateBaseDir(
        baseDir: string | null | undefined,
        options?: BaseDirValidationOptions
    ): string {
        const opts = {
            checkWithinWorkspace: options?.checkWithinWorkspace ?? true
        };

        // ✅ 检查 1: 非空验证
        if (!baseDir || baseDir.trim() === '') {
            throw new BaseDirValidationError(
                BaseDirErrorCode.EMPTY,
                'Invalid session file: baseDir is missing or empty. ' +
                'Please delete .session-log/ and recreate the project.'
            );
        }

        const trimmedBaseDir = baseDir.trim();

        // ✅ 检查 2: 绝对路径验证
        if (!path.isAbsolute(trimmedBaseDir)) {
            throw new BaseDirValidationError(
                BaseDirErrorCode.NOT_ABSOLUTE,
                `BaseDir must be an absolute path: ${trimmedBaseDir}. ` +
                'Relative paths are not allowed for security.'
            );
        }

        // ✅ 检查 3: 存在性验证
        if (!fs.existsSync(trimmedBaseDir)) {
            throw new BaseDirValidationError(
                BaseDirErrorCode.NOT_EXIST,
                `BaseDir does not exist: ${trimmedBaseDir}. ` +
                'Please verify the directory exists or delete .session-log/ to reset.'
            );
        }

        // ✅ 检查 4: 目录类型验证
        const stats = fs.statSync(trimmedBaseDir);
        if (!stats.isDirectory()) {
            throw new BaseDirValidationError(
                BaseDirErrorCode.NOT_DIRECTORY,
                `BaseDir is not a directory: ${trimmedBaseDir}. ` +
                'BaseDir must be a directory, not a file.'
            );
        }

        // 🔗 解析符号链接到真实路径
        const realBaseDir = fs.realpathSync(trimmedBaseDir);

        // ✅ 检查 5: 工作区范围验证
        if (opts.checkWithinWorkspace) {
            const workspaceRoot = this.getWorkspaceRoot();

            if (!this.isPathWithinDirectory(realBaseDir, workspaceRoot)) {
                throw new BaseDirValidationError(
                    BaseDirErrorCode.OUTSIDE_WORKSPACE,
                    `BaseDir is outside workspace: ${realBaseDir}. ` +
                    'BaseDir must be within the workspace root for security.'
                );
            }
        }

        return realBaseDir;
    }

    /**
     * 验证路径是否在 baseDir 内（防止路径逃逸）
     *
     * @param targetPath 目标路径（相对或绝对）
     * @param baseDir 基准目录
     * @returns 解析后的绝对路径
     * @throws BaseDirValidationError
     */
    static validatePathWithinBaseDir(
        targetPath: string,
        baseDir: string
    ): string {
        // 1. 解析目标路径为绝对路径
        let absolutePath: string;
        if (path.isAbsolute(targetPath)) {
            absolutePath = targetPath;
        } else {
            absolutePath = path.resolve(baseDir, targetPath);
        }

        // 2. 解析 baseDir 的真实路径
        let realBaseDir: string;
        try {
            realBaseDir = fs.existsSync(baseDir) ? fs.realpathSync(baseDir) : path.normalize(baseDir);
        } catch (error) {
            realBaseDir = path.normalize(baseDir);
        }

        // 3. 解析目标路径的真实路径
        let realPath: string;
        try {
            // 如果路径不存在，realpathSync 会抛出异常
            // 但我们允许不存在的路径（可能是将要创建的文件）
            if (fs.existsSync(absolutePath)) {
                realPath = fs.realpathSync(absolutePath);
            } else {
                // 对于不存在的路径，需要在符号链接的基础上进行标准化
                // 将输入 baseDir（可能是符号链接）替换为真实 baseDir
                if (path.isAbsolute(targetPath)) {
                    // 绝对路径的情况下，尝试将其替换为真实 baseDir 前缀
                    const normalizedTarget = path.normalize(targetPath);
                    const normalizedInput = path.normalize(baseDir);
                    if (normalizedTarget.startsWith(normalizedInput)) {
                        // 将输入路径中的 baseDir 替换为真实的 baseDir
                        const relativePart = normalizedTarget.slice(normalizedInput.length);
                        realPath = path.join(realBaseDir, relativePart);
                    } else {
                        realPath = path.normalize(absolutePath);
                    }
                } else {
                    realPath = path.resolve(realBaseDir, targetPath);
                }
            }
        } catch (error) {
            realPath = path.normalize(absolutePath);
        }

        // 4. 路径逃逸检测：确保解析后路径在 baseDir 内
        if (!this.isPathWithinDirectory(realPath, realBaseDir)) {
            throw new BaseDirValidationError(
                BaseDirErrorCode.PATH_ESCAPE,
                `Path escape detected: ${targetPath} resolves to ${realPath}, ` +
                `which is outside baseDir: ${realBaseDir}`
            );
        }

        return realPath;
    }

    /**
     * 获取安全的 baseDir（带 fallback）
     *
     * @param baseDir 待验证的 baseDir
     * @param options 验证选项
     * @returns 验证后的 baseDir 或 workspace root
     * @throws BaseDirValidationError（无法获取任何有效 baseDir 时）
     */
    static getSafeBaseDir(
        baseDir: string | null | undefined,
        options?: BaseDirValidationOptions
    ): string {
        // 如果 baseDir 有效，返回验证后的 baseDir
        if (baseDir && baseDir.trim() !== '') {
            return this.validateBaseDir(baseDir, options);
        }

        // Fallback 到 workspace root
        return this.getWorkspaceRoot();
    }

    /**
     * 获取 VSCode workspace root
     *
     * @returns workspace root 绝对路径
     * @throws Error 如果没有打开的 workspace
     */
    private static getWorkspaceRoot(): string {
        // 🧪 测试模式：如果设置了测试 workspace root，使用它
        if (this._testWorkspaceRoot) {
            return this._testWorkspaceRoot;
        }

        // 生产模式：从 VSCode API 获取
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder available. Please open a workspace first.');
        }

        return workspaceFolders[0].uri.fsPath;
    }

    /**
     * 检查路径是否在指定目录内
     *
     * @param targetPath 目标路径（必须是绝对路径）
     * @param parentDir 父目录（必须是绝对路径）
     * @returns 是否在目录内
     */
    private static isPathWithinDirectory(targetPath: string, parentDir: string): boolean {
        // 🔗 解析符号链接到真实路径（处理 macOS /var -> /private/var 等情况）
        let realTarget: string;
        let realParent: string;

        try {
            realTarget = fs.existsSync(targetPath) ? fs.realpathSync(targetPath) : path.normalize(targetPath);
            realParent = fs.existsSync(parentDir) ? fs.realpathSync(parentDir) : path.normalize(parentDir);
        } catch (error) {
            // 如果无法解析，使用标准化路径
            realTarget = path.normalize(targetPath);
            realParent = path.normalize(parentDir);
        }

        // 计算相对路径
        const relativePath = path.relative(realParent, realTarget);

        // 如果相对路径为空，说明 target === parent（允许）
        if (relativePath === '') {
            return true;
        }

        // 如果相对路径以 '..' 开头，说明 target 在 parent 外部
        if (relativePath.startsWith('..')) {
            return false;
        }

        // 如果相对路径是绝对路径，说明在不同的驱动器/根目录（Windows）
        if (path.isAbsolute(relativePath)) {
            return false;
        }

        return true;
    }
}
