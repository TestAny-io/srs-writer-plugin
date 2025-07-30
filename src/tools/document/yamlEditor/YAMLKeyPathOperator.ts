/**
 * YAML键路径操作器
 * 提供对YAML对象的键路径操作功能
 */

import { Logger } from '../../../utils/logger';
import { ScaffoldError, ScaffoldErrorType } from './types';

const logger = Logger.getInstance();

/**
 * YAML键路径操作器
 * 提供键路径的设置、删除、检查等操作
 */
export class YAMLKeyPathOperator {
    
    /**
     * 解析键路径为路径数组
     * @param keyPath 点分隔的键路径
     * @returns 路径数组
     */
    public static parsePath(keyPath: string): string[] {
        if (!keyPath || keyPath.trim() === '') {
            throw new ScaffoldError(
                ScaffoldErrorType.INVALID_SRS_FORMAT,
                '键路径不能为空'
            );
        }
        
        return keyPath.split('.').map(part => part.trim()).filter(part => part !== '');
    }

    /**
     * 设置键值，如果路径不存在则自动创建
     * @param data YAML数据对象
     * @param keyPath 键路径
     * @param value 要设置的值
     */
    public static set(data: any, keyPath: string, value: any): void {
        const pathArray = this.parsePath(keyPath);
        
        if (pathArray.length === 0) {
            throw new ScaffoldError(
                ScaffoldErrorType.INVALID_SRS_FORMAT,
                '无效的键路径'
            );
        }

        let current = data;
        
        // 遍历路径，自动创建中间对象
        for (let i = 0; i < pathArray.length - 1; i++) {
            const key = pathArray[i];
            
            if (!(key in current) || current[key] === null || current[key] === undefined) {
                current[key] = {};
            } else if (typeof current[key] !== 'object') {
                throw new ScaffoldError(
                    ScaffoldErrorType.INVALID_SRS_FORMAT,
                    `路径 "${pathArray.slice(0, i + 1).join('.')}" 已存在非对象值，无法继续创建路径`
                );
            }
            
            current = current[key];
        }
        
        // 设置最终值
        const finalKey = pathArray[pathArray.length - 1];
        current[finalKey] = value;
        
        logger.info(`✅ 设置键值: ${keyPath} = ${JSON.stringify(value)}`);
    }

    /**
     * 向数组追加元素
     * @param data YAML数据对象
     * @param keyPath 目标数组的键路径
     * @param value 要追加的值
     */
    public static append(data: any, keyPath: string, value: any): void {
        const pathArray = this.parsePath(keyPath);
        
        if (pathArray.length === 0) {
            throw new ScaffoldError(
                ScaffoldErrorType.INVALID_SRS_FORMAT,
                '无效的键路径'
            );
        }

        let current = data;
        
        // 遍历路径，自动创建中间对象
        for (let i = 0; i < pathArray.length - 1; i++) {
            const key = pathArray[i];
            
            if (!(key in current) || current[key] === null || current[key] === undefined) {
                current[key] = {};
            } else if (typeof current[key] !== 'object') {
                throw new ScaffoldError(
                    ScaffoldErrorType.INVALID_SRS_FORMAT,
                    `路径 "${pathArray.slice(0, i + 1).join('.')}" 已存在非对象值，无法继续创建路径`
                );
            }
            
            current = current[key];
        }
        
        // 处理目标数组
        const finalKey = pathArray[pathArray.length - 1];
        
        // 如果目标键不存在，创建新数组
        if (!(finalKey in current) || current[finalKey] === null || current[finalKey] === undefined) {
            current[finalKey] = [];
        }
        
        // 检查目标是否为数组
        if (!Array.isArray(current[finalKey])) {
            throw new ScaffoldError(
                ScaffoldErrorType.INVALID_SRS_FORMAT,
                `键路径 "${keyPath}" 对应的值不是数组，无法执行append操作`
            );
        }
        
        // 追加元素到数组
        current[finalKey].push(value);
        
        logger.info(`✅ 向数组追加元素: ${keyPath} += ${JSON.stringify(value)}`);
    }

    /**
     * 删除指定键路径
     * @param data YAML数据对象
     * @param keyPath 键路径
     * @returns 是否成功删除
     */
    public static delete(data: any, keyPath: string): boolean {
        const pathArray = this.parsePath(keyPath);
        
        if (pathArray.length === 0) {
            return false;
        }

        let current = data;
        
        // 遍历到倒数第二层
        for (let i = 0; i < pathArray.length - 1; i++) {
            const key = pathArray[i];
            
            if (!(key in current) || typeof current[key] !== 'object') {
                // 路径不存在，认为删除成功（幂等操作）
                logger.info(`ℹ️  键路径不存在，删除操作幂等成功: ${keyPath}`);
                return true;
            }
            
            current = current[key];
        }
        
        // 删除最终键 - 按数组元素删除处理
        const finalKey = pathArray[pathArray.length - 1];
        if (finalKey in current) {
            // 🆕 统一按数组索引删除处理
            const index = parseInt(finalKey, 10);
            if (!isNaN(index) && Array.isArray(current) && index >= 0 && index < current.length) {
                // 数组元素删除：使用splice真正删除
                const deletedElement = current.splice(index, 1)[0];
                logger.info(`✅ 删除数组元素: ${keyPath} (索引${index}) - ${JSON.stringify(deletedElement)}`);
            } else {
                logger.warn(`⚠️ 删除操作失败: ${keyPath} 不是有效的数组索引或超出范围`);
                return false;
            }
            return true;
        } else {
            logger.info(`ℹ️  键不存在，删除操作幂等成功: ${keyPath}`);
            return true;
        }
    }

    /**
     * 检查键路径是否存在
     * @param data YAML数据对象
     * @param keyPath 键路径
     * @returns 是否存在
     */
    public static exists(data: any, keyPath: string): boolean {
        try {
            const pathArray = this.parsePath(keyPath);
            let current = data;
            
            for (const key of pathArray) {
                if (!(key in current) || current[key] === undefined) {
                    return false;
                }
                current = current[key];
            }
            
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 获取键路径对应的值
     * @param data YAML数据对象
     * @param keyPath 键路径
     * @returns 键值，如果不存在则返回undefined
     */
    public static getValue(data: any, keyPath: string): any {
        try {
            const pathArray = this.parsePath(keyPath);
            let current = data;
            
            for (const key of pathArray) {
                if (!(key in current)) {
                    return undefined;
                }
                current = current[key];
            }
            
            return current;
        } catch {
            return undefined;
        }
    }

    /**
     * 获取所有键路径
     * @param data YAML数据对象
     * @param prefix 路径前缀
     * @param maxDepth 最大深度
     * @returns 所有键路径数组
     */
    public static extractAllKeyPaths(
        data: any, 
        prefix: string = '', 
        maxDepth: number = 10,
        currentDepth: number = 0
    ): string[] {
        const paths: string[] = [];
        
        if (currentDepth >= maxDepth || !data || typeof data !== 'object') {
            return paths;
        }

        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const currentPath = prefix ? `${prefix}.${key}` : key;
                const value = data[key];
                
                // 添加当前路径
                paths.push(currentPath);
                
                // 如果值是对象，递归处理
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    const subPaths = this.extractAllKeyPaths(
                        value, 
                        currentPath, 
                        maxDepth, 
                        currentDepth + 1
                    );
                    paths.push(...subPaths);
                }
            }
        }
        
        return paths;
    }

    /**
     * 推断值的类型
     * @param value 值
     * @returns 类型字符串
     */
    public static inferValueType(value: any): string {
        if (typeof value === 'string') return 'string';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object' && value !== null) return 'object';
        return 'string'; // 默认
    }

    /**
     * 验证键路径格式
     * @param keyPath 键路径
     * @returns 验证结果
     */
    public static validateKeyPath(keyPath: string): { valid: boolean; error?: string } {
        if (!keyPath || keyPath.trim() === '') {
            return { valid: false, error: '键路径不能为空' };
        }

        // 检查是否包含无效字符
        if (keyPath.includes('..') || keyPath.startsWith('.') || keyPath.endsWith('.')) {
            return { valid: false, error: '键路径格式无效：不能包含连续的点或以点开头/结尾' };
        }

        const parts = keyPath.split('.');
        for (const part of parts) {
            if (part.trim() === '') {
                return { valid: false, error: '键路径中不能包含空的部分' };
            }
        }

        return { valid: true };
    }
} 