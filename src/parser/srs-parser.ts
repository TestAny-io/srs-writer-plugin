import { ISRSParser, ParsedArtifacts, ParseOptions, ErrorSeverity, ParseError, ParseResult } from '../types';
import { Logger } from '../utils/logger';
import { MarkdownProcessor } from './markdown-processor';
import { YamlGenerator } from './yaml-generator';
import * as yaml from 'js-yaml';

/**
 * SRS文档解析器
 * 负责将AI生成的母文档解析为多个结构化文件
 */
export class SRSParser implements ISRSParser {
    private logger = Logger.getInstance();
    private markdownProcessor = new MarkdownProcessor();
    private yamlGenerator = new YamlGenerator();
    private errors: ParseError[] = [];
    private warnings: ParseError[] = [];

    /**
     * 解析母文档，生成所有最终文件
     * 实现优雅降级：即使部分内容解析失败，也应尽力返回成功解析的部分
     */
    public async parse(motherDocumentContent: string, options?: ParseOptions): Promise<ParsedArtifacts> {
        this.logger.info('Starting mother document parsing');
        this.errors = [];
        this.warnings = [];

        const startTime = Date.now();
        const artifacts: ParsedArtifacts = {};

        try {
            // 验证母文档基本格式
            this.validateMotherDocument(motherDocumentContent);

            // 解析各个部分
            await this.parseSRSMainDocument(motherDocumentContent, artifacts);
            await this.parseFunctionalRequirements(motherDocumentContent, artifacts);
            await this.parseNonFunctionalRequirements(motherDocumentContent, artifacts);
            await this.parseGlossary(motherDocumentContent, artifacts);
            await this.parseClassificationDecision(motherDocumentContent, artifacts);
            await this.parseQuestionsForClarification(motherDocumentContent, artifacts);

            // 生成解析日志
            const parseTime = Date.now() - startTime;
            this.generateWriterLog(artifacts, parseTime, options);

            this.logger.info(`Parsing completed in ${parseTime}ms, generated ${Object.keys(artifacts).length} files`);
            
            return artifacts;

        } catch (error) {
            this.logger.error('Critical parsing error', error as Error);
            
            // 即使发生严重错误，也尝试生成基本的错误日志
            this.errors.push({
                severity: ErrorSeverity.CRITICAL,
                message: (error as Error).message,
                section: 'parser',
                details: error
            });

            this.generateWriterLog(artifacts, Date.now() - startTime, options);
            
            throw error;
        }
    }

    /**
     * 验证母文档的基本格式
     */
    private validateMotherDocument(content: string): void {
        if (!content || content.trim().length === 0) {
            throw new Error('Mother document is empty');
        }

        if (content.length < 200) {
            this.warnings.push({
                severity: ErrorSeverity.MEDIUM,
                message: 'Mother document seems too short',
                section: 'validation'
            });
        }

        // v1.2更新：检查必要的分隔符（支持新旧两种格式）
        const requiredSectionsNew = [
            '### --- SOFTWARE_REQUIREMENTS_SPECIFICATION_CONTENT ---',
            '### --- AI_CLASSIFICATION_DECISION ---'
        ];

        const requiredSectionsOld = [
            '--- SOFTWARE REQUIREMENTS SPECIFICATION ---',
            '--- FUNCTIONAL REQUIREMENTS ---'
        ];

        // 检查是否包含新格式或旧格式的分隔符
        const hasNewFormat = requiredSectionsNew.some(section => content.includes(section));
        const hasOldFormat = requiredSectionsOld.some(section => content.includes(section));

        if (!hasNewFormat && !hasOldFormat) {
            this.warnings.push({
                severity: ErrorSeverity.HIGH,
                message: 'No recognized section format found (neither new nor old format)',
                section: 'validation'
            });
        }

        this.logger.info(`Document format detected: ${hasNewFormat ? 'new' : 'old'} format`);
    }

    /**
     * 解析主SRS文档（v1.2更新：支持新旧格式）
     */
    private async parseSRSMainDocument(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing main SRS document');
            
            // v1.2：支持新旧两种格式
            const newFormatStart = content.indexOf('### --- SOFTWARE_REQUIREMENTS_SPECIFICATION_CONTENT ---');
            const oldFormatStart = content.indexOf('--- SOFTWARE REQUIREMENTS SPECIFICATION ---');
            
            let srsStart = -1;
            let startMarker = '';
            let endMarker = '';
            
            if (newFormatStart !== -1) {
                // 新格式
                srsStart = newFormatStart;
                startMarker = '### --- SOFTWARE_REQUIREMENTS_SPECIFICATION_CONTENT ---';
                endMarker = '### ---'; // 查找下一个新格式块
            } else if (oldFormatStart !== -1) {
                // 旧格式
                srsStart = oldFormatStart;
                startMarker = '--- SOFTWARE REQUIREMENTS SPECIFICATION ---';
                endMarker = '---'; // 查找下一个旧格式块
            } else {
                throw new Error('SRS main document section not found in either format');
            }

            // 查找结束位置
            let srsEnd = content.length;
            const nextBlockStart = content.indexOf(endMarker, srsStart + startMarker.length);
            if (nextBlockStart !== -1) {
                srsEnd = nextBlockStart;
            }

            const srsContent = content.substring(srsStart, srsEnd);

            // 处理SRS内容，移除分隔符
            const cleanSrsContent = srsContent
                .replace(startMarker, '')
                .trim();

            artifacts['SRS.md'] = cleanSrsContent;
            this.logger.info('Main SRS document parsed successfully');

        } catch (error) {
            this.errors.push({
                severity: ErrorSeverity.CRITICAL,
                message: `Failed to parse main SRS document: ${(error as Error).message}`,
                section: 'srs_main',
                details: error
            });
            throw error;
        }
    }

    /**
     * 解析功能需求（v1.2更新：从SRS主文档内容中提取）
     */
    private async parseFunctionalRequirements(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing functional requirements from SRS content');
            
            // 1. 先提取SRS主文档内容
            const srsContent = this.extractSRSContentFromMother(content);
            
            if (!srsContent) {
                this.warnings.push({
                    severity: ErrorSeverity.HIGH,
                    message: 'Could not extract SRS content for functional requirements parsing',
                    section: 'functional_requirements'
                });
                return;
            }

            // 2. 在SRS内容中查找功能需求章节（支持中英文）
            const frTable = this.extractFRTableFromSRS(srsContent);
            
            if (!frTable) {
                this.warnings.push({
                    severity: ErrorSeverity.HIGH,
                    message: 'Functional requirements table not found in SRS content',
                    section: 'functional_requirements'
                });
                return;
            }

            // 3. 转换表格为YAML
            const yamlContent = this.convertFRTableToYaml(frTable);
            artifacts['fr.yaml'] = yamlContent;
            
            this.logger.info('Functional requirements parsed successfully from SRS content');

        } catch (error) {
            this.errors.push({
                severity: ErrorSeverity.HIGH,
                message: `Failed to parse functional requirements: ${(error as Error).message}`,
                section: 'functional_requirements',
                details: error
            });
            
            // 优雅降级：生成基本的功能需求文件
            artifacts['fr.md'] = this.generateFallbackFunctionalRequirements(content);
        }
    }

    /**
     * 解析非功能性需求（v1.2更新：从SRS主文档内容中提取）
     */
    private async parseNonFunctionalRequirements(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing non-functional requirements from SRS content');
            
            // 1. 先提取SRS主文档内容
            const srsContent = this.extractSRSContentFromMother(content);
            
            if (!srsContent) {
                this.warnings.push({
                    severity: ErrorSeverity.HIGH,
                    message: 'Could not extract SRS content for non-functional requirements parsing',
                    section: 'non_functional_requirements'
                });
                return;
            }

            // 2. 在SRS内容中查找非功能需求章节（支持中英文）
            const nfrTable = this.extractNFRTableFromSRS(srsContent);
            
            if (!nfrTable) {
                this.warnings.push({
                    severity: ErrorSeverity.HIGH,
                    message: 'Non-functional requirements table not found in SRS content',
                    section: 'non_functional_requirements'
                });
                return;
            }

            // 3. 转换表格为YAML
            const yamlContent = this.convertNFRTableToYaml(nfrTable);
            artifacts['nfr.yaml'] = yamlContent;
            
            this.logger.info('Non-functional requirements parsed successfully from SRS content');

        } catch (error) {
            this.errors.push({
                severity: ErrorSeverity.HIGH,
                message: `Failed to parse non-functional requirements: ${(error as Error).message}`,
                section: 'non_functional_requirements',
                details: error
            });
            
            // 优雅降级：生成基本的非功能需求文件
            artifacts['nfr.md'] = this.generateFallbackNonFunctionalRequirements(content);
        }
    }

    /**
     * 解析术语表（v1.2更新：从SRS主文档内容中提取）
     */
    private async parseGlossary(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing glossary from SRS content');
            
            // 1. 先提取SRS主文档内容
            const srsContent = this.extractSRSContentFromMother(content);
            
            if (!srsContent) {
                this.warnings.push({
                    severity: ErrorSeverity.MEDIUM,
                    message: 'Could not extract SRS content for glossary parsing',
                    section: 'glossary'
                });
                return;
            }

            // 2. 在SRS内容中查找术语表章节（支持中英文）
            const glossaryTable = this.extractGlossaryTableFromSRS(srsContent);
            
            if (!glossaryTable) {
                this.warnings.push({
                    severity: ErrorSeverity.MEDIUM,
                    message: 'Glossary table not found in SRS content',
                    section: 'glossary'
                });
                return;
            }

            // 3. 转换表格为YAML
            const yamlContent = this.convertGlossaryTableToYaml(glossaryTable);
            artifacts['glossary.yaml'] = yamlContent;
            
            this.logger.info('Glossary parsed successfully from SRS content');

        } catch (error) {
            this.errors.push({
                severity: ErrorSeverity.MEDIUM,
                message: `Failed to parse glossary: ${(error as Error).message}`,
                section: 'glossary',
                details: error
            });
        }
    }

    /**
     * 解析分类决策（v1.2更新：支持新旧格式）
     */
    private async parseClassificationDecision(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing classification decision');
            
            // v1.2：支持新旧两种格式
            const newFormatStart = content.indexOf('### --- AI_CLASSIFICATION_DECISION ---');
            const oldFormatStart = content.indexOf('--- AI CLASSIFICATION DECISION ---');
            
            let startIndex = -1;
            let startMarker = '';
            let endMarker = '';
            
            if (newFormatStart !== -1) {
                // 新格式
                startIndex = newFormatStart;
                startMarker = '### --- AI_CLASSIFICATION_DECISION ---';
                endMarker = '### ---'; // 查找下一个新格式块
            } else if (oldFormatStart !== -1) {
                // 旧格式  
                startIndex = oldFormatStart;
                startMarker = '--- AI CLASSIFICATION DECISION ---';
                endMarker = '---'; // 查找下一个旧格式块
            } else {
                this.warnings.push({
                    severity: ErrorSeverity.LOW,
                    message: 'Classification decision section not found in either format',
                    section: 'classification'
                });
                return;
            }

            // 查找结束位置
            let endIndex = content.length;
            const nextBlockStart = content.indexOf(endMarker, startIndex + startMarker.length);
            if (nextBlockStart !== -1) {
                endIndex = nextBlockStart;
            }

            const classificationContent = content.substring(startIndex, endIndex)
                .replace(startMarker, '')
                .trim();
            
            artifacts['classification_decision.md'] = classificationContent;
            this.logger.info('Classification decision parsed successfully');

        } catch (error) {
            this.errors.push({
                severity: ErrorSeverity.LOW,
                message: `Failed to parse classification decision: ${(error as Error).message}`,
                section: 'classification',
                details: error
            });
        }
    }

    /**
     * 解析待澄清问题（v1.2更新：支持新旧格式）
     */
    private async parseQuestionsForClarification(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing questions for clarification');
            
            // v1.2：支持新旧两种格式
            const newFormatStart = content.indexOf('### --- QUESTIONS_AND_SUGGESTIONS_CONTENT ---');
            const oldFormatStart = content.indexOf('--- QUESTIONS FOR CLARIFICATION ---');
            
            let startIndex = -1;
            let startMarker = '';
            let endMarker = '';
            
            if (newFormatStart !== -1) {
                // 新格式
                startIndex = newFormatStart;
                startMarker = '### --- QUESTIONS_AND_SUGGESTIONS_CONTENT ---';
                endMarker = '### ---'; // 查找下一个新格式块
            } else if (oldFormatStart !== -1) {
                // 旧格式
                startIndex = oldFormatStart;
                startMarker = '--- QUESTIONS FOR CLARIFICATION ---';
                endMarker = '---'; // 查找下一个旧格式块
            } else {
                this.warnings.push({
                    severity: ErrorSeverity.LOW,
                    message: 'Questions section not found in either format',
                    section: 'questions'
                });
                return;
            }

            // 查找结束位置
            let endIndex = content.length;
            const nextBlockStart = content.indexOf(endMarker, startIndex + startMarker.length);
            if (nextBlockStart !== -1) {
                endIndex = nextBlockStart;
            }

            const questionsContent = content.substring(startIndex, endIndex)
                .replace(startMarker, '')
                .trim();
            
            artifacts['questions_and_suggestions.md'] = questionsContent;
            this.logger.info('Questions and suggestions parsed successfully');

        } catch (error) {
            this.errors.push({
                severity: ErrorSeverity.LOW,
                message: `Failed to parse questions: ${(error as Error).message}`,
                section: 'questions',
                details: error
            });
        }
    }

    /**
     * 生成解析日志
     */
    private generateWriterLog(artifacts: ParsedArtifacts, parseTime: number, options?: ParseOptions): void {
        const logData = {
            timestamp: new Date().toISOString(),
            parser_version: '1.0',
            parse_time_ms: parseTime,
            files_generated: Object.keys(artifacts),
            files_count: Object.keys(artifacts).length,
            errors: this.errors,
            warnings: this.warnings,
            options: options || {},
            success: this.errors.filter(e => e.severity === ErrorSeverity.CRITICAL).length === 0
        };

        artifacts['writer_log.json'] = JSON.stringify(logData, null, 2);
    }

    /**
     * 生成降级功能需求文件
     */
    private generateFallbackFunctionalRequirements(content: string): string {
        return `# 功能需求 (Functional Requirements)\n\n> 注意：此文件由于YAML解析失败而生成的降级版本\n\n从母文档中提取的原始内容请查看完整的SRS.md文件。\n\n生成时间：${new Date().toISOString()}`;
    }

    /**
     * 生成降级非功能需求文件
     */
    private generateFallbackNonFunctionalRequirements(content: string): string {
        return `# 非功能性需求 (Non-Functional Requirements)\n\n> 注意：此文件由于YAML解析失败而生成的降级版本\n\n从母文档中提取的原始内容请查看完整的SRS.md文件。\n\n生成时间：${new Date().toISOString()}`;
    }

    /**
     * 获取解析统计信息
     */
    public getParsingStats(): object {
        return {
            errorsCount: this.errors.length,
            warningsCount: this.warnings.length,
            criticalErrors: this.errors.filter(e => e.severity === ErrorSeverity.CRITICAL).length,
            lastParsed: new Date().toISOString()
        };
    }

    /**
     * v1.2新增：从母文档中提取SRS主文档内容
     */
    private extractSRSContentFromMother(motherContent: string): string | null {
        try {
            // 支持新旧两种格式
            const newFormat = /^### --- SOFTWARE_REQUIREMENTS_SPECIFICATION_CONTENT ---$(.*?)^### --- [A-Z_]+ ---$/gms;
            const oldFormat = /^--- SOFTWARE REQUIREMENTS SPECIFICATION ---(.*?)^--- [A-Z\s]+ ---$/gms;
            
            let match = motherContent.match(newFormat);
            if (!match) {
                match = motherContent.match(oldFormat);
            }
            
            if (!match) {
                this.logger.warn('无法从母文档中提取SRS主文档内容');
                return null;
            }
            
            return match[1].trim();
        } catch (error) {
            this.logger.error('提取SRS内容失败', error as Error);
            return null;
        }
    }

    /**
     * v1.2新增：从SRS内容中提取功能需求表格
     */
    private extractFRTableFromSRS(srsContent: string): string | null {
        try {
            // 查找功能需求章节（支持中英文）
            const patterns = [
                /## 3\.\s*功能需求.*?\n((?:\|.*?\|\n)+)/s,
                /## 3\.\s*Functional Requirements.*?\n((?:\|.*?\|\n)+)/s,
                /##\s*功能需求.*?\n((?:\|.*?\|\n)+)/s,
                /##\s*Functional Requirements.*?\n((?:\|.*?\|\n)+)/s
            ];

            for (const pattern of patterns) {
                const match = srsContent.match(pattern);
                if (match && match[1]) {
                    this.logger.info('成功找到功能需求表格');
                    return match[1].trim();
                }
            }

            this.logger.warn('在SRS内容中未找到功能需求表格');
            return null;
        } catch (error) {
            this.logger.error('提取功能需求表格失败', error as Error);
            return null;
        }
    }

    /**
     * v1.2新增：从SRS内容中提取非功能需求表格
     */
    private extractNFRTableFromSRS(srsContent: string): string | null {
        try {
            // 查找非功能需求章节（支持中英文）
            const patterns = [
                /## 4\.\s*非功能性需求.*?\n((?:\|.*?\|\n)+)/s,
                /## 4\.\s*Non-Functional Requirements.*?\n((?:\|.*?\|\n)+)/s,
                /##\s*非功能性需求.*?\n((?:\|.*?\|\n)+)/s,
                /##\s*Non-Functional Requirements.*?\n((?:\|.*?\|\n)+)/s
            ];

            for (const pattern of patterns) {
                const match = srsContent.match(pattern);
                if (match && match[1]) {
                    this.logger.info('成功找到非功能需求表格');
                    return match[1].trim();
                }
            }

            this.logger.warn('在SRS内容中未找到非功能需求表格');
            return null;
        } catch (error) {
            this.logger.error('提取非功能需求表格失败', error as Error);
            return null;
        }
    }

    /**
     * v1.2新增：从SRS内容中提取术语表
     */
    private extractGlossaryTableFromSRS(srsContent: string): string | null {
        try {
            // 查找术语表章节（支持中英文）
            const patterns = [
                /##\s*.*?术语表.*?\n((?:\|.*?\|\n)+)/s,
                /##\s*.*?Glossary.*?\n((?:\|.*?\|\n)+)/s,
                /##\s*.*?词汇表.*?\n((?:\|.*?\|\n)+)/s
            ];

            for (const pattern of patterns) {
                const match = srsContent.match(pattern);
                if (match && match[1]) {
                    this.logger.info('成功找到术语表');
                    return match[1].trim();
                }
            }

            this.logger.warn('在SRS内容中未找到术语表');
            return null;
        } catch (error) {
            this.logger.error('提取术语表失败', error as Error);
            return null;
        }
    }

    /**
     * v1.2新增：将功能需求表格转换为YAML
     */
    private convertFRTableToYaml(tableContent: string): string {
        try {
            const requirements: any[] = [];
            const lines = tableContent.split('\n').filter(line => line.trim() && !line.includes('---'));

            for (let i = 1; i < lines.length; i++) { // 跳过表头
                const line = lines[i];
                const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
                
                if (cells.length >= 4) {
                    requirements.push({
                        id: cells[0] || '',
                        name: cells[1] || '',
                        priority: cells[2] || '',
                        description: cells[3] || '',
                        acceptance_criteria: cells[4] || '',
                        notes: cells[5] || ''
                    });
                }
            }

            const yamlData = {
                functional_requirements: requirements,
                metadata: {
                    extracted_from: 'SRS main document',
                    extraction_time: new Date().toISOString(),
                    total_count: requirements.length
                }
            };

            return yaml.dump(yamlData, { 
                sortKeys: false, 
                lineWidth: 120,
                noRefs: true 
            });
        } catch (error) {
            this.logger.error('转换功能需求表格为YAML失败', error as Error);
            return `# 功能需求解析失败\n# Error: ${(error as Error).message}\nfunctional_requirements: []`;
        }
    }

    /**
     * v1.2新增：将非功能需求表格转换为YAML
     */
    private convertNFRTableToYaml(tableContent: string): string {
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
                    extracted_from: 'SRS main document',
                    extraction_time: new Date().toISOString(),
                    total_count: requirements.length
                }
            };

            return yaml.dump(yamlData, { 
                sortKeys: false, 
                lineWidth: 120,
                noRefs: true 
            });
        } catch (error) {
            this.logger.error('转换非功能需求表格为YAML失败', error as Error);
            return `# 非功能需求解析失败\n# Error: ${(error as Error).message}\nnon_functional_requirements: []`;
        }
    }

    /**
     * v1.2新增：将术语表转换为YAML
     */
    private convertGlossaryTableToYaml(tableContent: string): string {
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
                    extracted_from: 'SRS main document',
                    extraction_time: new Date().toISOString(),
                    total_count: terms.length
                }
            };

            return yaml.dump(yamlData, { 
                sortKeys: false, 
                lineWidth: 120,
                noRefs: true 
            });
        } catch (error) {
            this.logger.error('转换术语表为YAML失败', error as Error);
            return `# 术语表解析失败\n# Error: ${(error as Error).message}\nterms: []`;
        }
    }
}
