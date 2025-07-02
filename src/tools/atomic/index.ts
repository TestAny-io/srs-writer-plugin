/**
 * 原子工具层统一索引 - 完全向后兼容的模块化架构
 * 
 * 🎯 设计目标：
 * 1. 完全保持向后兼容 - 现有代码无需修改
 * 2. 支持模块化导入 - 可按需导入特定类别工具
 * 3. 为未来扩展提供便利 - 新工具类别可轻松集成
 * 4. 统一类型定义 - 所有工具共享一致的接口
 * 
 * 📁 模块架构：
 * ├── filesystem-tools.ts    - 文件系统操作
 * ├── knowledge-tools.ts     - 知识检索和RAG
 * ├── editor-tools.ts        - 编辑器交互
 * ├── interaction-tools.ts   - 用户界面交互
 * ├── output-tools.ts        - 结果输出和任务控制
 * └── index.ts              - 统一导出（本文件）
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';

// ============================================================================
// 模块导入 - 按功能分类导入
// ============================================================================

// 文件系统工具
import {
    filesystemToolDefinitions,
    filesystemToolImplementations
} from './filesystem-tools';

// 编辑器工具
import {
    editorToolDefinitions,
    editorToolImplementations
} from './editor-tools';

// 用户交互工具
import {
    interactionToolDefinitions,
    interactionToolImplementations
} from './interaction-tools';

// 结果输出工具
import {
    outputToolDefinitions,
    outputToolImplementations
} from './output-tools';

// 知识工具
import {
    knowledgeToolDefinitions,
    knowledgeToolImplementations
} from './knowledge-tools-backup';



// 智能编辑工具
import {
    smartEditToolDefinitions,
    smartEditToolImplementations,
    smartEditToolsCategory
} from './smart-edit-tools';

// 🚀 Phase 1新增：编辑执行工具
import { executeEditInstructions } from './edit-execution-tools';

// 🚀 Phase 1新增：语义编辑工具
import { DocumentAnalyzer, DocumentStructure, SectionInfo, HeadingInfo } from './document-analyzer';
import { SemanticLocator, SemanticTarget, LocationResult } from './semantic-locator';

const logger = Logger.getInstance();

// ============================================================================
// 统一工具集合 - 向后兼容
// ============================================================================

/**
 * 所有原子层工具的定义数组 - 完全向后兼容
 */
export const atomicToolDefinitions = [
    ...filesystemToolDefinitions,
    ...knowledgeToolDefinitions,
    ...editorToolDefinitions,
    ...smartEditToolDefinitions,
    ...interactionToolDefinitions,
    ...outputToolDefinitions
];

/**
 * 所有原子层工具的实现映射 - 完全向后兼容
 */
export const atomicToolImplementations = {
    ...filesystemToolImplementations,
    ...knowledgeToolImplementations,
    ...editorToolImplementations,
    ...smartEditToolImplementations,
    ...interactionToolImplementations,
    ...outputToolImplementations
};

/**
 * 原子层工具分类信息 - 向后兼容
 */
export const atomicToolsCategory = {
    name: 'Atomic Tools',
    description: 'Basic VSCode API operations - file system, editor interaction, UI',
    tools: atomicToolDefinitions.map(tool => tool.name),
    layer: 'atomic'
};

/**
 * 获取所有原子层工具的定义 - 向后兼容函数
 */
export function getAllAtomicToolDefinitions() {
    return atomicToolDefinitions;
}

// ============================================================================
// 🚀 新增：模块化导入支持
// ============================================================================

/**
 * 按分类导出工具模块 - 支持按需导入
 */
export const atomicToolModules = {
    filesystem: {
        definitions: filesystemToolDefinitions,
        implementations: filesystemToolImplementations,
        description: '文件系统操作工具'
    },
    knowledge: {
        definitions: knowledgeToolDefinitions,
        implementations: knowledgeToolImplementations,
        description: '知识检索和RAG工具'
    },
    editor: {
        definitions: editorToolDefinitions,
        implementations: editorToolImplementations,
        description: '编辑器交互工具'
    },
    interaction: {
        definitions: interactionToolDefinitions,
        implementations: interactionToolImplementations,
        description: '用户界面交互工具'
    },
    output: {
        definitions: outputToolDefinitions,
        implementations: outputToolImplementations,
        description: '结果输出和任务控制工具'
    },

    smartEdit: {
        definitions: smartEditToolDefinitions,
        implementations: smartEditToolImplementations,
        description: '智能编辑工具 - 基于模式匹配的查找和替换'
    }
};

/**
 * 🚀 未来扩展接口 - 添加新工具模块的标准方式
 */
export interface AtomicToolModule {
    definitions: any[];
    implementations: Record<string, Function>;
    description: string;
}

/**
 * 🚀 动态工具注册函数 - 为未来同级别文件扩展提供便利
 */
export function registerAtomicToolModule(
    moduleName: string, 
    module: AtomicToolModule
): void {
    // 验证模块格式
    if (!module.definitions || !module.implementations || !module.description) {
        throw new Error(`Invalid atomic tool module: ${moduleName}`);
    }
    
    // 注册到模块集合
    (atomicToolModules as any)[moduleName] = module;
    
    // 添加到统一集合
    atomicToolDefinitions.push(...module.definitions);
    Object.assign(atomicToolImplementations, module.implementations);
    
    // 更新分类信息
    atomicToolsCategory.tools = atomicToolDefinitions.map(tool => tool.name);
    
    logger.info(`✅ Registered atomic tool module: ${moduleName} (${module.definitions.length} tools)`);
}

/**
 * 🚀 获取特定分类的工具 - 支持细粒度控制
 */
export function getAtomicToolsByCategory(category: keyof typeof atomicToolModules) {
    const module = atomicToolModules[category];
    if (!module) {
        throw new Error(`Unknown atomic tool category: ${category}`);
    }
    return module;
}

/**
 * 🚀 工具统计信息 - 便于监控和调试
 */
export function getAtomicToolsStats() {
    const stats = {
        totalTools: atomicToolDefinitions.length,
        categories: Object.keys(atomicToolModules).length,
        breakdown: {} as Record<string, number>
    };
    
    for (const [category, module] of Object.entries(atomicToolModules)) {
        stats.breakdown[category] = module.definitions.length;
    }
    
    return stats;
}

// ============================================================================
// 完全向后兼容的导出 - 保证现有代码正常工作
// ============================================================================

// 从原始atomicTools.ts重新导出的所有函数名（向后兼容）
export {
    // 文件系统操作
    readFile, writeFile, appendTextToFile, createDirectory, 
    listFiles, deleteFile, renameFile,
    
    // 文件系统工具定义
    readFileToolDefinition, writeFileToolDefinition, appendTextToFileToolDefinition,
    createDirectoryToolDefinition, listFilesToolDefinition, deleteFileToolDefinition,
    renameFileToolDefinition
} from './filesystem-tools';

export {
    // 编辑器操作
    getActiveDocumentContent, getUserSelection, insertText, replaceText,
    openAndShowFile, openAndSelectRange,
    
    // 编辑器工具定义
    getActiveDocumentContentToolDefinition, getUserSelectionToolDefinition,
    insertTextToolDefinition, replaceTextToolDefinition,
    openAndShowFileToolDefinition, openAndSelectRangeToolDefinition
} from './editor-tools';



export {
    // 智能编辑操作
    findAndReplace, findInFile, replaceInSelection,
    
    // 智能编辑工具定义
    findAndReplaceToolDefinition, findInFileToolDefinition, replaceInSelectionToolDefinition
} from './smart-edit-tools';

export {
    // 用户交互
    showInformationMessage, showWarningMessage, askQuestion,
    suggestNextAction, showProgressIndicator,
    
    // 用户交互工具定义
    showInformationMessageToolDefinition, showWarningMessageToolDefinition,
    askQuestionToolDefinition, suggestNextActionToolDefinition,
    showProgressIndicatorToolDefinition
} from './interaction-tools';

export {
    // 结果输出
    finalAnswer,
    
    // 结果输出工具定义
    finalAnswerToolDefinition
} from './output-tools';

export {
    // 互联网内容检索
    internetSearch,
    
    // 知识工具定义
    internetSearchToolDefinition, 
} from './knowledge-tools-backup';

export {
    // 知识检索
    readLocalKnowledge, enterpriseRAGCall, customRAGRetrieval,

    // 知识工具定义
    readLocalKnowledgeToolDefinition, enterpriseRAGCallToolDefinition, customRAGRetrievalToolDefinition,

} from './knowledge-tools-backup';

// 🚀 Phase 1新增：编辑执行工具
export {
    // 编辑指令执行
    executeEditInstructions
} from './edit-execution-tools';

// 🚀 Phase 1新增：语义编辑基础工具
export {
    // 文档分析器
    DocumentAnalyzer,
    // 类型定义
    DocumentStructure, SectionInfo, HeadingInfo
} from './document-analyzer';

export {
    // 语义定位器
    SemanticLocator,
    // 类型定义
    SemanticTarget, LocationResult
} from './semantic-locator';

// ============================================================================
// 📝 使用说明和示例
// ============================================================================

/*
使用示例：

1. 传统方式（完全向后兼容）：
   import { getAllAtomicToolDefinitions, atomicToolImplementations } from './atomic';

2. 模块化导入（新方式）：
   import { atomicToolModules } from './atomic';
   const fileSystemTools = atomicToolModules.filesystem;

3. 按需导入特定工具：
   import { readFile, writeFile } from './atomic';

4. 添加新工具模块：
   import { registerAtomicToolModule } from './atomic';
   registerAtomicToolModule('myCustomTools', {
     definitions: [...],
     implementations: {...},
     description: '我的自定义工具集'
   });

5. 获取工具统计：
   import { getAtomicToolsStats } from './atomic';
   console.log(getAtomicToolsStats());
*/ 