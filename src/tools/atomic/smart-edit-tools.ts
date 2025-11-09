import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';
import { getActiveDocumentContent } from './editor-tools';
import { showFileDiff } from '../../utils/diff-view';

// 私有工具函数 - 复制自editor-tools.ts以避免依赖已废弃的工具
async function replaceText(args: { text: string; startLine: number; endLine: number }): Promise<{ success: boolean; error?: string }> {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return { success: false, error: 'No active text editor' };
        }

        const document = activeEditor.document;
        const range = new vscode.Range(args.startLine, 0, args.endLine + 1, 0);
        
        await activeEditor.edit(editBuilder => {
            editBuilder.replace(range, args.text + '\n');
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

async function getUserSelection(): Promise<{ 
    success: boolean; 
    text?: string; 
    range?: { startLine: number; endLine: number }; 
    error?: string 
}> {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.selection || activeEditor.selection.isEmpty) {
            return { success: false, error: 'No text selected' };
        }

        const selection = activeEditor.selection;
        const text = activeEditor.document.getText(selection);

        return {
            success: true,
            text,
            range: {
                startLine: selection.start.line,
                endLine: selection.end.line
            }
        };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

const logger = Logger.getInstance();

// ============================================================================
// 智能查找和替换工具
// ============================================================================

/**
 * 🚀 智能查找替换工具：根据内容模式查找并替换
 * 用于针对性的内容修改场景
 */
export const findAndReplaceToolDefinition = {
    name: "findAndReplace",
    description: "Find and replace text in the current file with advanced pattern matching",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "File path relative to workspace root (optional, uses active editor if not provided)"
            },
            searchPattern: {
                type: "string",
                description: "Text or regex pattern to find"
            },
            replacement: {
                type: "string",
                description: "Replacement text (supports regex capture groups like $1, $2)"
            },
            isRegex: {
                type: "boolean",
                description: "Whether searchPattern is a regular expression",
                default: false
            },
            matchCase: {
                type: "boolean",
                description: "Whether to match case",
                default: false
            },
            replaceAll: {
                type: "boolean",
                description: "Replace all occurrences (true) or just first (false)",
                default: true
            },
            summary: {
                type: "string",
                description: "Brief summary describing the purpose of this find and replace operation"
            }
        },
        required: ["searchPattern", "replacement", "summary"]
    },
    // 🚀 智能分类属性
    interactionType: 'autonomous',
    riskLevel: 'medium',
    requiresConfirmation: false,
    // 🚀 访问控制：文本替换涉及编辑操作
    accessibleBy: [
        CallerType.DOCUMENT
    ]
};

export async function findAndReplace(args: {
    path?: string;
    searchPattern: string;
    replacement: string;
    isRegex?: boolean;
    matchCase?: boolean;
    replaceAll?: boolean;
    summary: string;
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
        
        if (args.path) {
            const workspaceFolder = getCurrentWorkspaceFolder();
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder is open' };
            }
            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, args.path);
            document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
            targetFilePath = args.path;
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

        // 4. 执行替换
        const originalContent = contentResult.content;
        const newContent = originalContent.replace(searchRegex, args.replacement);
        
        // 检查是否有替换发生
        if (originalContent === newContent) {
            return { success: true, matchesFound: 0, applied: false };
        }

        // 5. 应用更改
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(originalContent.length)
        );

        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return { success: false, error: 'No active editor to apply changes' };
        }

        await activeEditor.edit(editBuilder => {
            editBuilder.replace(fullRange, newContent);
        });

        // 保存文件以确保更改被写入磁盘
        await document.save();

        // 显示diff view（原始内容 vs 新内容）
        await showFileDiff(document.uri.fsPath, originalContent, newContent);

        // 6. 分析替换结果
        const originalLines = originalContent.split('\n');
        const newLines = newContent.split('\n');
        const replacements: Array<{ line: number; originalText: string; newText: string }> = [];

        // 简单的逐行比较
        const minLines = Math.min(originalLines.length, newLines.length);
        for (let i = 0; i < minLines; i++) {
            if (originalLines[i] !== newLines[i]) {
                replacements.push({
                    line: i + 1,
                    originalText: originalLines[i],
                    newText: newLines[i]
                });
            }
        }

        // 计算匹配数
        const matchCount = (originalContent.match(searchRegex) || []).length;

        logger.info(`🔄 Find and replace completed: ${matchCount} matches found, ${replacements.length} lines changed`);

        return {
            success: true,
            matchesFound: matchCount,
            applied: true,
            replacements
        };

    } catch (error) {
        const errorMsg = `Failed to find and replace: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

// ============================================================================
// 🚀 FindInFiles工具 - 多文件搜索功能 (替换原有findInFile)
// ============================================================================

/**
 * FindInFiles工具实现
 */
import { FindInFilesEngine } from './findInFiles/FindInFilesEngine';
import { FindInFilesArgs, FindInFilesResult } from './findInFiles/types';

/**
 * 🚀 多文件搜索工具定义 (替换原有findInFile工具)
 */
export const findInFilesToolDefinition = {
  name: "findInFiles",
  description: `Powerful multi-file search tool inspired by Cursor's grep functionality.

Core capabilities:
- Multi-file search across project baseDir
- Regex pattern matching with JavaScript RegExp engine  
- Flexible file filtering (glob patterns and file types)
- Multiple output formats (content/files/count)
- Context-aware result presentation

Examples:
- Basic search: findInFiles({pattern: "TODO"})                    // Search entire baseDir
- Directory search: findInFiles({pattern: "function", path: "src/"})  // Search specific directory  
- Type filtering: findInFiles({pattern: "class", type: "ts"})     // Only TypeScript files
- Glob filtering: findInFiles({pattern: "import", glob: "**/*.js"})   // Advanced pattern matching
- Regex search: findInFiles({pattern: "function\\\\s+\\\\w+", regex: true})  // Regex patterns`,
  
  parameters: {
    type: "object",
    properties: {
      // === 核心参数 ===
      pattern: { 
        type: "string", 
        description: "Text or regex pattern to search for" 
      },
      regex: { 
        type: "boolean", 
        default: false,
        description: "Use regular expression matching" 
      },
      caseSensitive: { 
        type: "boolean", 
        default: false,
        description: "Case sensitive search" 
      },
      
      // === 搜索范围控制 ===
      path: { 
        type: "string", 
        description: "File or directory path (relative to baseDir). If not provided, searches entire baseDir." 
      },
      glob: { 
        type: "string", 
        description: "File pattern (e.g. '*.ts', '**/*.md', '*.{js,ts}')" 
      },
      type: { 
        type: "string", 
        enum: ["js", "ts", "md", "yaml", "json", "html", "css"],
        description: "File type for filtering. Automatically converted to glob pattern." 
      },
      
      // === 输出控制 ===
      outputMode: {
        type: "string",
        enum: ["content", "files", "count"],
        default: "content", 
        description: "Output format: content (detailed matches), files (paths only), count (statistics)"
      },
      context: { 
        type: "number", 
        default: 5,
        minimum: 0,
        maximum: 20,
        description: "Number of context lines before/after each match" 
      },
      limit: { 
        type: "number", 
        default: 100,
        minimum: 1,
        maximum: 1000,
        description: "Maximum number of matches to return" 
      }
    },
    required: ["pattern"],
    additionalProperties: false
  },
  
  // 访问控制
  accessibleBy: [
    CallerType.ORCHESTRATOR_TOOL_EXECUTION,
    CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
    CallerType.SPECIALIST_CONTENT
  ],
  
  // 工具分类
  interactionType: 'autonomous' as const,
  riskLevel: 'low' as const,
  requiresConfirmation: false
};

/**
 * 🚀 多文件搜索工具实现 (替换原有findInFile工具)
 */
export async function findInFiles(args: FindInFilesArgs): Promise<FindInFilesResult> {
  const engine = new FindInFilesEngine();
  return await engine.search(args);
}

// ============================================================================
// 原有工具保持不变
// ============================================================================

/**
 * 🎯 选中区域替换工具：在用户选中的文件中进行查找替换
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
                description: "Text or regex pattern to find within selection"
            },
            replacement: {
                type: "string",
                description: "Replacement text"
            },
            isRegex: {
                type: "boolean",
                description: "Whether searchPattern is a regular expression",
                default: false
            },
            matchCase: {
                type: "boolean",
                description: "Whether to match case",
                default: false
            },
            replaceAll: {
                type: "boolean",
                description: "Replace all occurrences in selection (true) or just first (false)",
                default: true
            }
        },
        required: ["searchPattern", "replacement"]
    },
    // 🚀 智能分类属性
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    // 🚀 访问控制：选区替换是精确的操作，不暴露给specialist
    accessibleBy: [
        CallerType.DOCUMENT
        // 注意：移除了CallerType.SPECIALIST，specialist应使用语义编辑等高层工具
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
        
        // 检查是否有替换发生
        if (originalText === newText) {
            return { success: true, replacedCount: 0, originalSelection: originalText, newSelection: newText };
        }

        // 4. 应用更改到选区
        const replacedCount = (originalText.match(searchRegex) || []).length;
        
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return { success: false, error: 'No active editor' };
        }

        const selectionRange = new vscode.Range(
            new vscode.Position(range.startLine, 0),
            new vscode.Position(range.endLine + 1, 0)
        );

        await activeEditor.edit(editBuilder => {
            editBuilder.replace(selectionRange, newText);
        });

        logger.info(`🔄 Selection replace completed: ${replacedCount} replacements made`);

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
    return workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0] : undefined;
}

// ============================================================================
// 导出定义和实现
// ============================================================================

export const smartEditToolDefinitions = [
    findAndReplaceToolDefinition,
    findInFilesToolDefinition,  // 🚀 替换原有findInFile工具
    replaceInSelectionToolDefinition
];

export const smartEditToolImplementations = {
    findAndReplace,
    findInFiles,  // 🚀 替换原有findInFile工具实现
    replaceInSelection
};

// ============================================================================
// 工具分类信息
// ============================================================================

export const smartEditToolsCategory = {
    name: 'Smart Editing & Search',
    description: 'Intelligent find, replace, and multi-file search tools based on stable editor operations',
    icon: '🔍',
    priority: 90,
    layer: 'atomic',
    tools: [
        'findAndReplace',
        'findInFiles',    // 🚀 替换原有findInFile工具
        'replaceInSelection'
    ]
};
