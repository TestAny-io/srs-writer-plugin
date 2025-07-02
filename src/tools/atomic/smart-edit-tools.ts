import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';
import { getActiveDocumentContent, replaceText, getUserSelection } from './editor-tools';

/**
 * 智能编辑工具 - 提供基于模式匹配的查找和替换功能
 * 
 * 🚀 核心价值：填补"智能查找要修改的行"的能力空白
 * 
 * 包含功能：
 * - 基于正则表达式的内容查找
 * - 智能行号定位
 * - 模式匹配替换
 * - 基于editor-tools.ts的稳定实现
 * 
 * 🔧 实现策略：
 * - 使用getActiveDocumentContent()获取文档内容
 * - 使用replaceText()执行直接编辑
 * - 避免复杂预览，提供快速可靠的编辑体验
 */

const logger = Logger.getInstance();

// ============================================================================
// 智能查找和替换工具
// ============================================================================

/**
 * 🚀 智能查找替换工具：根据内容模式查找并替换
 * 解决了"AI需要先找到要改的地方"的问题
 */
export const findAndReplaceToolDefinition = {
    name: "findAndReplace",
    description: "Find content by pattern/text and replace it with new content (intelligent line detection)",
    parameters: {
        type: "object",
        properties: {
            filePath: {
                type: "string",
                description: "File path relative to workspace root (optional, uses active editor if not provided)"
            },
            searchPattern: {
                type: "string",
                description: "Text or regex pattern to search for"
            },
            replacement: {
                type: "string",
                description: "New text to replace with"
            },
            isRegex: {
                type: "boolean",
                description: "Whether searchPattern is a regular expression (default: false)"
            },
            matchCase: {
                type: "boolean",
                description: "Whether to match case (default: false)"
            },
            replaceAll: {
                type: "boolean",
                description: "Whether to replace all occurrences (default: false, replaces only first match)"
            },
            changeDescription: {
                type: "string",
                description: "Description of what this change does"
            }
        },
        required: ["searchPattern", "replacement", "changeDescription"]
    },
    // 🚀 智能分类属性
    interactionType: 'autonomous',
    riskLevel: 'medium',
    requiresConfirmation: false,
    // 🚀 访问控制：智能查找替换是强大的编辑操作
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,  // 明确的查找替换任务
        CallerType.SPECIALIST,                    // 专家需要智能修改代码
        CallerType.DOCUMENT                       // 文档层的智能编辑
    ]
};

export async function findAndReplace(args: {
    filePath?: string;
    searchPattern: string;
    replacement: string;
    isRegex?: boolean;
    matchCase?: boolean;
    replaceAll?: boolean;
    changeDescription: string;
}): Promise<{ 
    success: boolean; 
    matchesFound?: number;
    applied?: boolean; 
    replacements?: Array<{
        line: number;
        originalText: string;
        newText: string;
    }>;
    error?: string;
}> {
    try {
        // 1. 确定目标文件并获取内容
        let document: vscode.TextDocument;
        let targetFilePath: string;
        
        if (args.filePath) {
            const workspaceFolder = getCurrentWorkspaceFolder();
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder is open' };
            }
            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, args.filePath);
            document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
            targetFilePath = args.filePath;
        } else {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                return { success: false, error: 'No file path provided and no active editor' };
            }
            document = activeEditor.document;
            const workspaceFolder = getCurrentWorkspaceFolder();
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder is open' };
            }
            targetFilePath = vscode.workspace.asRelativePath(document.uri);
        }

        // 2. 获取文档内容
        const contentResult = await getActiveDocumentContent();
        if (!contentResult.success || !contentResult.content) {
            return { success: false, error: contentResult.error || 'Failed to get document content' };
        }

        // 3. 创建搜索正则表达式
        const isRegex = args.isRegex || false;
        const matchCase = args.matchCase || false;
        
        let searchRegex: RegExp;
        try {
            if (isRegex) {
                const flags = matchCase ? 'g' : 'gi';
                searchRegex = new RegExp(args.searchPattern, flags);
            } else {
                // 转义特殊字符
                const escapedPattern = args.searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const flags = matchCase ? 'g' : 'gi';
                searchRegex = new RegExp(escapedPattern, flags);
            }
        } catch (error) {
            return { success: false, error: `Invalid regex pattern: ${(error as Error).message}` };
        }

        // 4. 搜索匹配项
        const lines = contentResult.content.split('\n');
        const replacements: Array<{
            line: number;
            originalText: string;
            newText: string;
        }> = [];

        const replaceAll = args.replaceAll || false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;
            
            // 重置正则表达式状态
            searchRegex.lastIndex = 0;
            
            if (searchRegex.test(line)) {
                // 创建新的正则表达式用于替换（避免全局状态问题）
                const replaceRegex = new RegExp(searchRegex.source, matchCase ? '' : 'i');
                const newLine = line.replace(replaceRegex, args.replacement);
                
                replacements.push({
                    line: lineNumber,
                    originalText: line,
                    newText: newLine
                });

                // 如果不是替换全部，只处理第一个匹配
                if (!replaceAll) {
                    break;
                }
            }
        }

        if (replacements.length === 0) {
            return { 
                success: true, 
                matchesFound: 0,
                applied: false,
                replacements: [],
                error: 'No matches found for the search pattern'
            };
        }

        logger.info(`🔍 Found ${replacements.length} matches for pattern: "${args.searchPattern}"`);

        // 5. 应用更改（直接编辑，从后往前替换避免行号变化）
        replacements.reverse(); // 从最后一行开始替换
        
        for (const repl of replacements) {
            const replaceResult = await replaceText({
                text: repl.newText + '\n',
                startLine: repl.line,
                endLine: repl.line
            });
            
            if (!replaceResult.success) {
                return { 
                    success: false, 
                    error: `Failed to replace text at line ${repl.line}: ${replaceResult.error}` 
                };
            }
        }

        logger.info(`✅ Applied ${replacements.length} replacements: ${args.changeDescription}`);
        return {
            success: true,
            matchesFound: replacements.length,
            applied: true,
            replacements: replacements.reverse() // 恢复原来的顺序
        };

    } catch (error) {
        const errorMsg = `Failed to find and replace: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * 🎯 智能搜索工具：查找内容并返回行号信息
 * 用于"只查找不替换"的场景
 */
export const findInFileToolDefinition = {
    name: "findInFile",
    description: "Search for text/pattern in a file and return line numbers and context",
    parameters: {
        type: "object",
        properties: {
            filePath: {
                type: "string",
                description: "File path relative to workspace root (optional, uses active editor if not provided)"
            },
            searchPattern: {
                type: "string",
                description: "Text or regex pattern to search for"
            },
            isRegex: {
                type: "boolean",
                description: "Whether searchPattern is a regular expression (default: false)"
            },
            matchCase: {
                type: "boolean",
                description: "Whether to match case (default: false)"
            },
            contextLines: {
                type: "number",
                description: "Number of context lines to show around each match (default: 2)"
            },
            maxResults: {
                type: "number",
                description: "Maximum number of matches to return (default: 10)"
            }
        },
        required: ["searchPattern"]
    },
    // 🚀 智能分类属性
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    // 🚀 访问控制：查找是安全的操作
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // 用户询问"某个函数在哪里"
        CallerType.SPECIALIST,
        CallerType.DOCUMENT
    ]
};

export async function findInFile(args: {
    filePath?: string;
    searchPattern: string;
    isRegex?: boolean;
    matchCase?: boolean;
    contextLines?: number;
    maxResults?: number;
}): Promise<{ 
    success: boolean; 
    matches?: Array<{
        line: number;
        text: string;
        context: {
            before: string[];
            after: string[];
        };
    }>;
    totalMatches?: number;
    error?: string;
}> {
    try {
        // 1. 确定目标文件并获取内容
        if (args.filePath) {
            const workspaceFolder = getCurrentWorkspaceFolder();
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder is open' };
            }
            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, args.filePath);
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
        } else {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                return { success: false, error: 'No file path provided and no active editor' };
            }
        }

        // 2. 获取文档内容
        const contentResult = await getActiveDocumentContent();
        if (!contentResult.success || !contentResult.content) {
            return { success: false, error: contentResult.error || 'Failed to get document content' };
        }

        // 3. 设置搜索参数
        const isRegex = args.isRegex || false;
        const matchCase = args.matchCase || false;
        const contextLines = args.contextLines || 2;
        const maxResults = args.maxResults || 10;

        // 4. 创建搜索正则表达式
        let searchRegex: RegExp;
        try {
            if (isRegex) {
                const flags = matchCase ? 'g' : 'gi';
                searchRegex = new RegExp(args.searchPattern, flags);
            } else {
                const escapedPattern = args.searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const flags = matchCase ? 'g' : 'gi';
                searchRegex = new RegExp(escapedPattern, flags);
            }
        } catch (error) {
            return { success: false, error: `Invalid regex pattern: ${(error as Error).message}` };
        }

        // 5. 搜索匹配项
        const lines = contentResult.content.split('\n');
        const matches: Array<{
            line: number;
            text: string;
            context: {
                before: string[];
                after: string[];
            };
        }> = [];

        let totalMatches = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 重置正则表达式状态
            searchRegex.lastIndex = 0;
            
            if (searchRegex.test(line)) {
                totalMatches++;
                
                if (matches.length < maxResults) {
                    // 获取上下文
                    const before = lines.slice(Math.max(0, i - contextLines), i);
                    const after = lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines));

                    matches.push({
                        line: i + 1, // 转为1-based
                        text: line,
                        context: {
                            before,
                            after
                        }
                    });
                }
            }
        }

        logger.info(`🔍 Found ${totalMatches} matches for pattern: "${args.searchPattern}"`);

        return {
            success: true,
            matches,
            totalMatches
        };

    } catch (error) {
        const errorMsg = `Failed to search in file: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * 🎯 选中区域替换工具：在用户选中的文本中进行查找替换
 * 用于精确的局部编辑场景
 */
export const replaceInSelectionToolDefinition = {
    name: "replaceInSelection",
    description: "Find and replace text within the user's current selection",
    parameters: {
        type: "object",
        properties: {
            searchPattern: {
                type: "string",
                description: "Text or regex pattern to search for"
            },
            replacement: {
                type: "string",
                description: "New text to replace with"
            },
            isRegex: {
                type: "boolean",
                description: "Whether searchPattern is a regular expression (default: false)"
            },
            matchCase: {
                type: "boolean",
                description: "Whether to match case (default: false)"
            },
            replaceAll: {
                type: "boolean",
                description: "Whether to replace all occurrences in selection (default: true)"
            }
        },
        required: ["searchPattern", "replacement"]
    },
    // 🚀 智能分类属性
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    // 🚀 访问控制：选区替换是精确的操作
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.SPECIALIST,
        CallerType.DOCUMENT
    ]
};

export async function replaceInSelection(args: {
    searchPattern: string;
    replacement: string;
    isRegex?: boolean;
    matchCase?: boolean;
    replaceAll?: boolean;
}): Promise<{ 
    success: boolean; 
    replacedCount?: number;
    originalSelection?: string;
    newSelection?: string;
    error?: string;
}> {
    try {
        // 1. 获取用户选择
        const selectionResult = await getUserSelection();
        if (!selectionResult.success || !selectionResult.text || !selectionResult.range) {
            return { success: false, error: selectionResult.error || 'No text selected' };
        }

        const originalText = selectionResult.text;
        const range = selectionResult.range;

        // 2. 创建搜索正则表达式
        const isRegex = args.isRegex || false;
        const matchCase = args.matchCase || false;
        const replaceAll = args.replaceAll !== false; // 默认为true
        
        let searchRegex: RegExp;
        try {
            if (isRegex) {
                const flags = replaceAll ? (matchCase ? 'g' : 'gi') : (matchCase ? '' : 'i');
                searchRegex = new RegExp(args.searchPattern, flags);
            } else {
                const escapedPattern = args.searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const flags = replaceAll ? (matchCase ? 'g' : 'gi') : (matchCase ? '' : 'i');
                searchRegex = new RegExp(escapedPattern, flags);
            }
        } catch (error) {
            return { success: false, error: `Invalid regex pattern: ${(error as Error).message}` };
        }

        // 3. 执行替换
        const newText = originalText.replace(searchRegex, args.replacement);
        
        // 计算替换次数
        let replacedCount = 0;
        if (newText !== originalText) {
            // 简单的计算方法：通过匹配次数
            const matches = originalText.match(searchRegex);
            replacedCount = matches ? matches.length : 0;
        }

        if (replacedCount === 0) {
            return {
                success: true,
                replacedCount: 0,
                originalSelection: originalText,
                newSelection: originalText,
                error: 'No matches found in the selected text'
            };
        }

        // 4. 应用替换
        const replaceResult = await replaceText({
            text: newText,
            startLine: range.startLine,
            endLine: range.endLine
        });

        if (!replaceResult.success) {
            return { 
                success: false, 
                error: `Failed to replace text in selection: ${replaceResult.error}` 
            };
        }

        logger.info(`✅ Replaced ${replacedCount} occurrences in selection`);
        return {
            success: true,
            replacedCount,
            originalSelection: originalText,
            newSelection: newText
        };

    } catch (error) {
        const errorMsg = `Failed to replace in selection: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取当前工作区文件夹
 */
function getCurrentWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0];
}

// ============================================================================
// 导出定义和实现
// ============================================================================

export const smartEditToolDefinitions = [
    findAndReplaceToolDefinition,
    findInFileToolDefinition,
    replaceInSelectionToolDefinition
];

export const smartEditToolImplementations = {
    findAndReplace,
    findInFile,
    replaceInSelection
};

// ============================================================================
// 工具分类信息
// ============================================================================

export const smartEditToolsCategory = {
    name: 'Smart Editing',
    description: 'Intelligent find and replace tools based on stable editor operations',
    icon: '🔍',
    priority: 90,
    layer: 'atomic'
}; 