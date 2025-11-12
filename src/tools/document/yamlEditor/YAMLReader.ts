/**
 * YAML读取器
 * 基于SchemaLoader的成熟逻辑，扩展通用YAML文件读取和结构分析功能
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
// 🚀 真正复用：直接导入js-yaml，使用与scaffoldGenerator相同的库
import * as yaml from 'js-yaml';
import { Logger } from '../../../utils/logger';
import { resolveWorkspacePath } from '../../../utils/path-resolver';
import { YAMLStructure, ReadYAMLArgs, ReadYAMLResult, ScaffoldError, ScaffoldErrorType, TargetRequest, TargetResult, ParseMode } from './types';
import { YAMLKeyPathOperator } from './YAMLKeyPathOperator';

const logger = Logger.getInstance();

/**
 * YAML读取器
 * 复用SchemaLoader的文件处理逻辑，扩展结构分析功能
 */
export class YAMLReader {

    /**
     * 读取并解析YAML文件
     * @param args 读取参数
     * @returns 读取结果
     */
    public static async readAndParse(args: ReadYAMLArgs): Promise<ReadYAMLResult> {
        try {
            logger.info(`📖 开始读取YAML文件: ${args.path}`);

            // 1. 解析文件路径（🚀 使用公共路径解析工具）
            const resolvedPath = await resolveWorkspacePath(args.path, {
                errorType: 'scaffold',
                contextName: 'YAML文件'
            });
            logger.info(`🔗 解析后的路径: ${resolvedPath}`);

            // 2. 验证文件（复用SchemaLoader的验证逻辑）
            await this.validateYAMLFile(resolvedPath);

            // 3. 读取文件内容（复用SchemaLoader的读取逻辑）
            const content = await fs.readFile(resolvedPath, 'utf-8');
            logger.info(`📄 文件读取成功，大小: ${Buffer.byteLength(content, 'utf-8')} bytes`);

            // 4. 解析YAML（使用与scaffoldGenerator相同的yaml.load）
            // 🐛 修复: yaml.load 对空文件/仅注释/仅分隔符返回 null，需转为 {}
            const parsedData = (yaml.load(content) || {}) as any;

            // 5. 确定解析模式和参数
            const hasTargets = args.targets && args.targets.length > 0;
            const maxDepth = args.maxDepth || 5;

            // 6. 处理targets模式（优先级最高）
            if (hasTargets) {
                const parseMode: ParseMode = args.parseMode || 'content';
                logger.info(`🎯 目标提取模式: ${args.targets!.length} 个目标, parseMode: ${parseMode}`);
                const targetResults = await this.processTargets(
                    args.targets!,
                    parsedData,
                    parseMode,
                    maxDepth
                );

                return {
                    success: true,
                    content: '',  // targets模式永远不返回完整文件内容
                    targets: targetResults
                };
            }

            // 7. 处理parseMode模式（如果指定了parseMode）
            if (args.parseMode) {
                logger.info(`📊 解析模式: ${args.parseMode}`);

                switch (args.parseMode) {
                    case 'structure': {
                        // 仅返回结构信息，不返回内容和数据
                        const structure = this.analyzeStructure(parsedData, maxDepth);
                        logger.info(`📊 结构分析完成: ${structure.totalKeys} 个键，最大深度 ${structure.depth}`);
                        return {
                            success: true,
                            content: '',
                            structure
                        };
                    }

                    case 'content': {
                        // 🎯 修复：只返回parsedData，避免重复输出（content字符串和parsedData对象实际是同一内容的两种表示）
                        logger.info(`📄 返回解析数据（不返回原始字符串以避免token浪费）`);
                        return {
                            success: true,
                            content: '',  // 避免重复输出：原始YAML字符串已经包含在parsedData中
                            parsedData
                        };
                    }

                    case 'full': {
                        // 返回所有信息
                        const structure = this.analyzeStructure(parsedData, maxDepth);
                        logger.info(`📊 结构分析完成: ${structure.totalKeys} 个键，最大深度 ${structure.depth}`);
                        logger.info(`📄 返回完整信息（内容+数据+结构）`);
                        return {
                            success: true,
                            content,
                            parsedData,
                            structure
                        };
                    }
                }
            }

            // 8. 向后兼容：使用includeStructure参数（当parseMode未指定时）
            const structure = args.includeStructure !== false
                ? this.analyzeStructure(parsedData, maxDepth)
                : undefined;

            if (structure) {
                logger.info(`📊 结构分析完成: ${structure.totalKeys} 个键，最大深度 ${structure.depth}`);
            }

            return {
                success: true,
                content,
                parsedData,
                structure
            };

        } catch (error) {
            if (error instanceof ScaffoldError) {
                return {
                    success: false,
                    content: '',
                    error: error.message
                };
            }

            const errorMsg = `YAML文件读取失败: ${(error as Error).message}`;
            logger.error(errorMsg, error as Error);
            return {
                success: false,
                content: '',
                error: errorMsg
            };
        }
    }

    /**
     * 分析YAML结构
     * @param data 解析后的YAML数据
     * @param maxDepth 最大分析深度
     * @returns YAML结构信息
     */
    public static analyzeStructure(data: any, maxDepth: number = 5): YAMLStructure {
        try {
            // 使用YAMLKeyPathOperator提取所有键路径
            const keyPaths = YAMLKeyPathOperator.extractAllKeyPaths(data, '', maxDepth);

            // 分析键类型
            const keyTypes: Record<string, string> = {};
            for (const keyPath of keyPaths) {
                const value = YAMLKeyPathOperator.getValue(data, keyPath);
                keyTypes[keyPath] = YAMLKeyPathOperator.inferValueType(value);
            }

            // 计算最大深度
            const depth = keyPaths.length > 0
                ? Math.max(...keyPaths.map(path => path.split('.').length))
                : 0;

            return {
                keyPaths,
                keyTypes,
                depth,
                totalKeys: keyPaths.length
            };

        } catch (error) {
            logger.warn(`结构分析失败: ${(error as Error).message}`);
            return {
                keyPaths: [],
                keyTypes: {},
                depth: 0,
                totalKeys: 0
            };
        }
    }

    /**
     * 处理目标提取列表
     * @param targets 目标列表
     * @param parsedData 解析后的YAML数据
     * @param parseMode 解析模式
     * @param defaultMaxDepth 默认最大深度
     * @returns 目标提取结果列表
     */
    private static async processTargets(
        targets: TargetRequest[],
        parsedData: any,
        parseMode: ParseMode,
        defaultMaxDepth: number
    ): Promise<TargetResult[]> {
        const results: TargetResult[] = [];

        for (const target of targets) {
            try {
                if (target.type === 'keyPath') {
                    const result = await this.processKeyPathTarget(
                        target,
                        parsedData,
                        parseMode,
                        defaultMaxDepth
                    );
                    results.push(result);
                } else {
                    // 未知的目标类型
                    results.push({
                        type: 'keyPath',
                        path: target.path,
                        success: false,
                        error: {
                            message: `不支持的目标类型: ${target.type}`,
                            details: '当前仅支持 keyPath 类型'
                        }
                    });
                }
            } catch (error) {
                logger.warn(`目标提取失败: ${target.path}, 错误: ${(error as Error).message}`);
                results.push({
                    type: 'keyPath',
                    path: target.path,
                    success: false,
                    error: {
                        message: '目标提取失败',
                        details: (error as Error).message
                    }
                });
            }
        }

        return results;
    }

    /**
     * 处理单个keyPath目标
     * @param target 目标请求
     * @param parsedData 解析后的YAML数据
     * @param parseMode 解析模式
     * @param defaultMaxDepth 默认最大深度
     * @returns 目标提取结果
     */
    private static async processKeyPathTarget(
        target: TargetRequest,
        parsedData: any,
        parseMode: ParseMode,
        defaultMaxDepth: number
    ): Promise<TargetResult> {
        try {
            // 1. 提取值
            const value = YAMLKeyPathOperator.getValue(parsedData, target.path);

            // 2. 检查值是否存在
            if (value === undefined) {
                return {
                    type: 'keyPath',
                    path: target.path,
                    success: false,
                    error: {
                        message: '键路径不存在',
                        details: `在YAML数据中找不到键路径: ${target.path}`
                    }
                };
            }

            // 3. 推断值类型
            const valueType = YAMLKeyPathOperator.inferValueType(value);

            // 4. 根据parseMode决定返回内容
            const needsStructure = parseMode === 'structure' || parseMode === 'full';
            const needsValue = parseMode === 'content' || parseMode === 'full';

            // 5. 如果需要结构信息，分析对象/数组的结构
            let structure: YAMLStructure | undefined;
            if (needsStructure && (valueType === 'object' || valueType === 'array')) {
                const maxDepth = target.maxDepth || defaultMaxDepth;
                structure = this.analyzeStructure(value, maxDepth);
                logger.info(`📊 键路径 ${target.path} 结构分析: ${structure.totalKeys} 个键`);
            }

            // 6. 构建返回结果（只包含需要的字段）
            const result: TargetResult = {
                type: 'keyPath',
                path: target.path,
                success: true,
                valueType
            };

            // 只在需要时添加value字段
            if (needsValue) {
                result.value = value;
            }

            // 只在需要且已分析时添加structure字段
            if (structure) {
                result.structure = structure;
            }

            return result;

        } catch (error) {
            logger.warn(`处理keyPath目标失败: ${target.path}, 错误: ${(error as Error).message}`);
            return {
                type: 'keyPath',
                path: target.path,
                success: false,
                error: {
                    message: 'keyPath提取失败',
                    details: (error as Error).message
                }
            };
        }
    }

    // 🚀 路径解析现在使用公共工具 resolveWorkspacePath

    /**
     * 验证YAML文件是否存在且可读
     * 🚀 复用SchemaLoader的文件验证逻辑
     */
    private static async validateYAMLFile(filePath: string): Promise<void> {
        try {
            const stat = await fs.stat(filePath);
            
            if (!stat.isFile()) {
                throw new ScaffoldError(
                    ScaffoldErrorType.FILE_NOT_FOUND,
                    `YAML路径不是文件: ${filePath}`
                );
            }

            // 检查文件权限
            await fs.access(filePath);

        } catch (error) {
            if (error instanceof ScaffoldError) {
                throw error;
            }

            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code === 'ENOENT') {
                throw new ScaffoldError(
                    ScaffoldErrorType.FILE_NOT_FOUND,
                    `YAML文件不存在: ${filePath}`
                );
            } else if (nodeError.code === 'EACCES') {
                throw new ScaffoldError(
                    ScaffoldErrorType.PERMISSION_DENIED,
                    `没有权限读取YAML文件: ${filePath}`
                );
            }

            throw new ScaffoldError(
                ScaffoldErrorType.SCHEMA_LOAD_FAILED,
                `访问YAML文件失败: ${(error as Error).message}`
            );
        }
    }

    /**
     * 检查文件是否为YAML格式
     * @param filePath 文件路径
     * @returns 是否为YAML文件
     */
    public static isYAMLFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return ext === '.yaml' || ext === '.yml';
    }
} 