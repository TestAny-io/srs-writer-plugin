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
import { YAMLStructure, ReadYAMLArgs, ReadYAMLResult, ScaffoldError, ScaffoldErrorType } from './types';
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
            const parsedData = yaml.load(content) as any;

            // 5. 生成结构信息（新功能）
            let structure: YAMLStructure | undefined;
            if (args.includeStructure !== false) {
                structure = this.analyzeStructure(parsedData, args.maxDepth || 5);
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