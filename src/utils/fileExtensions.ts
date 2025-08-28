/**
 * 统一的文件扩展名支持工具
 * 
 * 用于支持 .poml 和 .md 两种specialist文件格式
 * 优先级：.poml > .md
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 获取支持的specialist文件扩展名列表
 * 按优先级排序：.poml 优先于 .md
 */
export function getSupportedSpecialistExtensions(): string[] {
    return ['.poml', '.md'];
}

/**
 * 检查文件是否为支持的specialist文件
 */
export function isSpecialistFile(filename: string): boolean {
    return getSupportedSpecialistExtensions().some(ext => filename.endsWith(ext));
}

/**
 * 过滤出支持的specialist文件
 */
export function filterSpecialistFiles(files: string[]): string[] {
    return files.filter(file => isSpecialistFile(file) && file !== '.gitkeep');
}

/**
 * 根据基础名称查找specialist文件（按优先级）
 * @param baseName 不带扩展名的文件名
 * @param searchPaths 搜索路径列表
 * @returns 找到的文件完整路径，如果未找到返回null
 */
export function findSpecialistFileWithExtension(baseName: string, searchPaths: string[]): string | null {
    for (const ext of getSupportedSpecialistExtensions()) {
        for (const searchPath of searchPaths) {
            const fullPath = path.join(searchPath, `${baseName}${ext}`);
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }
    }
    return null;
}

/**
 * 根据specialist ID获取默认文件名（带扩展名）
 * 优先返回 .poml，如果不存在则返回 .md
 * @param specialistId specialist标识符
 * @param searchPaths 搜索路径列表
 * @returns 文件名（带扩展名）
 */
export function getSpecialistFileName(specialistId: string, searchPaths?: string[]): string {
    if (searchPaths && searchPaths.length > 0) {
        // 如果提供了搜索路径，尝试找到实际存在的文件
        const foundFile = findSpecialistFileWithExtension(specialistId, searchPaths);
        if (foundFile) {
            return path.basename(foundFile);
        }
    }
    
    // 默认返回 .poml 扩展名（优先级更高）
    return `${specialistId}.poml`;
}

/**
 * 从文件名中移除支持的扩展名
 */
export function removeSpecialistExtension(filename: string): string {
    for (const ext of getSupportedSpecialistExtensions()) {
        if (filename.endsWith(ext)) {
            return filename.slice(0, -ext.length);
        }
    }
    return filename;
}

/**
 * 获取文件的扩展名（如果是支持的specialist文件）
 */
export function getSpecialistFileExtension(filename: string): string | null {
    for (const ext of getSupportedSpecialistExtensions()) {
        if (filename.endsWith(ext)) {
            return ext;
        }
    }
    return null;
}
