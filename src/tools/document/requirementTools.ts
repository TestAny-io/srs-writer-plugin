import * as yaml from 'js-yaml';
import { Logger } from '../../utils/logger';
import { marked } from 'marked';
import { CallerType } from '../../types';
import { writeFile, deleteFile } from '../atomic';
import { readMarkdownFile } from './enhanced-readfile-tools';

/**
 * 需求管理文档工具模块
 * 
 * 设计理念：
 * 🧠 AI交互层：面向意图的"胖工具"，AI只看到高层业务操作
 * 🔧 内部实现层：遵循单一职责原则的私有函数，代码组织良好
 * 
 * AI永远不会知道内部实现细节，只看到业务级工具：
 * - [DEPRECATED] addNewRequirement: 已移除
 * - updateRequirement: 更新现有需求
 * - deleteRequirement: 删除需求
 * - [DEPRECATED] listRequirements: 已移除
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
    const frResult = await readMarkdownFile({ path: frYamlPath });
    
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
    
    await writeFile({ path: frYamlPath, content: updatedYaml });
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
    const srsResult = await readMarkdownFile({ path: srsPath });
    
    if (!srsResult.success) {
        throw new Error(`无法读取SRS.md文件: ${srsPath}`);
    }
    
    const newTable = _generateRequirementsMarkdownTable(requirements);
    const updatedContent = _updateFunctionalRequirementsTableInMarkdown(srsResult.content!, newTable);
    
    await writeFile({ path: srsPath, content: updatedContent });
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
            const frResult = await readMarkdownFile({ path: `${projectPath}/fr.yaml` });
    if (frResult.success) {
        backups.frBackup = `${projectPath}/fr.yaml.backup.${timestamp}`;
        await writeFile({ path: backups.frBackup, content: frResult.content! });
    }
    
    // 备份SRS.md
            const srsResult = await readMarkdownFile({ path: `${projectPath}/SRS.md` });
    if (srsResult.success) {
        backups.srsBackup = `${projectPath}/SRS.md.backup.${timestamp}`;
        await writeFile({ path: backups.srsBackup, content: srsResult.content! });
    }
    
    return backups;
}

/**
 * 🔧 内部函数：回滚备份文件
 */
async function _rollbackFromBackups(projectPath: string, backups: { frBackup?: string; srsBackup?: string }): Promise<void> {
    try {
        if (backups.frBackup) {
            const backupResult = await readMarkdownFile({ path: backups.frBackup });
            if (backupResult.success) {
                await writeFile({ path: `${projectPath}/fr.yaml`, content: backupResult.content! });
                await deleteFile({ path: backups.frBackup });
                logger.info(`🔄 Rolled back fr.yaml from backup`);
            }
        }
        
        if (backups.srsBackup) {
            const backupResult = await readMarkdownFile({ path: backups.srsBackup });
            if (backupResult.success) {
                await writeFile({ path: `${projectPath}/SRS.md`, content: backupResult.content! });
                await deleteFile({ path: backups.srsBackup });
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

// DEPRECATED: addNewRequirement and listRequirements tools have been removed

// ============================================================================
// 导出聚合 - 适配工具注册表格式
// ============================================================================

/**
 * 所有需求工具的定义数组
 */
export const requirementToolDefinitions: any[] = [
    // All requirement tools have been deprecated
];

/**
 * 所有需求工具的实现映射
 */
export const requirementToolImplementations = {
    // All requirement tools have been deprecated
};

/**
 * 需求工具分类信息
 */
export const requirementToolsCategory = {
    name: 'Document-Level Requirement Tools',
    description: 'Document-level tools for functional requirements management in SRS projects (deprecated)',
    tools: [],
    layer: 'document'
}; 