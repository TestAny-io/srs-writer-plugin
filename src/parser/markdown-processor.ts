import { marked } from 'marked';
import { Logger } from '../utils/logger';

/**
 * Markdown处理器
 * 负责解析和处理Markdown格式的文档内容
 */
export class MarkdownProcessor {
    private logger = Logger.getInstance();

    constructor() {
        // 配置marked选项
        marked.setOptions({
            gfm: true,              // GitHub Flavored Markdown
            breaks: false,          // 不自动换行
            pedantic: false         // 不严格模式
        });
    }

    /**
     * 解析Markdown内容为HTML
     */
    public parseToHtml(markdownContent: string): string {
        try {
            return marked(markdownContent);
        } catch (error) {
            this.logger.error('Failed to parse markdown to HTML', error as Error);
            return markdownContent;
        }
    }

    /**
     * 从Markdown中提取标题
     */
    public extractHeadings(markdownContent: string): Array<{ level: number; text: string; line: number }> {
        const headings: Array<{ level: number; text: string; line: number }> = [];
        const lines = markdownContent.split('\n');

        lines.forEach((line, index) => {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                headings.push({
                    level: match[1].length,
                    text: match[2].trim(),
                    line: index + 1
                });
            }
        });

        return headings;
    }

    /**
     * 从Markdown表格中提取数据
     */
    public extractTableData(markdownContent: string): Array<{ headers: string[]; rows: string[][] }> {
        const tables: Array<{ headers: string[]; rows: string[][] }> = [];
        const lines = markdownContent.split('\n');
        
        let inTable = false;
        let currentTable: { headers: string[]; rows: string[][] } | null = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 检测表格开始
            if (line.includes('|') && !inTable) {
                // 检查下一行是否是分隔符
                const nextLine = lines[i + 1]?.trim();
                if (nextLine && nextLine.match(/^\|[\s\-\:\|]+\|$/)) {
                    // 这是一个表格
                    inTable = true;
                    currentTable = {
                        headers: line.split('|').map(cell => cell.trim()).filter(cell => cell),
                        rows: []
                    };
                    i++; // 跳过分隔符行
                    continue;
                }
            }
            
            // 解析表格行
            if (inTable && line.includes('|')) {
                const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
                if (cells.length > 0 && currentTable) {
                    currentTable.rows.push(cells);
                }
            }
            
            // 检测表格结束
            if (inTable && (!line.includes('|') || line.trim() === '')) {
                if (currentTable && currentTable.rows.length > 0) {
                    tables.push(currentTable);
                }
                inTable = false;
                currentTable = null;
            }
        }
        
        // 处理文件末尾的表格
        if (inTable && currentTable && currentTable.rows.length > 0) {
            tables.push(currentTable);
        }
        
        return tables;
    }

    /**
     * 从Markdown中提取特定章节内容
     */
    public extractSection(markdownContent: string, sectionTitle: string): string {
        const lines = markdownContent.split('\n');
        const sectionLines: string[] = [];
        let inSection = false;
        let sectionLevel = 0;
        
        for (const line of lines) {
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            
            if (headingMatch) {
                const level = headingMatch[1].length;
                const title = headingMatch[2].trim();
                
                if (title.toLowerCase().includes(sectionTitle.toLowerCase())) {
                    inSection = true;
                    sectionLevel = level;
                    sectionLines.push(line);
                    continue;
                }
                
                // 如果在章节中，遇到同级或更高级的标题，则章节结束
                if (inSection && level <= sectionLevel) {
                    break;
                }
            }
            
            if (inSection) {
                sectionLines.push(line);
            }
        }
        
        return sectionLines.join('\n');
    }

    /**
     * 从Markdown中提取列表项
     */
    public extractLists(markdownContent: string): Array<{ type: 'ordered' | 'unordered'; items: string[] }> {
        const lists: Array<{ type: 'ordered' | 'unordered'; items: string[] }> = [];
        const lines = markdownContent.split('\n');
        
        let currentList: { type: 'ordered' | 'unordered'; items: string[] } | null = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // 检测有序列表
            const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
            if (orderedMatch) {
                if (!currentList || currentList.type !== 'ordered') {
                    // 开始新的有序列表
                    if (currentList) {
                        lists.push(currentList);
                    }
                    currentList = { type: 'ordered', items: [] };
                }
                currentList.items.push(orderedMatch[1]);
                continue;
            }
            
            // 检测无序列表
            const unorderedMatch = trimmed.match(/^[\-\*\+]\s+(.+)$/);
            if (unorderedMatch) {
                if (!currentList || currentList.type !== 'unordered') {
                    // 开始新的无序列表
                    if (currentList) {
                        lists.push(currentList);
                    }
                    currentList = { type: 'unordered', items: [] };
                }
                currentList.items.push(unorderedMatch[1]);
                continue;
            }
            
            // 如果不是列表项且当前有列表，则结束当前列表
            if (currentList && trimmed !== '') {
                lists.push(currentList);
                currentList = null;
            }
        }
        
        // 处理文件末尾的列表
        if (currentList) {
            lists.push(currentList);
        }
        
        return lists;
    }

    /**
     * 清理Markdown内容，移除不必要的格式
     */
    public cleanMarkdown(markdownContent: string): string {
        return markdownContent
            // 移除多余的空行
            .replace(/\n{3,}/g, '\n\n')
            // 移除行尾空格
            .replace(/[ \t]+$/gm, '')
            // 规范化标题格式
            .replace(/^(#+)([^\s])/gm, '$1 $2')
            // 移除开头和结尾的空白
            .trim();
    }

    /**
     * 从Markdown中提取代码块
     */
    public extractCodeBlocks(markdownContent: string): Array<{ language?: string; code: string }> {
        const codeBlocks: Array<{ language?: string; code: string }> = [];
        const lines = markdownContent.split('\n');
        
        let inCodeBlock = false;
        let currentBlock: { language?: string; code: string[] } | null = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // 检测代码块开始
            const codeBlockStart = trimmed.match(/^```([\w\-]*)?$/);
            if (codeBlockStart && !inCodeBlock) {
                inCodeBlock = true;
                currentBlock = {
                    language: codeBlockStart[1] || undefined,
                    code: []
                };
                continue;
            }
            
            // 检测代码块结束
            if (trimmed === '```' && inCodeBlock) {
                if (currentBlock) {
                    codeBlocks.push({
                        language: currentBlock.language,
                        code: currentBlock.code.join('\n')
                    });
                }
                inCodeBlock = false;
                currentBlock = null;
                continue;
            }
            
            // 收集代码块内容
            if (inCodeBlock && currentBlock) {
                currentBlock.code.push(line);
            }
        }
        
        return codeBlocks;
    }

    /**
     * 验证Markdown格式
     */
    public validateMarkdown(markdownContent: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        try {
            // 尝试解析Markdown
            marked(markdownContent);
            
            // 检查基本结构
            if (!markdownContent.trim()) {
                errors.push('Markdown content is empty');
            }
            
            // 检查标题结构
            const headings = this.extractHeadings(markdownContent);
            if (headings.length === 0) {
                errors.push('No headings found in markdown');
            }
            
            // 检查是否有未闭合的代码块
            const codeBlockCount = (markdownContent.match(/```/g) || []).length;
            if (codeBlockCount % 2 !== 0) {
                errors.push('Unclosed code block found');
            }
            
        } catch (error) {
            errors.push(`Markdown parsing error: ${(error as Error).message}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 获取Markdown文档统计信息
     */
    public getStats(markdownContent: string): object {
        const lines = markdownContent.split('\n');
        const words = markdownContent.split(/\s+/).filter(word => word.length > 0);
        const headings = this.extractHeadings(markdownContent);
        const tables = this.extractTableData(markdownContent);
        const lists = this.extractLists(markdownContent);
        const codeBlocks = this.extractCodeBlocks(markdownContent);
        
        return {
            lineCount: lines.length,
            wordCount: words.length,
            characterCount: markdownContent.length,
            headingCount: headings.length,
            tableCount: tables.length,
            listCount: lists.length,
            codeBlockCount: codeBlocks.length
        };
    }
}
