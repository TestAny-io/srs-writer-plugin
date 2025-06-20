/**
 * 文档生成工具 v2.0 - 从独立文件合并生成完整SRS报告
 * 
 * 这是原 srs-parser.ts 逻辑的重生：从"批处理解析器"转变为"报告生成工具"
 * - 原来：从母文档生成独立文件  
 * - 现在：从独立文件生成统一报告
 */

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { Logger } from '../../utils/logger';

/**
 * 工具定义
 */
export const documentGeneratorToolDefinitions = [
    {
        name: 'generateFullSrsReport',
        description: '读取项目中所有独立的SRS文件（如fr.yaml, nfr.yaml），并将它们合并生成一份完整的、适合打印或阅读的SRS_Report.md文档',
        parameters: {
            type: 'object',
            properties: {
                projectPath: {
                    type: 'string',
                    description: '项目根目录路径'
                },
                outputFileName: {
                    type: 'string',
                    description: '输出文件名',
                    default: 'SRS_Report.md'
                },
                includeMetadata: {
                    type: 'boolean',
                    description: '是否包含生成元数据',
                    default: true
                }
            },
            required: ['projectPath']
        }
    },
    {
        name: 'generateSectionFromYaml',
        description: '从YAML文件生成特定章节的Markdown内容（功能需求、非功能需求或术语表）',
        parameters: {
            type: 'object',
            properties: {
                yamlFilePath: {
                    type: 'string',
                    description: 'YAML文件的完整路径'
                },
                sectionType: {
                    type: 'string',
                    enum: ['functional_requirements', 'non_functional_requirements', 'glossary'],
                    description: '章节类型'
                }
            },
            required: ['yamlFilePath', 'sectionType']
        }
    }
];

/**
 * 工具实现
 */
export const documentGeneratorToolImplementations = {
    /**
     * 生成完整的SRS报告文档
     */
    async generateFullSrsReport(params: {
        projectPath: string;
        outputFileName?: string;
        includeMetadata?: boolean;
    }) {
        const logger = Logger.getInstance();
        const { projectPath, outputFileName = 'SRS_Report.md', includeMetadata = true } = params;

        try {
            logger.info(`🔧 开始生成SRS完整报告: ${outputFileName}`);

            // 1. 读取主要SRS文档
            const srsMainPath = vscode.Uri.file(`${projectPath}/SRS.md`);
            let srsMainContent = '';
            try {
                const srsMainBytes = await vscode.workspace.fs.readFile(srsMainPath);
                srsMainContent = Buffer.from(srsMainBytes).toString('utf8');
            } catch (error) {
                logger.warn('SRS.md not found, creating basic template');
                srsMainContent = await generateBasicSrsTemplate();
            }

            // 2. 读取并转换各个YAML文件
            const functionalRequirementsMarkdown = await generateSectionFromYaml({
                yamlFilePath: `${projectPath}/fr.yaml`,
                sectionType: 'functional_requirements'
            });

            const nonFunctionalRequirementsMarkdown = await generateSectionFromYaml({
                yamlFilePath: `${projectPath}/nfr.yaml`,
                sectionType: 'non_functional_requirements'
            });

            const glossaryMarkdown = await generateSectionFromYaml({
                yamlFilePath: `${projectPath}/glossary.yaml`,
                sectionType: 'glossary'
            });

            // 3. 读取其他支持文件
            const classificationContent = await readOptionalFile(`${projectPath}/classification_decision.md`);
            const questionsContent = await readOptionalFile(`${projectPath}/questions_and_suggestions.md`);

            // 4. 组装完整报告
            const reportSections = [
                srsMainContent,
                functionalRequirementsMarkdown,
                nonFunctionalRequirementsMarkdown,
                glossaryMarkdown,
                classificationContent ? `\n---\n\n## AI分类决策\n\n${classificationContent}` : '',
                questionsContent ? `\n---\n\n## 问题与建议\n\n${questionsContent}` : ''
            ].filter(section => section.trim());

            // 5. 添加元数据（如果启用）
            let finalReport = reportSections.join('\n\n');
            if (includeMetadata) {
                const metadata = generateReportMetadata();
                finalReport = `${metadata}\n\n${finalReport}`;
            }

            // 6. 写入报告文件
            const reportPath = vscode.Uri.file(`${projectPath}/${outputFileName}`);
            await vscode.workspace.fs.writeFile(reportPath, Buffer.from(finalReport, 'utf8'));

            logger.info(`✅ SRS完整报告生成成功: ${outputFileName}`);

            return {
                success: true,
                result: {
                    reportPath: `${projectPath}/${outputFileName}`,
                    sectionsIncluded: reportSections.length,
                    totalSize: finalReport.length,
                    message: `成功生成包含 ${reportSections.length} 个章节的SRS完整报告`
                }
            };

        } catch (error) {
            logger.error('生成SRS报告失败', error as Error);
            return {
                success: false,
                error: `生成SRS报告失败: ${(error as Error).message}`
            };
        }
    },

    /**
     * 从YAML文件生成章节Markdown内容
     */
    async generateSectionFromYaml(params: {
        yamlFilePath: string;
        sectionType: 'functional_requirements' | 'non_functional_requirements' | 'glossary';
    }) {
        return await generateSectionFromYaml(params);
    }
};

/**
 * 从YAML文件生成章节Markdown内容（内部实现）
 */
async function generateSectionFromYaml(params: {
    yamlFilePath: string;
    sectionType: 'functional_requirements' | 'non_functional_requirements' | 'glossary';
}): Promise<string> {
    const logger = Logger.getInstance();
    const { yamlFilePath, sectionType } = params;

    try {
        // 读取YAML文件
        const yamlUri = vscode.Uri.file(yamlFilePath);
        const yamlBytes = await vscode.workspace.fs.readFile(yamlUri);
        const yamlContent = Buffer.from(yamlBytes).toString('utf8');
        const yamlData = yaml.load(yamlContent) as any;

        switch (sectionType) {
            case 'functional_requirements':
                return generateFunctionalRequirementsMarkdown(yamlData);
            case 'non_functional_requirements':
                return generateNonFunctionalRequirementsMarkdown(yamlData);
            case 'glossary':
                return generateGlossaryMarkdown(yamlData);
            default:
                throw new Error(`不支持的章节类型: ${sectionType}`);
        }

    } catch (error) {
        logger.warn(`无法读取或解析 ${yamlFilePath}: ${(error as Error).message}`);
        return `\n## ${getSectionTitle(sectionType)}\n\n> 注意：${yamlFilePath} 文件不存在或解析失败\n`;
    }
}

/**
 * 生成功能需求Markdown表格
 */
function generateFunctionalRequirementsMarkdown(yamlData: any): string {
    const requirements = yamlData?.functional_requirements || [];
    if (requirements.length === 0) {
        return '\n## 3. 功能需求\n\n暂无功能需求。\n';
    }

    let markdown = '\n## 3. 功能需求\n\n';
    markdown += '| 需求ID | 需求名称 | 优先级 | 需求描述 | 验收标准 | 备注 |\n';
    markdown += '|--------|----------|--------|----------|----------|------|\n';

    requirements.forEach((req: any) => {
        const id = req.id || '';
        const name = req.name || '';
        const priority = req.priority || '';
        const description = req.description || '';
        const acceptanceCriteria = req.acceptance_criteria || '';
        const notes = req.notes || '';

        markdown += `| ${id} | ${name} | ${priority} | ${description} | ${acceptanceCriteria} | ${notes} |\n`;
    });

    // 添加元数据
    if (yamlData.metadata) {
        markdown += `\n> 总计：${requirements.length} 个功能需求\n`;
        if (yamlData.metadata.extraction_time) {
            markdown += `> 最后更新：${yamlData.metadata.extraction_time}\n`;
        }
    }

    return markdown;
}

/**
 * 生成非功能需求Markdown表格
 */
function generateNonFunctionalRequirementsMarkdown(yamlData: any): string {
    const requirements = yamlData?.non_functional_requirements || [];
    if (requirements.length === 0) {
        return '\n## 4. 非功能性需求\n\n暂无非功能性需求。\n';
    }

    let markdown = '\n## 4. 非功能性需求\n\n';
    markdown += '| 需求ID | 类别 | 优先级 | 需求描述 | 度量标准 | 备注 |\n';
    markdown += '|--------|------|--------|----------|----------|------|\n';

    requirements.forEach((req: any) => {
        const id = req.id || '';
        const category = req.category || '';
        const priority = req.priority || '';
        const description = req.description || '';
        const metrics = req.metrics || '';
        const notes = req.notes || '';

        markdown += `| ${id} | ${category} | ${priority} | ${description} | ${metrics} | ${notes} |\n`;
    });

    // 添加元数据
    if (yamlData.metadata) {
        markdown += `\n> 总计：${requirements.length} 个非功能性需求\n`;
        if (yamlData.metadata.extraction_time) {
            markdown += `> 最后更新：${yamlData.metadata.extraction_time}\n`;
        }
    }

    return markdown;
}

/**
 * 生成术语表Markdown表格
 */
function generateGlossaryMarkdown(yamlData: any): string {
    const terms = yamlData?.terms || [];
    if (terms.length === 0) {
        return '\n## 术语表\n\n暂无术语定义。\n';
    }

    let markdown = '\n## 术语表\n\n';
    markdown += '| 术语 | 定义 | 备注 |\n';
    markdown += '|------|------|------|\n';

    terms.forEach((term: any) => {
        const termName = term.term || '';
        const definition = term.definition || '';
        const notes = term.notes || '';

        markdown += `| ${termName} | ${definition} | ${notes} |\n`;
    });

    // 添加元数据
    if (yamlData.metadata) {
        markdown += `\n> 总计：${terms.length} 个术语\n`;
        if (yamlData.metadata.extraction_time) {
            markdown += `> 最后更新：${yamlData.metadata.extraction_time}\n`;
        }
    }

    return markdown;
}

/**
 * 读取可选文件
 */
async function readOptionalFile(filePath: string): Promise<string | null> {
    try {
        const fileUri = vscode.Uri.file(filePath);
        const fileBytes = await vscode.workspace.fs.readFile(fileUri);
        return Buffer.from(fileBytes).toString('utf8');
    } catch (error) {
        return null;
    }
}

/**
 * 生成基础SRS模板
 */
async function generateBasicSrsTemplate(): Promise<string> {
    return `# 软件需求规格说明书 (SRS)

## 1. 引言

### 1.1 目的
本文档描述了系统的软件需求规格说明。

### 1.2 范围
本系统旨在...

## 2. 总体描述

### 2.1 产品透视
系统概述...

### 2.2 产品功能
主要功能包括...

### 2.3 用户特点
目标用户群体...

### 2.4 限制
系统约束条件...

> 注意：这是自动生成的基础模板，请根据实际项目需求进行修改。
`;
}

/**
 * 生成报告元数据
 */
function generateReportMetadata(): string {
    const now = new Date();
    return `---
title: "SRS完整报告"
generated_at: "${now.toISOString()}"
generated_by: "SRS Writer Plugin v2.0"
format_version: "2.0"
---

<!-- 这是一份自动生成的SRS完整报告 -->
<!-- 包含了项目中所有独立文件的合并内容 -->
`;
}

/**
 * 获取章节标题
 */
function getSectionTitle(sectionType: string): string {
    switch (sectionType) {
        case 'functional_requirements':
            return '功能需求';
        case 'non_functional_requirements':
            return '非功能性需求';
        case 'glossary':
            return '术语表';
        default:
            return '未知章节';
    }
}

/**
 * 工具分类信息
 */
export const documentGeneratorToolsCategory = {
    name: 'documentGenerator',
    description: '文档生成工具：从独立的SRS文件合并生成完整报告',
    tools: documentGeneratorToolDefinitions.map(def => def.name),
    layer: 'document'
}; 