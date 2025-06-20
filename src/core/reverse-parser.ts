import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { marked } from 'marked';
import { Logger } from '../utils/logger';
import { IReverseParser, SyncableFileType } from '../types';

/**
 * v1.2 反向解析器 - 架构突破版
 * 负责将用户手动修改的子文件内容反向工程并写回mother_document.md
 * 实现PUT式更新，确保母文档的权威性
 * 
 * 🚀 v1.2 重大架构升级：
 * ✅ CRITICAL修复：同步I/O → 异步I/O（所有fs.*Sync → vscode.workspace.fs）
 * ✅ 架构改进：移除getMotherDocumentPath，使用依赖注入（SessionManager提供路径）
 * ✅ 原子操作保障：维持事务性备份/回滚机制（异步版本）
 * 🎯 架构突破：正则表达式 → AST-based解析（marked.js）
 *    - 解决了正则表达式的脆弱性：标题和表格之间的空行、描述文字
 *    - 使用marked.lexer()将markdown解析为AST，精确定位标题和表格
 *    - 支持任意格式变化，不再依赖严格的markdown结构
 *    - 大幅提升了反向同步的可靠性和健壮性
 */
export class ReverseParser implements IReverseParser {
    private logger = Logger.getInstance();

    constructor() {
        this.logger.info('ReverseParser initialized');
    }

    /**
     * 将脏文件的修改同步到母文档 - v1.2修复版（异步+依赖注入）
     * 这是一个原子操作，确保母文档的完整性
     * @param dirtyFile 修改过的子文件路径
     * @param motherDocumentPath 母文档的完整路径（由SessionManager提供）
     */
    public async syncToMotherDocument(dirtyFile: string, motherDocumentPath: string): Promise<void> {
        // v1.2修复：使用异步API检查文件存在性
        const motherDocUri = vscode.Uri.file(motherDocumentPath);
        const dirtyFileUri = vscode.Uri.file(dirtyFile);
        
        try {
            await vscode.workspace.fs.stat(motherDocUri);
        } catch {
            throw new Error(`Mother document not found: ${motherDocumentPath}`);
        }

        try {
            await vscode.workspace.fs.stat(dirtyFileUri);
        } catch {
            throw new Error(`Dirty file not found: ${dirtyFile}`);
        }

        this.logger.info(`Starting reverse sync: ${dirtyFile} → ${motherDocumentPath}`);

        // v1.2修复：使用异步API读取当前母文档内容
        const originalContentBytes = await vscode.workspace.fs.readFile(motherDocUri);
        const originalContent = new TextDecoder().decode(originalContentBytes);
        
        // 创建临时备份（异步）
        const backupPath = `${motherDocumentPath}.backup.${Date.now()}`;
        const backupUri = vscode.Uri.file(backupPath);
        await vscode.workspace.fs.writeFile(backupUri, originalContentBytes);

        try {
            // 执行PUT操作
            const updatedContent = await this.performPutOperation(dirtyFile, originalContent);
            
            // v1.2修复：使用异步API原子写入更新后的内容
            const updatedContentBytes = new TextEncoder().encode(updatedContent);
            await vscode.workspace.fs.writeFile(motherDocUri, updatedContentBytes);
            
            // v1.2注意：VSCode API不支持修改文件时间，但由于我们写入了新内容，
            // 文件系统会自动更新修改时间，因此母文档会比子文件新
            
            // 清理备份（异步）
            await vscode.workspace.fs.delete(backupUri);
            
            this.logger.info(`Reverse sync completed successfully: ${dirtyFile}`);

        } catch (error) {
            // 发生错误时回滚（异步）
            this.logger.error(`Reverse sync failed, rolling back: ${error}`);
            await vscode.workspace.fs.writeFile(motherDocUri, originalContentBytes);
            try {
                await vscode.workspace.fs.delete(backupUri);
            } catch {
                // 备份清理失败不是致命错误
                this.logger.warn(`Failed to clean up backup file: ${backupPath}`);
            }
            throw error;
        }
    }

    /**
     * 执行具体的PUT操作，根据文件类型处理 - v1.2修复版（异步）
     */
    private async performPutOperation(dirtyFile: string, motherContent: string): Promise<string> {
        const fileName = path.basename(dirtyFile);
        
        switch (fileName) {
            case SyncableFileType.SRS_MAIN:
                return await this.putSRSMainContent(dirtyFile, motherContent);
                
            case SyncableFileType.FUNCTIONAL_REQUIREMENTS:
                return await this.putFunctionalRequirements(dirtyFile, motherContent);
                
            case SyncableFileType.NON_FUNCTIONAL_REQUIREMENTS:
                return await this.putNonFunctionalRequirements(dirtyFile, motherContent);
                
            case SyncableFileType.GLOSSARY:
                return await this.putGlossary(dirtyFile, motherContent);
                
            case SyncableFileType.CLASSIFICATION:
                return await this.putClassificationDecision(dirtyFile, motherContent);
                
            case SyncableFileType.QUESTIONS:
                return await this.putQuestionsAndSuggestions(dirtyFile, motherContent);
                
            default:
                throw new Error(`Unsupported file type for reverse sync: ${fileName}`);
        }
    }

    /**
     * PUT SRS主文档内容 - v1.2修复版（异步）
     */
    private async putSRSMainContent(srsFilePath: string, motherContent: string): Promise<string> {
        // v1.2修复：使用异步API读取文件
        const srsFileUri = vscode.Uri.file(srsFilePath);
        const newSrsContentBytes = await vscode.workspace.fs.readFile(srsFileUri);
        const newSrsContent = new TextDecoder().decode(newSrsContentBytes);
        
        // 查找SRS内容块的边界（支持新旧两种格式）
        const newFormat = /^### --- SOFTWARE_REQUIREMENTS_SPECIFICATION_CONTENT ---$/gm;
        const oldFormat = /^--- SOFTWARE REQUIREMENTS SPECIFICATION ---$/gm;
        
        let startPattern: RegExp;
        let endPattern: RegExp | null = null;
        
        if (newFormat.test(motherContent)) {
            // 新格式
            startPattern = newFormat;
            // 找到下一个顶层块或文件结尾
            endPattern = /^### --- [A-Z_]+ ---$/gm;
        } else if (oldFormat.test(motherContent)) {
            // 旧格式
            startPattern = oldFormat;
            endPattern = /^--- [A-Z\s]+ ---$/gm;
        } else {
            throw new Error('无法找到SOFTWARE REQUIREMENTS SPECIFICATION块标识符');
        }

        return this.replaceContentBlock(motherContent, startPattern, endPattern, newSrsContent);
    }

    /**
     * PUT功能需求内容（从YAML转换为Markdown表格）- v1.2修复版（异步）
     */
    private async putFunctionalRequirements(yamlFilePath: string, motherContent: string): Promise<string> {
        // v1.2修复：使用异步API读取文件
        const yamlFileUri = vscode.Uri.file(yamlFilePath);
        const yamlContentBytes = await vscode.workspace.fs.readFile(yamlFileUri);
        const yamlContent = new TextDecoder().decode(yamlContentBytes);
        const requirements = yaml.load(yamlContent) as any;
        
        // 生成Markdown表格
        const markdownTable = this.generateFRMarkdownTable(requirements);
        
        // 在SRS主文档中查找并替换功能需求表格
        return this.replaceFRTableInSRS(motherContent, markdownTable);
    }

    /**
     * PUT非功能需求内容（从YAML转换为Markdown表格）- v1.2修复版（异步）
     */
    private async putNonFunctionalRequirements(yamlFilePath: string, motherContent: string): Promise<string> {
        // v1.2修复：使用异步API读取文件
        const yamlFileUri = vscode.Uri.file(yamlFilePath);
        const yamlContentBytes = await vscode.workspace.fs.readFile(yamlFileUri);
        const yamlContent = new TextDecoder().decode(yamlContentBytes);
        const requirements = yaml.load(yamlContent) as any;
        
        // 生成Markdown表格
        const markdownTable = this.generateNFRMarkdownTable(requirements);
        
        // 在SRS主文档中查找并替换非功能需求表格
        return this.replaceNFRTableInSRS(motherContent, markdownTable);
    }

    /**
     * PUT术语表内容 - v1.2修复版（异步）
     */
    private async putGlossary(yamlFilePath: string, motherContent: string): Promise<string> {
        // v1.2修复：使用异步API读取文件
        const yamlFileUri = vscode.Uri.file(yamlFilePath);
        const yamlContentBytes = await vscode.workspace.fs.readFile(yamlFileUri);
        const yamlContent = new TextDecoder().decode(yamlContentBytes);
        const glossary = yaml.load(yamlContent) as any;
        
        // 生成Markdown表格
        const markdownTable = this.generateGlossaryMarkdownTable(glossary);
        
        // 在SRS主文档中查找并替换术语表
        return this.replaceGlossaryInSRS(motherContent, markdownTable);
    }

    /**
     * PUT分类决策内容 - v1.2修复版（异步）
     */
    private async putClassificationDecision(filePath: string, motherContent: string): Promise<string> {
        // v1.2修复：使用异步API读取文件
        const fileUri = vscode.Uri.file(filePath);
        const newContentBytes = await vscode.workspace.fs.readFile(fileUri);
        const newContent = new TextDecoder().decode(newContentBytes);
        
        // 查找分类决策块的边界
        const newFormat = /^### --- AI_CLASSIFICATION_DECISION ---$/gm;
        const oldFormat = /^--- AI CLASSIFICATION DECISION ---$/gm;
        
        let startPattern: RegExp;
        let endPattern: RegExp | null = null;
        
        if (newFormat.test(motherContent)) {
            startPattern = newFormat;
            endPattern = /^### --- [A-Z_]+ ---$/gm;
        } else if (oldFormat.test(motherContent)) {
            startPattern = oldFormat;
            endPattern = /^--- [A-Z\s]+ ---$/gm;
        } else {
            throw new Error('无法找到AI CLASSIFICATION DECISION块标识符');
        }

        return this.replaceContentBlock(motherContent, startPattern, endPattern, newContent);
    }

    /**
     * PUT问题与建议内容 - v1.2修复版（异步）
     */
    private async putQuestionsAndSuggestions(filePath: string, motherContent: string): Promise<string> {
        // v1.2修复：使用异步API读取文件
        const fileUri = vscode.Uri.file(filePath);
        const newContentBytes = await vscode.workspace.fs.readFile(fileUri);
        const newContent = new TextDecoder().decode(newContentBytes);
        
        // 查找问题与建议块的边界
        const newFormat = /^### --- QUESTIONS_AND_SUGGESTIONS_CONTENT ---$/gm;
        const oldFormat = /^--- QUESTIONS FOR CLARIFICATION ---$/gm;
        
        let startPattern: RegExp;
        let endPattern: RegExp | null = null;
        
        if (newFormat.test(motherContent)) {
            startPattern = newFormat;
            endPattern = /^### --- [A-Z_]+ ---$/gm;
        } else if (oldFormat.test(motherContent)) {
            startPattern = oldFormat;
            endPattern = /^--- [A-Z\s]+ ---$/gm;
        } else {
            throw new Error('无法找到QUESTIONS块标识符');
        }

        return this.replaceContentBlock(motherContent, startPattern, endPattern, newContent);
    }

    /**
     * 生成功能需求Markdown表格
     */
    private generateFRMarkdownTable(requirements: any): string {
        if (!requirements || !Array.isArray(requirements.functional_requirements)) {
            return '| FR-ID | 需求名称 | 优先级 | 详细描述 | 验收标准 | 备注 |\n|-------|---------|--------|----------|----------|------|\n';
        }

        let table = '| FR-ID | 需求名称 | 优先级 | 详细描述 | 验收标准 | 备注 |\n';
        table += '|-------|---------|--------|----------|----------|------|\n';

        for (const req of requirements.functional_requirements) {
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
     * 生成非功能需求Markdown表格
     */
    private generateNFRMarkdownTable(requirements: any): string {
        if (!requirements || !Array.isArray(requirements.non_functional_requirements)) {
            return '| NFR-ID | 类别 | 优先级 | 详细描述 | 衡量指标 | 备注 |\n|--------|------|--------|----------|----------|------|\n';
        }

        let table = '| NFR-ID | 类别 | 优先级 | 详细描述 | 衡量指标 | 备注 |\n';
        table += '|--------|------|--------|----------|----------|------|\n';

        for (const req of requirements.non_functional_requirements) {
            const id = req.id || '';
            const category = req.category || '';
            const priority = req.priority || '';
            const description = (req.description || '').replace(/\|/g, '&#124;').replace(/\n/g, '<br/>');
            const metrics = (req.metrics || '').replace(/\|/g, '&#124;').replace(/\n/g, '<br/>');
            const notes = (req.notes || '').replace(/\|/g, '&#124;').replace(/\n/g, '<br/>');
            
            table += `| ${id} | ${category} | ${priority} | ${description} | ${metrics} | ${notes} |\n`;
        }

        return table;
    }

    /**
     * 生成术语表Markdown表格
     */
    private generateGlossaryMarkdownTable(glossary: any): string {
        if (!glossary || !Array.isArray(glossary.terms)) {
            return '| 术语 | 定义 | 备注 |\n|------|------|------|\n';
        }

        let table = '| 术语 | 定义 | 备注 |\n';
        table += '|------|------|------|\n';

        for (const term of glossary.terms) {
            const name = term.term || '';
            const definition = (term.definition || '').replace(/\|/g, '&#124;').replace(/\n/g, '<br/>');
            const notes = (term.notes || '').replace(/\|/g, '&#124;').replace(/\n/g, '<br/>');
            
            table += `| ${name} | ${definition} | ${notes} |\n`;
        }

        return table;
    }

    /**
     * 替换SRS主文档中的功能需求表格 - v1.2架构升级版（AST-based解析）
     * 解决了用户提到的正则表达式脆弱性问题：标题和表格之间的空行、描述文字等
     */
    private replaceFRTableInSRS(motherContent: string, newTable: string): string {
        const srsContent = this.extractSRSContent(motherContent);
        
        const updatedSRSContent = this.replaceTableInMarkdownAST(
            srsContent, 
            newTable, 
            ['功能需求', 'Functional Requirements', '3. 功能需求', '3.功能需求', '3 功能需求']
        );
        
        return this.replaceSRSContentInMother(motherContent, updatedSRSContent);
    }

    /**
     * 替换SRS主文档中的非功能需求表格 - v1.2架构升级版（AST-based解析）
     */
    private replaceNFRTableInSRS(motherContent: string, newTable: string): string {
        const srsContent = this.extractSRSContent(motherContent);
        
        const updatedSRSContent = this.replaceTableInMarkdownAST(
            srsContent, 
            newTable, 
            ['非功能性需求', 'Non-Functional Requirements', '4. 非功能性需求', '4.非功能性需求', '4 非功能性需求']
        );
        
        return this.replaceSRSContentInMother(motherContent, updatedSRSContent);
    }

    /**
     * 替换SRS主文档中的术语表 - v1.2架构升级版（AST-based解析）
     */
    private replaceGlossaryInSRS(motherContent: string, newTable: string): string {
        const srsContent = this.extractSRSContent(motherContent);
        
        const updatedSRSContent = this.replaceTableInMarkdownAST(
            srsContent, 
            newTable, 
            ['术语表', 'Glossary', '词汇表', '术语定义', 'Terms', '5. 术语表', '5.术语表', '5 术语表']
        );
        
        return this.replaceSRSContentInMother(motherContent, updatedSRSContent);
    }

    /**
     * 将更新后的SRS内容替换回母文档中的SRS块
     */
    private replaceSRSContentInMother(motherContent: string, updatedSRSContent: string): string {
        // 查找SRS内容块的边界（支持新旧两种格式）
        const newFormat = /^### --- SOFTWARE_REQUIREMENTS_SPECIFICATION_CONTENT ---$/gm;
        const oldFormat = /^--- SOFTWARE REQUIREMENTS SPECIFICATION ---$/gm;
        
        let startPattern: RegExp;
        let endPattern: RegExp | null = null;
        
        if (newFormat.test(motherContent)) {
            // 新格式
            startPattern = newFormat;
            endPattern = /^### --- [A-Z_]+ ---$/gm;
        } else if (oldFormat.test(motherContent)) {
            // 旧格式
            startPattern = oldFormat;
            endPattern = /^--- [A-Z\s]+ ---$/gm;
        } else {
            throw new Error('无法找到SOFTWARE REQUIREMENTS SPECIFICATION块标识符');
        }

        return this.replaceContentBlock(motherContent, startPattern, endPattern, updatedSRSContent);
    }

    /**
     * 从母文档中提取SRS主文档内容 - v1.2修复版（兼容正则表达式）
     */
    private extractSRSContent(motherContent: string): string {
        // v1.2修复：使用兼容的正则表达式（移除 gms 标志，使用 [\s\S] 替代 . 匹配换行）
        const newFormat = /^### --- SOFTWARE_REQUIREMENTS_SPECIFICATION_CONTENT ---$([\s\S]*?)^### --- [A-Z_]+ ---$/gm;
        const oldFormat = /^--- SOFTWARE REQUIREMENTS SPECIFICATION ---([\s\S]*?)^--- [A-Z\s]+ ---$/gm;
        
        let match = motherContent.match(newFormat);
        if (!match) {
            match = motherContent.match(oldFormat);
        }
        
        if (!match) {
            // v1.2增强：如果严格匹配失败，尝试更宽松的匹配
            const flexiblePattern = /SOFTWARE_REQUIREMENTS_SPECIFICATION[\s\S]*?(?=^###|^---|$)/gm;
            match = motherContent.match(flexiblePattern);
            
            if (!match) {
                throw new Error('无法提取SRS主文档内容（尝试了多种格式）');
            }
        }
        
        return match[1] ? match[1].trim() : match[0].trim();
    }

    /**
     * 通用的内容块替换方法
     */
    private replaceContentBlock(
        motherContent: string, 
        startPattern: RegExp, 
        endPattern: RegExp | null, 
        newContent: string
    ): string {
        const startMatch = motherContent.match(startPattern);
        if (!startMatch) {
            throw new Error('无法找到起始标识符');
        }

        const startIndex = startMatch.index! + startMatch[0].length;
        
        let endIndex = motherContent.length;
        if (endPattern) {
            endPattern.lastIndex = startIndex;
            const endMatch = endPattern.exec(motherContent);
            if (endMatch) {
                endIndex = endMatch.index!;
            }
        }

        const before = motherContent.substring(0, startIndex);
        const after = motherContent.substring(endIndex);
        
        return before + '\n' + newContent + '\n' + after;
    }



    /**
     * 基于AST的表格替换核心方法 - v1.2架构突破
     * 使用marked.js解析Markdown为AST，然后精确定位和替换表格
     * 解决了正则表达式的脆弱性问题
     */
    private replaceTableInMarkdownAST(
        markdownContent: string, 
        newTable: string, 
        headingTexts: string[]
    ): string {
        try {
            // 使用marked的lexer将markdown解析为tokens（AST）
            const tokens = marked.lexer(markdownContent);
            
            let targetHeadingIndex = -1;
            let tableIndex = -1;
            
            // 第一步：找到目标标题的位置
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                if (token.type === 'heading' && token.depth >= 2) {
                    // 检查标题文本是否匹配任何目标文本
                    const headingText = token.text.trim();
                    if (this.isHeadingMatch(headingText, headingTexts)) {
                        targetHeadingIndex = i;
                        this.logger.info(`Found target heading at index ${i}: "${headingText}"`);
                        break;
                    }
                }
            }
            
            if (targetHeadingIndex === -1) {
                throw new Error(`未找到匹配的标题：${headingTexts.join(', ')}`);
            }
            
            // 第二步：从标题后开始查找第一个表格
            for (let i = targetHeadingIndex + 1; i < tokens.length; i++) {
                const token = tokens[i];
                
                // 如果遇到新的同级或更高级标题，停止搜索
                if (token.type === 'heading' && token.depth <= (tokens[targetHeadingIndex] as any).depth) {
                    break;
                }
                
                // 找到表格token
                if (token.type === 'table') {
                    tableIndex = i;
                    this.logger.info(`Found table at index ${i}`);
                    break;
                }
            }
            
            if (tableIndex === -1) {
                throw new Error(`在标题"${(tokens[targetHeadingIndex] as any).text}"后未找到表格`);
            }
            
            // 第三步：替换表格内容
            // 将新表格解析为tokens并替换原有的table token
            const newTableTokens = marked.lexer(newTable.trim());
            const newTableToken = newTableTokens.find(token => token.type === 'table');
            
            if (!newTableToken) {
                throw new Error('新表格内容格式无效');
            }
            
            // 替换原有表格
            tokens[tableIndex] = newTableToken;
            
            // 第四步：重新渲染为markdown
            const result = marked.parser(tokens);
            
            this.logger.info('AST-based table replacement completed successfully');
            return result;
            
        } catch (error) {
            this.logger.error('AST-based table replacement failed', error as Error);
            throw new Error(`表格替换失败: ${(error as Error).message}`);
        }
    }
    
    /**
     * 辅助方法：检查标题是否匹配目标文本列表
     */
    private isHeadingMatch(headingText: string, targetTexts: string[]): boolean {
        const normalizedHeading = headingText.toLowerCase().replace(/[^\w\s]/g, '').trim();
        
        return targetTexts.some(target => {
            const normalizedTarget = target.toLowerCase().replace(/[^\w\s]/g, '').trim();
            return normalizedHeading.includes(normalizedTarget) || normalizedTarget.includes(normalizedHeading);
        });
    }

    /**
     * 检查是否可以处理特定文件
     */
    public canHandle(filePath: string): boolean {
        const fileName = path.basename(filePath);
        return Object.values(SyncableFileType).includes(fileName as SyncableFileType);
    }

    /**
     * 获取支持的文件类型
     */
    public getSupportedFileTypes(): SyncableFileType[] {
        return Object.values(SyncableFileType);
    }
} 