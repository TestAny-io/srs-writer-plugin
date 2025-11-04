/**
 * YAML编辑工具
 * 提供完整的YAML文件读取和编辑功能，与scaffoldGenerator形成完整工作流
 */

import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';
import { YAMLReader } from './yamlEditor/YAMLReader';
import { YAMLEditor } from './yamlEditor/YAMLEditor';
import { 
    ReadYAMLArgs, 
    ReadYAMLResult, 
    ExecuteYAMLEditsArgs, 
    ExecuteYAMLEditsResult 
} from './yamlEditor/types';

const logger = Logger.getInstance();

// ============================================================================
// 工具定义
// ============================================================================

/**
 * readYAMLFiles 工具定义
 */
export const readYAMLFilesToolDefinition = {
    name: "readYAMLFiles",
    description: "Read YAML files. Supports token-optimized modes: 'structure' (explore only), 'content' (full data), or 'targets' (extract specific paths).",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Relative path to YAML file. Example: 'requirements.yaml'"
            },
            parseMode: {
                type: "string",
                enum: ["structure", "content", "full"],
                description: "Controls what each target returns: 'content' (values only, default), 'structure' (structure only), 'full' (both)"
            },
            targets: {
                type: "array",
                description: "Extract specific paths only. Use after exploring with parseMode='structure'. Example: [{type: 'keyPath', path: 'functional_requirements.0'}]",
                items: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            enum: ["keyPath"],
                            description: "Target type (only 'keyPath' supported)"
                        },
                        path: {
                            type: "string",
                            description: "Dot-separated path. Use numbers for arrays: 'items.0.name'"
                        },
                        maxDepth: {
                            type: "number",
                            description: "Structure depth for this target. Default: 5",
                            default: 5,
                            minimum: 1,
                            maximum: 10
                        }
                    },
                    required: ["type", "path"]
                }
            },
            includeStructure: {
                type: "boolean",
                description: "[DEPRECATED] Use parseMode instead",
                default: true
            },
            maxDepth: {
                type: "number",
                description: "Structure analysis depth. Default: 5",
                default: 5,
                minimum: 1,
                maximum: 10
            }
        },
        required: ["path"]
    },
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
        CallerType.SPECIALIST_CONTENT,
        CallerType.SPECIALIST_PROCESS,
        CallerType.DOCUMENT
    ],
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    callingGuide: {
        whenToUse: "Read YAML files. For large files (>100 lines), use layered exploration to save tokens.",
        prerequisites: "YAML file exists at specified path (relative to workspace/project).",
        performanceNotes: [
            "Suggested Layered workflow for context token saving: 1) parseMode='structure' (file overview) → 2) targets with parseMode='content' (values only) → 3) parseMode='full' if need both",
            "targets mode never returns full file content - only requested paths",
            "Default parseMode='content' returns values without structure analysis"
        ],
        examples: [
            {
                scenario: "Explore file structure",
                input: { path: "requirements.yaml", parseMode: "structure", maxDepth: 2 }
            },
            {
                scenario: "Get values only (count array length)",
                input: { path: "requirements.yaml", targets: [{ type: "keyPath", path: "functional_requirements" }] }
            },
            {
                scenario: "Get structure to explore nested object",
                input: { path: "config.yaml", parseMode: "structure", targets: [{ type: "keyPath", path: "database", maxDepth: 2 }] }
            }
        ],
        commonPitfalls: [
            "❌ Not using targets for large files",
            "❌ Using parseMode='full' when only need values",
            "✅ Use targets with default parseMode for values only"
        ]
    }
};

/**
 * executeYAMLEdits 工具定义
 */
export const executeYAMLEditsToolDefinition = {
    name: "executeYAMLEdits",
    description: "Execute precise editing operations on YAML files. Supports setting and deleting key-value pairs. Does not preserve comments. Specialized for .yaml/.yml files.",
    parameters: {
        type: "object",
        properties: {
            summary: {
                type: "string",
                description: "Brief summary of what this YAML editing operation will accomplish (e.g., 'Update user story priorities in requirements.yaml', 'Add new functional requirements'). Used for history tracking."
            },
            targetFile: {
                type: "string",
                description: "Path to the target YAML file relative to project baseDir (or workspace root if no project is active). Do not include project name in path. Must be .yaml or .yml file. Example: 'requirements.yaml' not 'projectName/requirements.yaml'"
            },
            edits: {
                type: "array",
                description: "Array of YAML edit operations to execute",
                items: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            enum: ["set", "delete", "append"],
                            description: "Operation type: 'set' (create/modify key-value), 'delete' (remove key), 'append' (add element to array)"
                        },
                        keyPath: {
                            type: "string",
                            description: "Simple dot-separated key path (e.g., 'Functional Requirements.FR-AUTH.description'). For 'set' operations, missing intermediate keys will be created automatically. IMPORTANT: JSONPath syntax like [?(@.id=='value')] is NOT supported. Use numeric indices for arrays: 'user_stories.0.summary' not 'user_stories[?(@.id==...)]'"
                        },
                        value: {
                            description: "New value for the key (not required for 'delete' operation)"
                        },
                        valueType: {
                            type: "string",
                            enum: ["string", "number", "boolean", "array", "object"],
                            description: "Type hint for the value (helps with proper YAML formatting)"
                        },
                        reason: {
                            type: "string",
                            description: "Explanation for this edit operation"
                        }
                    },
                    required: ["type", "keyPath", "reason"]
                }
            },
            createBackup: {
                type: "boolean",
                description: "Whether to create a backup file before editing. Default: false",
                default: false
            }
        },
        required: ["summary", "targetFile", "edits"]
    },
            accessibleBy: [
            CallerType.SPECIALIST_CONTENT,
            CallerType.SPECIALIST_PROCESS,
            CallerType.DOCUMENT
        ],
    interactionType: 'autonomous',
    riskLevel: 'medium',
    requiresConfirmation: false
};

// ============================================================================
// 工具实现
// ============================================================================

/**
 * 读取YAML文件
 * @param args 读取参数
 * @returns 读取结果
 */
export async function readYAMLFiles(args: ReadYAMLArgs): Promise<ReadYAMLResult> {
    try {
        logger.info(`📖 YAML文件读取请求: ${args.path}`);
        
        const result = await YAMLReader.readAndParse(args);
        
        if (result.success) {
            logger.info(`✅ YAML文件读取成功: ${result.structure?.totalKeys || 0} 个键`);
        } else {
            logger.warn(`❌ YAML文件读取失败: ${result.error}`);
        }
        
        return result;
        
    } catch (error) {
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
 * 执行YAML编辑
 * @param args 编辑参数
 * @returns 编辑结果
 */
export async function executeYAMLEdits(args: ExecuteYAMLEditsArgs): Promise<ExecuteYAMLEditsResult> {
    try {
        logger.info(`🔧 YAML编辑请求: ${args.edits.length} 个操作，目标文件: ${args.targetFile}`);
        
        const result = await YAMLEditor.applyEdits(args);
        
        if (result.success) {
            logger.info(`✅ YAML编辑成功: ${result.appliedEdits.length} 个操作完成`);
        } else {
            logger.warn(`❌ YAML编辑失败: ${result.error}`);
        }
        
        return result;
        
    } catch (error) {
        const errorMsg = `YAML编辑失败: ${(error as Error).message}`;
        logger.error(errorMsg, error as Error);
        
        return {
            success: false,
            appliedEdits: [],
            failedEdits: args.edits,
            error: errorMsg
        };
    }
}

// ============================================================================
// 导出定义
// ============================================================================

/**
 * 工具实现映射
 */
export const yamlEditorToolImplementations = {
    readYAMLFiles,
    executeYAMLEdits: async (args: {
        summary: string;
        targetFile: string;
        edits: Array<any>;
        createBackup?: boolean;
    }) => {
        // 🚀 记录操作意图（用于调试和追踪）
        logger.info(`🎯 YAML编辑意图: ${args.summary}`);
        
        // 调用原有实现，但不传递 summary（避免破坏现有接口）
        const { summary, ...originalArgs } = args;
        return await executeYAMLEdits(originalArgs as ExecuteYAMLEditsArgs);
    }
};

/**
 * 工具定义数组
 */
export const yamlEditorToolDefinitions = [
    readYAMLFilesToolDefinition,
    executeYAMLEditsToolDefinition
];

/**
 * YAML编辑工具分类信息
 */
export const yamlEditorToolsCategory = {
    name: 'YAML Editor Tools',
    description: 'Complete YAML file reading and editing tools, complementing scaffoldGenerator workflow',
    tools: yamlEditorToolDefinitions.map(tool => tool.name),
    layer: 'document'
}; 