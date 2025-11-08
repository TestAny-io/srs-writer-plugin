/**
 * ProjectName 验证器
 *
 * 验证项目名称是否符合文件系统命名规范，防止：
 * 1. 路径逃逸攻击 (../, ..\, 绝对路径)
 * 2. 非法文件系统字符
 * 3. 跨平台兼容性问题
 * 4. 过长的文件名
 */

import * as path from 'path';

/**
 * ProjectName 验证错误代码
 */
export enum ProjectNameErrorCode {
    EMPTY = 'PROJECTNAME_EMPTY',
    TOO_LONG = 'PROJECTNAME_TOO_LONG',
    INVALID_CHARS = 'PROJECTNAME_INVALID_CHARS',
    PATH_SEPARATOR = 'PROJECTNAME_PATH_SEPARATOR',
    PATH_ESCAPE = 'PROJECTNAME_PATH_ESCAPE',
    RESERVED_NAME = 'PROJECTNAME_RESERVED_NAME',
    STARTS_OR_ENDS_WITH_SPACE = 'PROJECTNAME_SPACE_BOUNDARY'
}

/**
 * ProjectName 验证异常
 */
export class ProjectNameValidationError extends Error {
    constructor(
        public code: ProjectNameErrorCode,
        message: string,
        public details?: Record<string, any>
    ) {
        super(message);
        this.name = 'ProjectNameValidationError';
        Error.captureStackTrace(this, ProjectNameValidationError);
    }
}

/**
 * ProjectName 验证器
 */
export class ProjectNameValidator {
    // 文件名最大长度（跨平台安全值）
    private static readonly MAX_LENGTH = 255;

    // Windows 保留文件名
    private static readonly WINDOWS_RESERVED_NAMES = new Set([
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ]);

    // 跨平台非法字符（Windows 最严格）
    // < > : " / \ | ? *
    private static readonly INVALID_CHARS = /[<>:"/\\|?*]/g;

    // 控制字符 (ASCII 0-31)
    private static readonly CONTROL_CHARS = /[\x00-\x1f]/;

    /**
     * 验证项目名称是否合法
     *
     * 执行以下检查：
     * 1. 非空验证
     * 2. 长度验证
     * 3. 路径分隔符检查
     * 4. 路径逃逸检查
     * 5. 非法字符检查
     * 6. Windows 保留名检查
     * 7. 首尾空格检查
     *
     * @param projectName 待验证的项目名称
     * @returns 验证后的项目名称（去除首尾空格）
     * @throws ProjectNameValidationError
     */
    static validateProjectName(projectName: string | null | undefined): string {
        // ✅ 检查 1: 非空验证
        if (!projectName || projectName.trim() === '') {
            throw new ProjectNameValidationError(
                ProjectNameErrorCode.EMPTY,
                'Project name cannot be empty'
            );
        }

        const trimmedName = projectName.trim();

        // ✅ 检查 2: 长度验证
        if (trimmedName.length > this.MAX_LENGTH) {
            throw new ProjectNameValidationError(
                ProjectNameErrorCode.TOO_LONG,
                `Project name is too long (${trimmedName.length} chars). Maximum ${this.MAX_LENGTH} characters allowed.`,
                { length: trimmedName.length, maxLength: this.MAX_LENGTH }
            );
        }

        // ✅ 检查 3: 路径分隔符检查（防止创建嵌套目录）
        if (trimmedName.includes('/') || trimmedName.includes('\\')) {
            throw new ProjectNameValidationError(
                ProjectNameErrorCode.PATH_SEPARATOR,
                `Project name cannot contain path separators (/ or \\): "${trimmedName}"`,
                { invalidChars: ['/', '\\'] }
            );
        }

        // ✅ 检查 4: 路径逃逸检查
        // 防止 "..", ".", 或其他路径遍历技巧
        if (trimmedName === '.' || trimmedName === '..') {
            throw new ProjectNameValidationError(
                ProjectNameErrorCode.PATH_ESCAPE,
                `Project name cannot be "." or "..": "${trimmedName}"`
            );
        }

        // 检查是否包含路径逃逸模式
        if (trimmedName.includes('..')) {
            throw new ProjectNameValidationError(
                ProjectNameErrorCode.PATH_ESCAPE,
                `Project name cannot contain "..": "${trimmedName}"`
            );
        }

        // ✅ 检查 5: 非法字符检查
        if (this.INVALID_CHARS.test(trimmedName)) {
            const invalidChars = trimmedName.match(this.INVALID_CHARS) || [];
            throw new ProjectNameValidationError(
                ProjectNameErrorCode.INVALID_CHARS,
                `Project name contains invalid characters: "${trimmedName}". ` +
                `Invalid characters: ${[...new Set(invalidChars)].join(', ')}. ` +
                `Not allowed: < > : " / \\ | ? *`,
                { invalidChars: [...new Set(invalidChars)] }
            );
        }

        // 检查控制字符
        if (this.CONTROL_CHARS.test(trimmedName)) {
            throw new ProjectNameValidationError(
                ProjectNameErrorCode.INVALID_CHARS,
                `Project name contains control characters: "${trimmedName}"`
            );
        }

        // ✅ 检查 6: Windows 保留名检查
        // Windows 不允许使用保留设备名（不区分大小写，且不能带扩展名）
        const nameWithoutExt = trimmedName.split('.')[0].toUpperCase();
        if (this.WINDOWS_RESERVED_NAMES.has(nameWithoutExt)) {
            throw new ProjectNameValidationError(
                ProjectNameErrorCode.RESERVED_NAME,
                `Project name cannot use Windows reserved name: "${trimmedName}". ` +
                `Reserved names: ${[...this.WINDOWS_RESERVED_NAMES].join(', ')}`,
                { reservedName: nameWithoutExt }
            );
        }

        // ✅ 检查 7: 首尾空格检查
        // Windows 不允许文件名以空格或点结尾
        if (trimmedName !== projectName) {
            throw new ProjectNameValidationError(
                ProjectNameErrorCode.STARTS_OR_ENDS_WITH_SPACE,
                `Project name cannot start or end with spaces: "${projectName}"`
            );
        }

        if (trimmedName.endsWith('.') || trimmedName.endsWith(' ')) {
            throw new ProjectNameValidationError(
                ProjectNameErrorCode.STARTS_OR_ENDS_WITH_SPACE,
                `Project name cannot end with space or dot: "${trimmedName}". ` +
                `This is not allowed on Windows.`
            );
        }

        return trimmedName;
    }

    /**
     * 检查项目名称是否合法（不抛异常）
     *
     * @param projectName 待验证的项目名称
     * @returns { valid: boolean, error?: string }
     */
    static isValidProjectName(projectName: string | null | undefined): {
        valid: boolean;
        error?: string;
        code?: ProjectNameErrorCode;
    } {
        try {
            this.validateProjectName(projectName);
            return { valid: true };
        } catch (error) {
            if (error instanceof ProjectNameValidationError) {
                return {
                    valid: false,
                    error: error.message,
                    code: error.code
                };
            }
            return {
                valid: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 清理项目名称，移除非法字符
     *
     * 注意：这只是尽力而为的清理，不保证结果一定合法
     * 建议优先使用 validateProjectName() 拒绝非法名称
     *
     * @param projectName 原始项目名称
     * @returns 清理后的项目名称
     */
    static sanitizeProjectName(projectName: string): string {
        if (!projectName) {
            return '';
        }

        let sanitized = projectName.trim();

        // 移除控制字符
        sanitized = sanitized.replace(this.CONTROL_CHARS, '');

        // 替换路径分隔符为连字符（必须在 INVALID_CHARS 之前，因为 / \ 也在其中）
        sanitized = sanitized.replace(/[/\\]/g, '-');

        // 替换其他非法字符为下划线（不包括 / \ 因为已经处理）
        sanitized = sanitized.replace(this.INVALID_CHARS, '_');

        // 移除连续的点（可能是路径逃逸）
        sanitized = sanitized.replace(/\.{2,}/g, '.');

        // 移除首尾的空格和点
        sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

        // 限制长度
        if (sanitized.length > this.MAX_LENGTH) {
            sanitized = sanitized.substring(0, this.MAX_LENGTH);
        }

        // 检查是否是保留名
        const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
        if (this.WINDOWS_RESERVED_NAMES.has(nameWithoutExt)) {
            sanitized = '_' + sanitized;
        }

        return sanitized;
    }
}
