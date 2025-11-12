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
        whenToUse: "Read YAML files. ⚠️ CRITICAL: NEVER read entire large YAML files at once - this causes token explosion! Always use layered exploration.",
        prerequisites: "YAML file exists at specified path (relative to workspace/project).",
        tokenOptimizationWorkflow: {
            description: "MANDATORY for files >100 lines. Saves 7.5x tokens on average.",
            steps: [
                "1️⃣ EXPLORE: parseMode='structure', maxDepth=2 → Get file overview (keys only, no values)",
                "2️⃣ EXTRACT: Use targets with specific keyPaths → Get only needed values",
                "3️⃣ DETAILED (if needed): parseMode='full' on specific targets → Get both structure and values for one section"
            ]
        },
        examples: [
            {
                scenario: "Step 1: Explore file structure first",
                input: { path: "requirements.yaml", parseMode: "structure", maxDepth: 2 }
            },
            {
                scenario: "Step 2: Extract specific values only",
                input: { path: "requirements.yaml", targets: [{ type: "keyPath", path: "functional_requirements.FR-AUTH-001" }] }
            },
            {
                scenario: "Step 3: Get detailed structure for one section",
                input: { path: "requirements.yaml", parseMode: "full", targets: [{ type: "keyPath", path: "functional_requirements.FR-AUTH-001", maxDepth: 3 }] }
            }
        ],
        criticalWarnings: [
            "🚨 NEVER use parseMode='content' or 'full' without targets on large files (>100 lines) - causes token explosion!",
            "🚨 NEVER read entire YAML files at once - always explore structure first, then extract specific paths",
            "✅ ALWAYS use 3-step workflow: structure → targets → detailed (if needed)"
        ]
    }
};

/**
 * executeYAMLEdits 工具定义
 */
export const executeYAMLEditsToolDefinition = {
    name: "executeYAMLEdits",
    description: "Execute precise editing operations on YAML files with Dictionary structure. Supports setting and deleting key-value pairs. ONLY supports Dictionary (map) structure - Array indices are NOT supported. Does not preserve comments. Specialized for .yaml/.yml files.",
    parameters: {
        type: "object",
        properties: {
            summary: {
                type: "string",
                description: "Brief summary of what this YAML editing operation will accomplish (e.g., 'Update FR-AUTH-001 priority in requirements.yaml', 'Add new functional requirement FR-DATA-003'). Used for history tracking."
            },
            targetFile: {
                type: "string",
                description: "Path to the target YAML file relative to project baseDir (or workspace root if no project is active). Do not include project name in path. Must be .yaml or .yml file. Example: 'requirements.yaml' not 'projectName/requirements.yaml'"
            },
            edits: {
                type: "array",
                description: "Array of YAML edit operations to execute on Dictionary structure",
                items: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            enum: ["set", "delete"],
                            description: "Operation type: 'set' (create/modify key-value), 'delete' (remove key). Note: 'append' is NOT supported - use 'set' to add new Dictionary entries."
                        },
                        keyPath: {
                            type: "string",
                            description: "Dictionary key path using entity IDs (e.g., 'functional_requirements.FR-AUTH-001.summary'). For 'set' operations, missing intermediate keys will be created automatically. IMPORTANT: Only Dictionary keys are supported - array indices like '0', '1' are NOT supported. Use entity IDs like 'FR-AUTH-001', 'NFR-PERF-001'."
                        },
                        value: {
                            description: "New value for the key (not required for 'delete' operation). Can be string, number, boolean, array (as a value), or nested object."
                        },
                        valueType: {
                            type: "string",
                            enum: ["string", "number", "boolean", "array", "object"],
                            description: "Type hint for the value (helps with proper YAML formatting). 'array' means the value IS an array (e.g., acceptance_criteria: ['criterion1', 'criterion2']), not that the structure is an array."
                        },
                        reason: {
                            type: "string",
                            description: "Explanation for this edit operation (e.g., 'Add authentication requirement description', 'Remove deprecated test case')"
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
    requiresConfirmation: false,
    callingGuide: {
        whenToUse: "Edit YAML files with Dictionary structure (entity IDs as keys). ONLY supports Dictionary - Array indices NOT supported.",
        structureRequirement: "🚨 CRITICAL: keyPath must use entity IDs (e.g., 'functional_requirements.FR-AUTH-001.summary'), NOT array indices (e.g., 'functional_requirements.0.summary')",
        quickStart: {
            addEntity: "Use 'set' with full keyPath: 'requirements.FR-NEW-001.summary' (auto-creates FR-NEW-001)",
            updateField: "Use 'set' on existing keyPath: 'requirements.FR-001.priority' = 'critical'",
            deleteEntity: "Use 'delete' on keyPath: 'requirements.FR-OLD-001' (idempotent - safe if not exists)",
            batchEdits: "Group related edits in one call for atomic operation"
        },
        commonExamples: [
            {
                scenario: "Add new requirement with multiple fields",
                code: {
                    summary: "Add FR-AUTH-002 with details",
                    targetFile: "requirements.yaml",
                    edits: [
                        { type: "set", keyPath: "functional_requirements.FR-AUTH-002.summary", value: "Password validation", valueType: "string", reason: "Add requirement" },
                        { type: "set", keyPath: "functional_requirements.FR-AUTH-002.priority", value: "high", valueType: "string", reason: "Set priority" }
                    ]
                }
            },
            {
                scenario: "Update field or delete entity",
                code: {
                    summary: "Update priority and remove old requirement",
                    targetFile: "requirements.yaml",
                    edits: [
                        { type: "set", keyPath: "functional_requirements.FR-AUTH-001.priority", value: "critical", valueType: "string", reason: "Upgrade priority" },
                        { type: "delete", keyPath: "functional_requirements.FR-OLD-001", reason: "Deprecated" }
                    ]
                }
            },
            {
                scenario: "Array as value (NOT structure)",
                code: {
                    summary: "Add acceptance criteria array",
                    targetFile: "requirements.yaml",
                    edits: [
                        { type: "set", keyPath: "functional_requirements.FR-AUTH-001.acceptance_criteria", value: ["criterion1", "criterion2"], valueType: "array", reason: "Define criteria" }
                    ]
                }
            }
        ],
        criticalAntiPatterns: [
            "🚨 WRONG: keyPath: 'requirements.0.summary' → Array index NOT supported",
            "✅ RIGHT: keyPath: 'requirements.FR-AUTH-001.summary' → Use entity ID",
            "🚨 WRONG: type: 'append' → NOT supported, use 'set' with new entity ID instead",
            "⚠️ Array VALUES (acceptance_criteria: ['c1', 'c2']) are OK - Array STRUCTURE (0, 1, 2 indices) is NOT"
        ],
        notes: [
            "Operations: 'set' (create/modify), 'delete' (remove) - 'append' NOT supported",
            "Auto-creation: Missing intermediate keys created automatically",
            "Idempotent: Deleting non-existent keys returns success",
            "Performance: O(1) Dictionary access vs O(n) Array search",
            "Backup: Use createBackup: true for destructive operations"
        ]
    }
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