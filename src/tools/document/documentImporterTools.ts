/**
 * 文档导入工具 v2.0 - 从Markdown导入并解析到独立文件
 * 
 * 这里保存了原 srs-parser.ts 的宝贵解析逻辑：
 * - 表格解析：从Markdown表格提取结构化数据
 * - YAML转换：将表格数据转换为YAML格式
 * - 格式识别：支持多种Markdown格式的自动识别
 */

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { Logger } from '../../utils/logger';

/**
 * 工具定义
 */
export const documentImporterToolDefinitions = [
    {
        name: 'importFromMarkdown',
        description: '从一份Markdown格式的SRS文档中解析并提取内容，自动填充到项目的独立文件中（fr.yaml, nfr.yaml等）',
        parameters: {
            type: 'object',
            properties: {
                markdownContent: {
                    type: 'string',
                    description: '要解析的Markdown内容'
                },
                projectPath: {
                    type: 'string',
                    description: '目标项目路径'
                },
                overwriteExisting: {
                    type: 'boolean',
                    description: '是否覆盖已存在的文件',
                    default: false
                }
            },
            required: ['markdownContent', 'projectPath']
        }
    },
    {
        name: 'parseMarkdownTable',
        description: '解析Markdown表格并转换为指定格式（YAML或JSON）',
        parameters: {
            type: 'object',
            properties: {
                tableContent: {
                    type: 'string',
                    description: 'Markdown表格内容'
                },
                tableType: {
                    type: 'string',
                    enum: ['functional_requirements', 'non_functional_requirements', 'glossary'],
                    description: '表格类型'
                },
                outputFormat: {
                    type: 'string',
                    enum: ['yaml', 'json'],
                    description: '输出格式',
                    default: 'yaml'
                }
            },
            required: ['tableContent', 'tableType']
        }
    }
];

/**
 * 工具实现
 */
export const documentImporterToolImplementations = {
    /**
     * 从Markdown导入SRS内容
     */
    async importFromMarkdown(params: {
        markdownContent: string;
        projectPath: string;
        overwriteExisting?: boolean;
    }) {
        const logger = Logger.getInstance();
        const { markdownContent, projectPath, overwriteExisting = false } = params;

        try {
            logger.info('🔧 开始从Markdown导入SRS内容');

            const importResults: Array<{ file: string; success: boolean; message: string }> = [];

            // 1. 解析并提取功能需求
            const frTable = extractFRTableFromMarkdown(markdownContent);
            if (frTable) {
                try {
                    const frYaml = convertFRTableToYaml(frTable);
                    await writeToFile(`${projectPath}/fr.yaml`, frYaml, overwriteExisting);
                    importResults.push({
                        file: 'fr.yaml',
                        success: true,
                        message: '功能需求导入成功'
                    });
                } catch (error) {
                    importResults.push({
                        file: 'fr.yaml',
                        success: false,
                        message: `功能需求导入失败: ${(error as Error).message}`
                    });
                }
            } else {
                importResults.push({
                    file: 'fr.yaml',
                    success: false,
                    message: '未找到功能需求表格'
                });
            }

            // 2. 解析并提取非功能需求
            const nfrTable = extractNFRTableFromMarkdown(markdownContent);
            if (nfrTable) {
                try {
                    const nfrYaml = convertNFRTableToYaml(nfrTable);
                    await writeToFile(`${projectPath}/nfr.yaml`, nfrYaml, overwriteExisting);
                    importResults.push({
                        file: 'nfr.yaml',
                        success: true,
                        message: '非功能需求导入成功'
                    });
                } catch (error) {
                    importResults.push({
                        file: 'nfr.yaml',
                        success: false,
                        message: `非功能需求导入失败: ${(error as Error).message}`
                    });
                }
            } else {
                importResults.push({
                    file: 'nfr.yaml',
                    success: false,
                    message: '未找到非功能需求表格'
                });
            }

            // 3. 解析并提取术语表
            const glossaryTable = extractGlossaryTableFromMarkdown(markdownContent);
            if (glossaryTable) {
                try {
                    const glossaryYaml = convertGlossaryTableToYaml(glossaryTable);
                    await writeToFile(`${projectPath}/glossary.yaml`, glossaryYaml, overwriteExisting);
                    importResults.push({
                        file: 'glossary.yaml',
                        success: true,
                        message: '术语表导入成功'
                    });
                } catch (error) {
                    importResults.push({
                        file: 'glossary.yaml',
                        success: false,
                        message: `术语表导入失败: ${(error as Error).message}`
                    });
                }
            } else {
                importResults.push({
                    file: 'glossary.yaml',
                    success: false,
                    message: '未找到术语表'
                });
            }

            // 4. 提取并保存主要SRS内容
            try {
                const cleanedContent = cleanMarkdownForSRS(markdownContent);
                await writeToFile(`${projectPath}/SRS.md`, cleanedContent, overwriteExisting);
                importResults.push({
                    file: 'SRS.md',
                    success: true,
                    message: 'SRS主文档导入成功'
                });
            } catch (error) {
                importResults.push({
                    file: 'SRS.md',
                    success: false,
                    message: `SRS主文档导入失败: ${(error as Error).message}`
                });
            }

            const successCount = importResults.filter(r => r.success).length;
            const totalCount = importResults.length;

            logger.info(`✅ Markdown导入完成: ${successCount}/${totalCount} 文件成功`);

            return {
                success: successCount > 0,
                result: {
                    importResults,
                    summary: `成功导入 ${successCount}/${totalCount} 个文件`,
                    successCount,
                    totalCount
                }
            };

        } catch (error) {
            logger.error('Markdown导入失败', error as Error);
            return {
                success: false,
                error: `Markdown导入失败: ${(error as Error).message}`
            };
        }
    },

    /**
     * 解析Markdown表格
     */
    async parseMarkdownTable(params: {
        tableContent: string;
        tableType: 'functional_requirements' | 'non_functional_requirements' | 'glossary';
        outputFormat?: 'yaml' | 'json';
    }) {
        const { tableContent, tableType, outputFormat = 'yaml' } = params;

        try {
            let result: string;

            switch (tableType) {
                case 'functional_requirements':
                    result = convertFRTableToYaml(tableContent);
                    break;
                case 'non_functional_requirements':
                    result = convertNFRTableToYaml(tableContent);
                    break;
                case 'glossary':
                    result = convertGlossaryTableToYaml(tableContent);
                    break;
                default:
                    throw new Error(`不支持的表格类型: ${tableType}`);
            }

            // 如果需要JSON格式，转换YAML到JSON
            if (outputFormat === 'json') {
                const yamlData = yaml.load(result);
                result = JSON.stringify(yamlData, null, 2);
            }

            return {
                success: true,
                result: {
                    parsedContent: result,
                    format: outputFormat,
                    tableType
                }
            };

        } catch (error) {
            return {
                success: false,
                error: `表格解析失败: ${(error as Error).message}`
            };
        }
    }
};

/**
 * 从Markdown中提取功能需求表格（复用srs-parser逻辑）
 */
function extractFRTableFromMarkdown(markdownContent: string): string | null {
    const patterns = [
        /## 3\.\s*功能需求.*?\n((?:\|.*?\|\n)+)/s,
        /##\s*功能需求.*?\n((?:\|.*?\|\n)+)/s
    ];

    for (const pattern of patterns) {
        const match = markdownContent.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return null;
}

/**
 * 从Markdown中提取非功能需求表格（复用srs-parser逻辑）
 */
function extractNFRTableFromMarkdown(markdownContent: string): string | null {
    try {
        // 查找非功能需求章节（支持中英文）
        const patterns = [
            /## 4\.\s*非功能性需求.*?\n((?:\|.*?\|\n)+)/s,
            /## 4\.\s*Non-Functional Requirements.*?\n((?:\|.*?\|\n)+)/s,
            /##\s*非功能性需求.*?\n((?:\|.*?\|\n)+)/s,
            /##\s*Non-Functional Requirements.*?\n((?:\|.*?\|\n)+)/s
        ];

        for (const pattern of patterns) {
            const match = markdownContent.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    } catch (error) {
        Logger.getInstance().error('提取非功能需求表格失败', error as Error);
        return null;
    }
}

/**
 * 从Markdown中提取术语表（复用srs-parser逻辑）
 */
function extractGlossaryTableFromMarkdown(markdownContent: string): string | null {
    try {
        // 查找术语表章节（支持中英文）
        const patterns = [
            /##\s*.*?术语表.*?\n((?:\|.*?\|\n)+)/s,
            /##\s*.*?Glossary.*?\n((?:\|.*?\|\n)+)/s,
            /##\s*.*?词汇表.*?\n((?:\|.*?\|\n)+)/s
        ];

        for (const pattern of patterns) {
            const match = markdownContent.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    } catch (error) {
        Logger.getInstance().error('提取术语表失败', error as Error);
        return null;
    }
}

/**
 * 将功能需求表格转换为YAML（复用srs-parser逻辑）
 */
function convertFRTableToYaml(tableContent: string): string {
    const requirements: any[] = [];
    const lines = tableContent.split('\n').filter(line => line.trim() && !line.includes('---'));

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
        
        if (cells.length >= 4) {
            requirements.push({
                id: cells[0] || '',
                name: cells[1] || '',
                priority: cells[2] || '',
                description: cells[3] || ''
            });
        }
    }

    const yamlData = {
        functional_requirements: requirements,
        metadata: {
            imported_from: 'Markdown document',
            import_time: new Date().toISOString(),
            total_count: requirements.length
        }
    };

    return yaml.dump(yamlData, { sortKeys: false, lineWidth: 120, noRefs: true });
}

/**
 * 将非功能需求表格转换为YAML（复用srs-parser逻辑）
 */
function convertNFRTableToYaml(tableContent: string): string {
    try {
        const requirements: any[] = [];
        const lines = tableContent.split('\n').filter(line => line.trim() && !line.includes('---'));

        for (let i = 1; i < lines.length; i++) { // 跳过表头
            const line = lines[i];
            const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
            
            if (cells.length >= 4) {
                requirements.push({
                    id: cells[0] || '',
                    category: cells[1] || '',
                    priority: cells[2] || '',
                    description: cells[3] || '',
                    metrics: cells[4] || '',
                    notes: cells[5] || ''
                });
            }
        }

        const yamlData = {
            non_functional_requirements: requirements,
            metadata: {
                imported_from: 'Markdown document',
                import_time: new Date().toISOString(),
                total_count: requirements.length
            }
        };

        return yaml.dump(yamlData, { 
            sortKeys: false, 
            lineWidth: 120,
            noRefs: true 
        });
    } catch (error) {
        throw new Error(`转换非功能需求表格为YAML失败: ${(error as Error).message}`);
    }
}

/**
 * 将术语表转换为YAML（复用srs-parser逻辑）
 */
function convertGlossaryTableToYaml(tableContent: string): string {
    try {
        const terms: any[] = [];
        const lines = tableContent.split('\n').filter(line => line.trim() && !line.includes('---'));

        for (let i = 1; i < lines.length; i++) { // 跳过表头
            const line = lines[i];
            const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
            
            if (cells.length >= 2) {
                terms.push({
                    term: cells[0] || '',
                    definition: cells[1] || '',
                    notes: cells[2] || ''
                });
            }
        }

        const yamlData = {
            terms: terms,
            metadata: {
                imported_from: 'Markdown document',
                import_time: new Date().toISOString(),
                total_count: terms.length
            }
        };

        return yaml.dump(yamlData, { 
            sortKeys: false, 
            lineWidth: 120,
            noRefs: true 
        });
    } catch (error) {
        throw new Error(`转换术语表为YAML失败: ${(error as Error).message}`);
    }
}

/**
 * 清理Markdown内容用于SRS主文档
 */
function cleanMarkdownForSRS(markdownContent: string): string {
    // 移除可能的文档生成元数据
    let cleaned = markdownContent;
    
    // 移除前置的YAML front matter
    cleaned = cleaned.replace(/^---[\s\S]*?---\n\n?/, '');
    
    // 移除可能的生成注释
    cleaned = cleaned.replace(/<!-- .*? -->/g, '');
    
    // 添加导入标记
    const importNote = `> 📥 本文档从Markdown导入于 ${new Date().toISOString()}\n\n`;
    
    return importNote + cleaned.trim();
}

/**
 * 写入文件（支持覆盖检查）
 */
async function writeToFile(filePath: string, content: string, overwriteExisting: boolean): Promise<void> {
    const fileUri = vscode.Uri.file(filePath);
    
    // 检查文件是否已存在
    if (!overwriteExisting) {
        try {
            await vscode.workspace.fs.stat(fileUri);
            throw new Error(`文件已存在且未启用覆盖: ${filePath}`);
        } catch (error) {
            // 文件不存在，可以继续写入
            if ((error as vscode.FileSystemError).code !== 'FileNotFound') {
                throw error;
            }
        }
    }
    
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
}

/**
 * 工具分类信息
 */
export const documentImporterToolsCategory = {
    name: 'documentImporter',
    description: '文档导入工具：从Markdown文档解析并导入到独立的SRS文件',
    tools: documentImporterToolDefinitions.map(def => def.name),
    layer: 'document'
}; 