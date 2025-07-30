/**
 * YAML编辑器
 * 复用YAMLGenerator的成熟写入逻辑，提供YAML文件编辑功能
 */

import * as fs from 'fs/promises';
import * as path from 'path';
// 🚀 真正复用：直接导入js-yaml，使用与scaffoldGenerator相同的库和配置
import * as yaml from 'js-yaml';
import { Logger } from '../../../utils/logger';
import { 
    ExecuteYAMLEditsArgs, 
    ExecuteYAMLEditsResult, 
    YAMLEditOperation,
    YAMLEditOptions,
    ScaffoldError, 
    ScaffoldErrorType 
} from './types';
import { YAMLReader } from './YAMLReader';
import { YAMLKeyPathOperator } from './YAMLKeyPathOperator';

const logger = Logger.getInstance();

/**
 * YAML编辑器
 * 基于YAMLGenerator的写入配置和SchemaLoader的读取逻辑
 */
export class YAMLEditor {

    /**
     * 应用YAML编辑操作
     * @param args 编辑参数
     * @returns 编辑结果
     */
    public static async applyEdits(args: ExecuteYAMLEditsArgs): Promise<ExecuteYAMLEditsResult> {
        const startTime = Date.now();
        const appliedEdits: YAMLEditOperation[] = [];
        const failedEdits: YAMLEditOperation[] = [];

        try {
            logger.info(`🔧 开始YAML编辑: ${args.edits.length} 个操作`);

            // 1. 验证目标文件
            if (!YAMLReader.isYAMLFile(args.targetFile)) {
                throw new ScaffoldError(
                    ScaffoldErrorType.INVALID_SRS_FORMAT,
                    `目标文件不是YAML格式: ${args.targetFile}`
                );
            }

            // 2. 读取和解析YAML文件
            const readResult = await YAMLReader.readAndParse({
                path: args.targetFile,
                includeStructure: false // 编辑时不需要结构分析
            });

            if (!readResult.success || !readResult.parsedData) {
                throw new ScaffoldError(
                    ScaffoldErrorType.SCHEMA_LOAD_FAILED,
                    `读取YAML文件失败: ${readResult.error || '未知错误'}`
                );
            }

            const data = readResult.parsedData;
            const originalFileSize = Buffer.byteLength(readResult.content, 'utf-8');

            // 3. 创建备份（如果需要）
            let backupPath: string | undefined;
            if (args.createBackup) {
                backupPath = await this.createBackup(args.targetFile, readResult.content);
                logger.info(`💾 创建备份文件: ${backupPath}`);
            }

            // 4. 验证所有编辑操作
            for (const edit of args.edits) {
                const validation = YAMLKeyPathOperator.validateKeyPath(edit.keyPath);
                if (!validation.valid) {
                    failedEdits.push(edit);
                    logger.warn(`❌ 编辑操作验证失败: ${edit.keyPath} - ${validation.error}`);
                    continue;
                }
            }

            // 5. 应用编辑操作
            for (const edit of args.edits) {
                // 跳过已经失败的操作
                if (failedEdits.includes(edit)) {
                    continue;
                }

                try {
                    await this.applyEditOperation(data, edit);
                    appliedEdits.push(edit);
                    logger.info(`✅ 编辑操作成功: ${edit.type} ${edit.keyPath}`);
                } catch (error) {
                    failedEdits.push(edit);
                    logger.warn(`❌ 编辑操作失败: ${edit.keyPath} - ${(error as Error).message}`);
                }
            }

            // 6. 写入文件（使用YAMLGenerator的配置）
            if (appliedEdits.length > 0) {
                await this.writeYAMLFile(args.targetFile, data);
                logger.info(`💾 YAML文件写入成功: ${args.targetFile}`);
            }

            // 7. 生成结果
            const executionTime = Date.now() - startTime;
            const success = appliedEdits.length > 0 && failedEdits.length === 0;

            logger.info(`🎉 YAML编辑完成: ${appliedEdits.length} 成功, ${failedEdits.length} 失败`);

            return {
                success,
                appliedEdits,
                failedEdits,
                backupPath,
                error: failedEdits.length > 0 ? `${failedEdits.length} 个操作失败` : undefined,
                metadata: {
                    totalOperations: args.edits.length,
                    executionTime,
                    fileSize: originalFileSize
                }
            };

        } catch (error) {
            if (error instanceof ScaffoldError) {
                logger.error(`❌ YAML编辑失败: ${error.message}`, error);
                return {
                    success: false,
                    appliedEdits,
                    failedEdits: args.edits,
                    error: error.message
                };
            }

            const errorMsg = `YAML编辑失败: ${(error as Error).message}`;
            logger.error(errorMsg, error as Error);
            return {
                success: false,
                appliedEdits,
                failedEdits: args.edits,
                error: errorMsg
            };
        }
    }

    /**
     * 应用单个编辑操作
     * @param data YAML数据对象
     * @param edit 编辑操作
     */
    private static async applyEditOperation(data: any, edit: YAMLEditOperation): Promise<void> {
        switch (edit.type) {
            case 'set':
                if (edit.value === undefined) {
                    throw new Error('set操作需要提供value参数');
                }
                YAMLKeyPathOperator.set(data, edit.keyPath, edit.value);
                break;

            case 'delete':
                YAMLKeyPathOperator.delete(data, edit.keyPath);
                break;

            case 'append':
                if (edit.value === undefined) {
                    throw new Error('append操作需要提供value参数');
                }
                YAMLKeyPathOperator.append(data, edit.keyPath, edit.value);
                break;

            default:
                throw new Error(`不支持的操作类型: ${edit.type}`);
        }
    }

    /**
     * 写入YAML文件
     * 🚀 真正复用：使用与YAMLGenerator完全相同的yaml.dump配置
     * @param filePath 文件路径
     * @param data YAML数据
     */
    private static async writeYAMLFile(filePath: string, data: any): Promise<void> {
        try {
            // 🚀 复用YAMLGenerator的精确配置，不复制代码
            const yamlContent = yaml.dump(data, {
                indent: 2,              // 2空格缩进
                noRefs: true,           // 避免YAML引用
                sortKeys: false,        // 保持字段顺序
                lineWidth: -1,          // 不限制行宽
                noCompatMode: true,     // 使用新版YAML格式
                quotingType: '"',       // 使用双引号
                forceQuotes: false      // 不强制引号
            });

            // 解析文件路径（🚀 修复：使用SessionContext的baseDir）
            const resolvedPath = await this.resolveWorkspacePath(filePath);
            
            // 确保目录存在
            const dir = path.dirname(resolvedPath);
            await fs.mkdir(dir, { recursive: true });

            // 写入文件
            await fs.writeFile(resolvedPath, yamlContent, 'utf-8');
            
            logger.info(`✅ YAML文件写入成功: ${resolvedPath}`);

        } catch (error) {
            throw new ScaffoldError(
                ScaffoldErrorType.OUTPUT_WRITE_FAILED,
                `写入YAML文件失败: ${(error as Error).message}`
            );
        }
    }

    /**
     * 创建备份文件
     * @param filePath 原文件路径
     * @param content 文件内容
     * @returns 备份文件路径
     */
    private static async createBackup(filePath: string, content: string): Promise<string> {
        try {
            const resolvedPath = await this.resolveWorkspacePath(filePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${resolvedPath}.backup.${timestamp}`;
            
            await fs.writeFile(backupPath, content, 'utf-8');
            return backupPath;

        } catch (error) {
            throw new ScaffoldError(
                ScaffoldErrorType.OUTPUT_WRITE_FAILED,
                `创建备份文件失败: ${(error as Error).message}`
            );
        }
    }

    /**
     * 🚀 修复：解析相对于项目根目录的绝对路径
     * 优先使用SessionContext的baseDir，回退到VSCode工作区
     */
    private static async resolveWorkspacePath(relativePath: string): Promise<string> {
        // 如果已经是绝对路径，直接返回
        if (path.isAbsolute(relativePath)) {
            logger.info(`🔗 路径解析（绝对路径）: ${relativePath}`);
            return relativePath;
        }

        try {
            // 🚀 优先获取SessionContext的baseDir
            const { SessionManager } = await import('../../../core/session-manager');
            const sessionManager = SessionManager.getInstance();
            const currentSession = await sessionManager.getCurrentSession();
            
            if (currentSession?.baseDir) {
                const absolutePath = path.resolve(currentSession.baseDir, relativePath);
                logger.info(`🔗 路径解析（使用项目baseDir）: ${relativePath} -> ${absolutePath}`);
                logger.info(`📂 项目baseDir: ${currentSession.baseDir}`);
                return absolutePath;
            } else {
                logger.warn(`⚠️ SessionContext中没有baseDir，回退到工作区根目录`);
            }
        } catch (error) {
            logger.warn(`⚠️ 获取SessionContext失败，回退到工作区根目录: ${(error as Error).message}`);
        }

        // 🚀 回退策略：使用VSCode工作区根目录
        const vscode = require('vscode');
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new ScaffoldError(
                ScaffoldErrorType.SCHEMA_LOAD_FAILED,
                '未找到VSCode工作区，无法解析文件路径'
            );
        }

        // 使用第一个工作区文件夹作为根目录
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const absolutePath = path.resolve(workspaceRoot, relativePath);

        logger.info(`🔗 路径解析（回退到工作区根目录）: ${relativePath} -> ${absolutePath}`);
        return absolutePath;
    }
} 