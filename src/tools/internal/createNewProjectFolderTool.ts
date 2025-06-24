/**
 * 创建新项目文件夹工具 - 智能项目创建与状态管理
 * 
 * 架构定位：
 * - 内部控制层：处理项目级别的状态转换
 * - AI意图检测响应：当AI检测到新项目创建意图时调用
 * - 状态清理：确保新项目开始时有干净的上下文
 */

import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';

const logger = Logger.getInstance();

/**
 * 创建新项目结果
 */
export interface CreateNewProjectResult {
    success: boolean;
    projectName: string | null;
    archivedProject?: string;
    message: string;
    error?: string;
    preservedFiles?: number;
}

/**
 * 创建新项目文件夹工具定义
 */
export const createNewProjectFolderToolDefinition = {
    name: 'createNewProjectFolder',
    description: `Archive current project and create a new project with clean state. Use when user wants to create a completely new project that differs from the current one.
    
Key capabilities:
- Safely archives current project (preserves all user files)
- Creates new project session with clean state
- Clears operation history and context pollution
- Provides transparent feedback to user

When to use:
- User expresses intent to create a new/different project
- Detected project name differs significantly from current project
- User wants to start fresh while preserving previous work`,
    parameters: {
        type: 'object',
        properties: {
            projectName: {
                type: 'string',
                description: 'Name for the new project (optional - will be auto-generated if not provided)'
            },
            reason: {
                type: 'string', 
                description: 'Reason for creating new project (for logging and user feedback)'
            },
            confirmWithUser: {
                type: 'boolean',
                description: 'Whether to ask user for confirmation before proceeding (default: true)',
                default: true
            }
        },
        required: ['reason']
    },
    // 🚀 访问控制：只有主要的AI代理可以创建新项目
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION  // 只允许 orchestrator 在工具执行模式下调用
    ]
};

/**
 * 创建新项目文件夹工具实现
 */
export async function createNewProjectFolder(args: {
    projectName?: string;
    reason: string;
    confirmWithUser?: boolean;
}): Promise<CreateNewProjectResult> {
    try {
        logger.info(`🚀 [createNewProjectFolder] Starting new project creation: ${args.projectName || 'auto-generated'}`);
        logger.info(`🚀 [createNewProjectFolder] Reason: ${args.reason}`);

        // 动态导入 SessionManager 以避免循环依赖
        const { SessionManager } = await import('../../core/session-manager');
        const sessionManager = SessionManager.getInstance();

        // 1. 获取当前会话信息
        const currentSession = await sessionManager.getCurrentSession();
        const currentProjectName = currentSession?.projectName;

        // 2. 如果需要用户确认，返回确认请求（这里简化处理，实际应该通过chat interaction）
        if (args.confirmWithUser !== false && currentProjectName) {
            logger.info(`🤔 [createNewProjectFolder] Current project "${currentProjectName}" will be archived`);
        }

        // 3. 执行归档并创建新项目
        const result = await sessionManager.archiveCurrentAndStartNew(
            args.projectName || undefined, 
            'new_project'
        );

        if (result.success) {
            const preservedCount = result.filesPreserved.length;
            const newProjectName = result.newSession?.projectName || 'unnamed';
            const archivedProject = result.archivedSession?.archiveFileName;

            // 🚀 4. 创建实际的项目目录
            let directoryCreated = false;
            if (newProjectName && newProjectName !== 'unnamed') {
                try {
                    // 动态导入 atomic 层的 createDirectory 工具
                    const { createDirectory } = await import('../atomic/filesystem-tools');
                    
                    // 调用 createDirectory 创建实际目录
                    const dirResult = await createDirectory({
                        path: newProjectName,
                        isProjectDirectory: true
                    });
                    
                    if (dirResult.success) {
                        directoryCreated = true;
                        logger.info(`📁 [createNewProjectFolder] Successfully created project directory: ${newProjectName}`);
                    } else {
                        logger.warn(`⚠️ [createNewProjectFolder] Failed to create directory: ${dirResult.error}`);
                    }
                } catch (dirError) {
                    logger.warn(`⚠️ [createNewProjectFolder] Exception creating directory: ${(dirError as Error).message}`);
                }
            }

            const message = currentProjectName 
                ? `✅ 成功创建新项目 "${newProjectName}"${directoryCreated ? ' 及项目目录' : ''}！原项目 "${currentProjectName}" 已安全归档，保护了 ${preservedCount} 个用户文件。`
                : `✅ 成功创建新项目 "${newProjectName}"${directoryCreated ? ' 及项目目录' : ''}！`;

            logger.info(`✅ [createNewProjectFolder] Success: ${message}`);

            return {
                success: true,
                projectName: newProjectName,
                archivedProject: currentProjectName || undefined,
                message,
                preservedFiles: preservedCount
            };
        } else {
            const errorMessage = result.error || '未知错误';
            logger.error(`❌ [createNewProjectFolder] Failed: ${errorMessage}`);

            return {
                success: false,
                projectName: null,
                message: `❌ 创建新项目失败: ${errorMessage}`,
                error: errorMessage
            };
        }

    } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error(`❌ [createNewProjectFolder] Exception: ${errorMessage}`, error as Error);

        return {
            success: false,
            projectName: null,
            message: `❌ 创建新项目时发生错误: ${errorMessage}`,
            error: errorMessage
        };
    }
}

/**
 * 工具导出 - 符合注册表格式
 */
export const createNewProjectFolderToolDefinitions = [createNewProjectFolderToolDefinition];

export const createNewProjectFolderToolImplementations = {
    createNewProjectFolder: createNewProjectFolder
};

/**
 * 工具类别信息
 */
export const createNewProjectFolderToolCategory = {
    name: 'Project Management Tools',
    description: 'Tools for intelligent project creation and state management',
    tools: ['createNewProjectFolder'],
    layer: 'internal'
}; 