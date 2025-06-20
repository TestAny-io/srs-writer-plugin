import * as yaml from 'js-yaml';
import { Logger } from '../../utils/logger';
import * as AtomicTools from '../atomic/atomicTools';
import { marked } from 'marked';

/**
 * 需求管理专家工具模块
 * 
 * 设计理念：
 * 🧠 AI交互层：面向意图的"胖工具"，AI只看到高层业务操作
 * 🔧 内部实现层：遵循单一职责原则的私有函数，代码组织良好
 * 
 * AI永远不会知道内部实现细节，只看到业务级工具：
 * - addNewRequirement: 添加新的功能需求
 * - updateRequirement: 更新现有需求
 * - deleteRequirement: 删除需求
 * - listRequirements: 列出所有需求
 */

const logger = Logger.getInstance();

// ============================================================================
// 内部实现层 - 私有函数，专注单一职责
// AI永远看不到这些，它们是纯粹的代码组织
// ============================================================================

/**
 * 🔧 内部函数：生成新的需求ID
 */
async function _createRequirementId(existingRequirements: any[]): Promise<string> {
    const existingIds = existingRequirements
        ?.filter(req => req.id?.startsWith('FR-'))
        ?.map(req => {
            const match = req.id.match(/FR-(\d+)/);
            return match ? parseInt(match[1]) : 0;
        }) || [];
    
    const nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    return `FR-${nextNumber.toString().padStart(3, '0')}`;
}

/**
 * 🔧 内部函数：从项目中读取现有需求
 */
async function _getExistingRequirements(projectPath: string): Promise<{ success: boolean; requirements: any[]; content?: string }> {
    const frYamlPath = `${projectPath}/fr.yaml`;
    const frResult = await AtomicTools.readFile({ path: frYamlPath });
    
    if (!frResult.success) {
        return { success: true, requirements: [] }; // 新项目，没有现有需求
    }
    
    try {
        const data = yaml.load(frResult.content!) as any;
        return {
            success: true,
            requirements: data?.functional_requirements || [],
            content: frResult.content
        };
    } catch (yamlError) {
        logger.warn(`Failed to parse fr.yaml, treating as empty: ${yamlError}`);
        return { success: true, requirements: [] };
    }
}

/**
 * 🔧 内部函数：保存需求到YAML文件
 */
async function _saveRequirementsToYAML(projectPath: string, requirements: any[]): Promise<void> {
    const frYamlPath = `${projectPath}/fr.yaml`;
    const yamlData = { functional_requirements: requirements };
    
    const updatedYaml = yaml.dump(yamlData, {
        defaultFlowStyle: false,
        indent: 2,
        lineWidth: -1
    });
    
    await AtomicTools.writeFile({ path: frYamlPath, content: updatedYaml });
    logger.info(`✅ Saved ${requirements.length} requirements to ${frYamlPath}`);
}

/**
 * 🔧 内部函数：生成功能需求markdown表格
 */
function _generateRequirementsMarkdownTable(requirements: any[]): string {
    if (!requirements || requirements.length === 0) {
        return '| FR-ID | 需求名称 | 优先级 | 详细描述 | 验收标准 | 备注 |\n|-------|---------|--------|----------|----------|------|\n';
    }

    let table = '| FR-ID | 需求名称 | 优先级 | 详细描述 | 验收标准 | 备注 |\n';
    table += '|-------|---------|--------|----------|----------|------|\n';

    for (const req of requirements) {
        const id = req.id || '';
        const name = req.name || '';
        const priority = req.priority || '';
        const description = (req.description || '').replace(/\|/g, '&#124;').replace(/\n/g, '<br/>');
        const acceptance = (req.acceptance_criteria || '').replace(/\|/g, '&#124;').replace(/\n/g, '<br/>');
        const notes = (req.notes || '').replace(/\|/g, '&#124;').replace(/\n/g, '<br/>');
        
        table += `| ${id} | ${name} | ${priority} | ${description} | ${acceptance} | ${notes} |\n`;
    }

    return table;
}

/**
 * 🔧 内部函数：在SRS.md中更新功能需求表格
 */
async function _updateRequirementsInSRS(projectPath: string, requirements: any[]): Promise<void> {
    const srsPath = `${projectPath}/SRS.md`;
    const srsResult = await AtomicTools.readFile({ path: srsPath });
    
    if (!srsResult.success) {
        throw new Error(`无法读取SRS.md文件: ${srsPath}`);
    }
    
    const newTable = _generateRequirementsMarkdownTable(requirements);
    const updatedContent = _updateFunctionalRequirementsTableInMarkdown(srsResult.content!, newTable);
    
    await AtomicTools.writeFile({ path: srsPath, content: updatedContent });
    logger.info(`✅ Updated functional requirements table in ${srsPath}`);
}

/**
 * 🔧 内部函数：使用AST更新markdown中的功能需求表格
 */
function _updateFunctionalRequirementsTableInMarkdown(srsContent: string, newTable: string): string {
    try {
        const tokens = marked.lexer(srsContent);
        
        let targetHeadingIndex = -1;
        let tableIndex = -1;
        
        // 目标标题的可能变体
        const headingTexts = ['功能需求', 'Functional Requirements', '3. 功能需求', '3.功能需求', '3 功能需求'];
        
        // 第一步：找到功能需求标题
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.type === 'heading' && token.depth >= 2) {
                const headingText = token.text.trim();
                if (_isHeadingMatch(headingText, headingTexts)) {
                    targetHeadingIndex = i;
                    logger.info(`Found functional requirements heading at index ${i}: "${headingText}"`);
                    break;
                }
            }
        }
        
        if (targetHeadingIndex === -1) {
            throw new Error(`未找到功能需求标题，支持的标题格式：${headingTexts.join(', ')}`);
        }
        
        // 第二步：找到功能需求表格
        for (let i = targetHeadingIndex + 1; i < tokens.length; i++) {
            const token = tokens[i];
            
            // 如果遇到新的同级或更高级标题，停止搜索
            if (token.type === 'heading' && token.depth <= (tokens[targetHeadingIndex] as any).depth) {
                break;
            }
            
            // 找到表格
            if (token.type === 'table') {
                tableIndex = i;
                logger.info(`Found functional requirements table at index ${i}`);
                break;
            }
        }
        
        if (tableIndex === -1) {
            // 如果没有表格，在标题后插入新表格
            logger.info('No existing table found, inserting new table after heading');
            const newTableTokens = marked.lexer('\n' + newTable.trim() + '\n');
            const newTableToken = newTableTokens.find(token => token.type === 'table');
            
            if (!newTableToken) {
                throw new Error('新表格内容格式无效');
            }
            
            // 在标题后插入表格
            tokens.splice(targetHeadingIndex + 1, 0, newTableToken);
        } else {
            // 替换现有表格
            const newTableTokens = marked.lexer(newTable.trim());
            const newTableToken = newTableTokens.find(token => token.type === 'table');
            
            if (!newTableToken) {
                throw new Error('新表格内容格式无效');
            }
            
            tokens[tableIndex] = newTableToken;
            logger.info('Replaced existing functional requirements table');
        }
        
        // 重新渲染为markdown
        const result = marked.parser(tokens);
        logger.info('✅ SRS.md functional requirements table updated successfully');
        return result;
        
    } catch (error) {
        logger.error('Failed to update functional requirements table in SRS.md', error as Error);
        throw new Error(`更新SRS.md中的功能需求表格失败: ${(error as Error).message}`);
    }
}

/**
 * 🔧 内部函数：检查标题是否匹配
 */
function _isHeadingMatch(headingText: string, targetTexts: string[]): boolean {
    const normalizedHeading = headingText.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    return targetTexts.some(target => {
        const normalizedTarget = target.toLowerCase().replace(/[^\w\s]/g, '').trim();
        return normalizedHeading.includes(normalizedTarget) || normalizedTarget.includes(normalizedHeading);
    });
}

/**
 * 🔧 内部函数：创建备份文件
 */
async function _createBackupFiles(projectPath: string): Promise<{ frBackup?: string; srsBackup?: string }> {
    const timestamp = Date.now();
    const backups: { frBackup?: string; srsBackup?: string } = {};
    
    // 备份fr.yaml（如果存在）
    const frResult = await AtomicTools.readFile({ path: `${projectPath}/fr.yaml` });
    if (frResult.success) {
        backups.frBackup = `${projectPath}/fr.yaml.backup.${timestamp}`;
        await AtomicTools.writeFile({ path: backups.frBackup, content: frResult.content! });
    }
    
    // 备份SRS.md
    const srsResult = await AtomicTools.readFile({ path: `${projectPath}/SRS.md` });
    if (srsResult.success) {
        backups.srsBackup = `${projectPath}/SRS.md.backup.${timestamp}`;
        await AtomicTools.writeFile({ path: backups.srsBackup, content: srsResult.content! });
    }
    
    return backups;
}

/**
 * 🔧 内部函数：回滚备份文件
 */
async function _rollbackFromBackups(projectPath: string, backups: { frBackup?: string; srsBackup?: string }): Promise<void> {
    try {
        if (backups.frBackup) {
            const backupResult = await AtomicTools.readFile({ path: backups.frBackup });
            if (backupResult.success) {
                await AtomicTools.writeFile({ path: `${projectPath}/fr.yaml`, content: backupResult.content! });
                await AtomicTools.deleteFile({ path: backups.frBackup });
                logger.info(`🔄 Rolled back fr.yaml from backup`);
            }
        }
        
        if (backups.srsBackup) {
            const backupResult = await AtomicTools.readFile({ path: backups.srsBackup });
            if (backupResult.success) {
                await AtomicTools.writeFile({ path: `${projectPath}/SRS.md`, content: backupResult.content! });
                await AtomicTools.deleteFile({ path: backups.srsBackup });
                logger.info(`🔄 Rolled back SRS.md from backup`);
            }
        }
    } catch (rollbackError) {
        logger.error(`💥 CRITICAL: Rollback failed!`, rollbackError as Error);
        throw rollbackError;
    }
}

// ============================================================================
// AI交互层 - 面向意图的"胖工具"
// 这些是AI唯一能看到的工具，每个都是完整的业务操作
// ============================================================================

/**
 * 🧠 AI工具：添加新的功能需求
 * AI看到的是完整的业务操作，无需关心内部实现细节
 */
export const addNewRequirementToolDefinition = {
    name: "addNewRequirement",
    description: "Add a new functional requirement to the project (complete business operation)",
    parameters: {
        type: "object",
        properties: {
            projectPath: {
                type: "string",
                description: "The project directory path (e.g., 'my-project')"
            },
            requirement: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Name of the requirement"
                    },
                    priority: {
                        type: "string",
                        enum: ["高", "中", "低"],
                        description: "Priority level"
                    },
                    description: {
                        type: "string",
                        description: "Detailed description of the requirement"
                    },
                    acceptance_criteria: {
                        type: "string",
                        description: "Acceptance criteria for the requirement"
                    },
                    notes: {
                        type: "string",
                        description: "Additional notes (optional)"
                    }
                },
                required: ["name", "priority", "description", "acceptance_criteria"]
            }
        },
        required: ["projectPath", "requirement"]
    }
};

export async function addNewRequirement(args: {
    projectPath: string;
    requirement: {
        name: string;
        priority: string;
        description: string;
        acceptance_criteria: string;
        notes?: string;
    };
}): Promise<{ success: boolean; message: string; requirementId?: string }> {
    
    const { projectPath, requirement } = args;
    logger.info(`🧠 [AI TOOL] Adding new requirement to project: ${projectPath}`);
    
    let backups: { frBackup?: string; srsBackup?: string } = {};
    
    try {
        // 1. 验证项目状态
        const srsResult = await AtomicTools.readFile({ path: `${projectPath}/SRS.md` });
        if (!srsResult.success) {
            return {
                success: false,
                message: `SRS.md文件不存在: ${projectPath}/SRS.md，请先创建项目主文档`
            };
        }

        // 2. 创建备份（事务保障）
        backups = await _createBackupFiles(projectPath);

        // 3. 获取现有需求
        const { requirements } = await _getExistingRequirements(projectPath);

        // 4. 生成新需求
        const newRequirementId = await _createRequirementId(requirements);
        const newRequirement = {
            id: newRequirementId,
            name: requirement.name,
            priority: requirement.priority,
            description: requirement.description,
            acceptance_criteria: requirement.acceptance_criteria,
            notes: requirement.notes || '',
            created_at: new Date().toISOString(),
            status: '待实现'
        };

        // 5. 添加到需求列表
        const updatedRequirements = [...requirements, newRequirement];

        // 6. 原子性保存（关键时刻）
        await _saveRequirementsToYAML(projectPath, updatedRequirements);
        await _updateRequirementsInSRS(projectPath, updatedRequirements);

        // 7. 清理备份
        if (backups.frBackup) await AtomicTools.deleteFile({ path: backups.frBackup });
        if (backups.srsBackup) await AtomicTools.deleteFile({ path: backups.srsBackup });

        logger.info(`🎉 [AI TOOL SUCCESS] Requirement ${newRequirementId} added successfully`);
        
        return {
            success: true,
            message: `✅ 功能需求已成功添加：${newRequirementId} - ${requirement.name}`,
            requirementId: newRequirementId
        };

    } catch (error) {
        logger.error(`❌ [AI TOOL ROLLBACK] Failed to add requirement`, error as Error);
        
        // 回滚机制
        try {
            await _rollbackFromBackups(projectPath, backups);
        } catch (rollbackError) {
            return {
                success: false,
                message: `严重错误：添加需求失败且回滚失败，请手动检查文件状态。原始错误：${(error as Error).message}`
            };
        }
        
        return {
            success: false,
            message: `添加功能需求失败（已自动回滚）：${(error as Error).message}`
        };
    }
}

/**
 * 🧠 AI工具：列出项目中的所有功能需求
 */
export const listRequirementsToolDefinition = {
    name: "listRequirements",
    description: "List all functional requirements in a project",
    parameters: {
        type: "object",
        properties: {
            projectPath: {
                type: "string",
                description: "The project directory path"
            }
        },
        required: ["projectPath"]
    }
};

export async function listRequirements(args: { projectPath: string }): Promise<{
    success: boolean;
    message: string;
    requirements?: any[];
}> {
    const { projectPath } = args;
    logger.info(`🧠 [AI TOOL] Listing requirements from project: ${projectPath}`);
    
    try {
        const { success, requirements } = await _getExistingRequirements(projectPath);
        
        if (!success) {
            return {
                success: false,
                message: "获取功能需求列表失败"
            };
        }
        
        return {
            success: true,
            message: `找到 ${requirements.length} 个功能需求`,
            requirements: requirements
        };

    } catch (error) {
        logger.error(`Failed to list requirements from ${projectPath}`, error as Error);
        return {
            success: false,
            message: `获取功能需求列表失败: ${(error as Error).message}`
        };
    }
}

// ============================================================================
// 导出聚合 - 适配工具注册表格式
// ============================================================================

/**
 * 所有需求工具的定义数组
 */
export const requirementToolDefinitions = [
    addNewRequirementToolDefinition,
    listRequirementsToolDefinition
];

/**
 * 所有需求工具的实现映射
 */
export const requirementToolImplementations = {
    addNewRequirement,
    listRequirements
};

/**
 * 需求工具分类信息
 */
export const requirementToolsCategory = {
    name: 'Requirement Management Tools',
    description: 'Specialist tools for functional requirements management in SRS projects',
    tools: requirementToolDefinitions.map(tool => tool.name),
    layer: 'specialist'
}; 