/**
 * 需求脚手架生成工具
 * 从SRS.md文件中解析所有需求ID，根据预定义的schema生成完整的requirements_scaffold.yaml脚手架结构
 * 
 * 功能特性：
 * - 支持所有定义的ID格式（US, UC, FR, NFR, IFR, DAR, ADC-ASSU, ADC-DEPEN, ADC-CONST）
 * - 严格按照固定顺序输出实体类型
 * - 支持VSCode配置的外部Schema文件
 * - 全替换模式，生成全新的脚手架文件
 * - 包含详细的生成元数据和统计信息
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';
import { IDParser } from './scaffoldGenerator/IDParser';
import { SchemaLoader } from './scaffoldGenerator/SchemaLoader';
import { YAMLGenerator } from './scaffoldGenerator/YAMLGenerator';
import { 
    GenerateScaffoldParams, 
    GenerateResult,
    ScaffoldError, 
    ScaffoldErrorType 
} from './scaffoldGenerator/types';

/**
 * 工具定义
 */
export const requirementScaffoldToolDefinitions = [
    {
        name: 'generateRequirementScaffold',
        description: `从SRS.md文件中解析所有需求ID，根据预定义的schema生成完整的requirements_scaffold.yaml脚手架结构。

支持的ID格式：
- US-xxx: User Stories
- UC-xxx: Use Cases  
- FR-xxx: Functional Requirements
- NFR-xxx: Non-Functional Requirements
- IFR-xxx: Interface Requirements
- DAR-xxx: Data Requirements
- ADC-ASSU-xxx: Assumptions
- ADC-DEPEN-xxx: Dependencies
- ADC-CONST-xxx: Constraints

生成规则：
- 输出文件名固定为: requirements_scaffold.yaml
- 实体排序固定为: US → UC → FR → NFR → IFR → DAR → ADC-ASSU → ADC-DEPEN → ADC-CONST
- 采用全替换模式，每次生成全新的scaffold文件`,
        parameters: {
            type: 'object',
            properties: {
                srsFilePath: {
                    type: 'string',
                    description: 'SRS.md文件路径，相对于项目baseDir（或工作区根目录，如果没有活动项目）。不要在路径中包含项目名称。示例: "SRS.md" 或 "./SRS.md"'
                },

                scaffoldDir: {
                    type: 'string',
                    description: '脚手架输出目录，相对于项目baseDir。不要在路径中包含项目名称。默认: temp_requirements/scaffold',
                    default: './temp_requirements/scaffold'
                },
                includeMetadata: {
                    type: 'boolean',
                    description: '是否包含生成元数据信息（生成时间、工具版本等）',
                    default: true
                }
            },
            required: ['srsFilePath']
        },
        // 访问控制
        accessibleBy: [
            CallerType.DOCUMENT
        ],
        // 智能分类属性
        interactionType: 'autonomous',
        riskLevel: 'medium'  // 因为涉及文件写入
    }
];

/**
 * 工具实现
 */
export const requirementScaffoldToolImplementations = {
    /**
     * 生成需求脚手架
     */
    async generateRequirementScaffold(params: GenerateScaffoldParams): Promise<GenerateResult> {
        const logger = Logger.getInstance();
        const startTime = Date.now();
        
        try {
            logger.info('🚀 开始生成需求脚手架...');
            logger.info(`📋 参数: ${JSON.stringify(params, null, 2)}`);

            // 1. 验证和处理参数
            const validatedParams = await validateAndProcessParams(params);
            logger.info(`✅ 参数验证通过`);

            // 2. 读取SRS文档内容
            const srsContent = await readSRSFile(validatedParams.srsFilePath);
            logger.info(`📖 SRS文档读取成功 - 大小: ${Buffer.byteLength(srsContent, 'utf-8')} bytes`);

            // 3. 解析所有需求ID
            const extractedIds = await IDParser.extractAllIds(srsContent);
            if (extractedIds.length === 0) {
                logger.warn('⚠️  未在SRS文档中找到任何符合格式的需求ID');
                return {
                    success: false,
                    error: '未在SRS文档中找到任何符合格式的需求ID。请检查文档内容或参考支持的ID格式。'
                };
            }

            // 4. 加载Schema配置
            const schemas = await SchemaLoader.loadSchemas();

            // 5. 生成YAML脚手架
            const scaffold = await YAMLGenerator.generateScaffold({
                extractedIds,
                schemas,
                includeMetadata: validatedParams.includeMetadata
            });

            // 6. 写入文件
            const outputPath = await YAMLGenerator.writeScaffoldToFile(
                validatedParams.scaffoldDir,
                scaffold
            );

            // 7. 生成执行统计
            const executionTime = Date.now() - startTime;
            const result = {
                outputPath,
                generatedIds: extractedIds.length,
                scaffoldSections: Object.keys(scaffold).filter(key => key !== '_metadata').length,
                metadata: validatedParams.includeMetadata ? scaffold._metadata : null,
                executionTime: `${executionTime}ms`
            };

            logger.info(`🎉 需求脚手架生成成功！`);
            logger.info(`📊 执行统计: ${JSON.stringify(result, null, 2)}`);

            return {
                success: true,
                result
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            if (error instanceof ScaffoldError) {
                logger.error(`❌ 脚手架生成失败 [${error.type}]: ${error.message}`, error);
                return {
                    success: false,
                    error: `脚手架生成失败: ${error.message}`
                };
            }

            logger.error('脚手架生成过程中发生未知错误', error as Error);
            return {
                success: false,
                error: `脚手架生成失败: ${(error as Error).message}`
            };
        }
    },

    /**
     * 获取工具帮助信息
     */
    async getScaffoldHelp(): Promise<{ success: boolean; result?: string[] }> {
        try {
            const helpInfo = [
                '🛠️  需求脚手架生成器帮助',
                '',
                '📋 支持的ID格式:',
                ...IDParser.getSupportedFormats(),
                '',
                '⚙️  VSCode配置项:',
                ...SchemaLoader.getConfigurationHelp(),
                '',
                '📤 输出说明:',
                `- 文件名: ${YAMLGenerator.getOutputFilename()}`,
                `- 实体顺序: ${YAMLGenerator.getEntityOrder().join(' → ')}`,
                '- 生成模式: 全替换（每次生成全新文件）',
                '',
                '🎯 使用示例:',
                'generateRequirementScaffold({',
                '  "srsFilePath": "./docs/SRS.md",',
                '  "scaffoldDir": "./docs/scaffold",',
                '  "includeMetadata": true',
                '})'
            ];

            return {
                success: true,
                result: helpInfo
            };

        } catch (error) {
            return {
                success: false
            };
        }
    }
};

/**
 * 验证和处理参数
 */
async function validateAndProcessParams(params: GenerateScaffoldParams): Promise<Required<GenerateScaffoldParams>> {
    const logger = Logger.getInstance();

    // 验证必需参数
    if (!params.srsFilePath) {
        throw new ScaffoldError(
            ScaffoldErrorType.INVALID_SRS_FORMAT,
            'srsFilePath参数是必需的'
        );
    }

    // 🚀 智能处理scaffoldDir默认值：根据是否能获取baseDir决定
    let defaultScaffoldDir: string;
    let usingProjectBaseDir = false;
    
    try {
        // 尝试获取SessionContext的baseDir
        const { SessionManager } = await import('../../core/session-manager');
        const sessionManager = SessionManager.getInstance();
        const currentSession = await sessionManager.getCurrentSession();
        
        if (currentSession?.baseDir) {
            defaultScaffoldDir = '.'; // 直接使用项目根目录
            usingProjectBaseDir = true;
            logger.info(`📂 使用项目baseDir，scaffoldDir默认为当前目录`);
        } else {
            defaultScaffoldDir = 'temp_requirements/scaffold';
            logger.info(`📂 未找到项目baseDir，scaffoldDir默认为temp_requirements/scaffold`);
        }
    } catch (error) {
        defaultScaffoldDir = 'temp_requirements/scaffold';
        logger.info(`📂 获取SessionContext失败，scaffoldDir默认为temp_requirements/scaffold`);
    }

    const validatedParams: Required<GenerateScaffoldParams> = {
        srsFilePath: params.srsFilePath,
        scaffoldDir: params.scaffoldDir || defaultScaffoldDir,
        includeMetadata: params.includeMetadata !== undefined ? params.includeMetadata : true
    };

    // 🚀 使用智能路径解析
    validatedParams.srsFilePath = await resolveWorkspacePath(validatedParams.srsFilePath);
    validatedParams.scaffoldDir = await resolveWorkspacePath(validatedParams.scaffoldDir);

    logger.info(`🔗 解析后的SRS路径: ${validatedParams.srsFilePath}`);
    logger.info(`🔗 解析后的输出目录: ${validatedParams.scaffoldDir}`);

    return validatedParams;
}

/**
 * 🚀 智能路径解析：优先使用SessionContext的baseDir，回退到VSCode工作区
 * 参考YAMLEditor和YAMLReader的实现模式
 */
async function resolveWorkspacePath(relativePath: string): Promise<string> {
    const logger = Logger.getInstance();
    
    // 如果已经是绝对路径，直接返回
    if (path.isAbsolute(relativePath)) {
        logger.info(`🔗 路径解析（绝对路径）: ${relativePath}`);
        return relativePath;
    }

    try {
        // 🚀 优先获取SessionContext的baseDir
        const { SessionManager } = await import('../../core/session-manager');
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

/**
 * 读取SRS文件内容
 */
async function readSRSFile(srsFilePath: string): Promise<string> {
    try {
        // 检查文件是否存在
        const stat = await fs.stat(srsFilePath);
        if (!stat.isFile()) {
            throw new ScaffoldError(
                ScaffoldErrorType.FILE_NOT_FOUND,
                `指定的路径不是文件: ${srsFilePath}`
            );
        }

        // 检查文件大小（限制10MB）
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        if (stat.size > maxFileSize) {
            throw new ScaffoldError(
                ScaffoldErrorType.INVALID_SRS_FORMAT,
                `SRS文件过大 (${Math.round(stat.size / 1024 / 1024)}MB)，最大支持 10MB`
            );
        }

        // 读取文件内容
        const content = await fs.readFile(srsFilePath, 'utf-8');
        
        if (!content || content.trim().length === 0) {
            throw new ScaffoldError(
                ScaffoldErrorType.INVALID_SRS_FORMAT,
                'SRS文件内容为空'
            );
        }

        return content;

    } catch (error) {
        if (error instanceof ScaffoldError) {
            throw error;
        }

        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === 'ENOENT') {
            throw new ScaffoldError(
                ScaffoldErrorType.FILE_NOT_FOUND,
                `SRS文件不存在: ${srsFilePath}`
            );
        } else if (nodeError.code === 'EACCES') {
            throw new ScaffoldError(
                ScaffoldErrorType.PERMISSION_DENIED,
                `没有权限读取SRS文件: ${srsFilePath}`
            );
        }

        throw new ScaffoldError(
            ScaffoldErrorType.FILE_NOT_FOUND,
            `读取SRS文件失败: ${(error as Error).message}`
        );
    }
}

/**
 * 工具分类信息
 */
export const requirementScaffoldToolsCategory = {
    name: 'requirementScaffold',
    description: '需求脚手架生成工具：从SRS.md中解析ID并生成结构化YAML脚手架',
    tools: requirementScaffoldToolDefinitions.map(def => def.name),
    layer: 'document'
}; 