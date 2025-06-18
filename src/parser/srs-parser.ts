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

        // 检查必要的分隔符
        const requiredSections = [
            '--- SOFTWARE REQUIREMENTS SPECIFICATION ---',
            '--- FUNCTIONAL REQUIREMENTS ---',
            '--- NON-FUNCTIONAL REQUIREMENTS ---'
        ];

        for (const section of requiredSections) {
            if (!content.includes(section)) {
                this.warnings.push({
                    severity: ErrorSeverity.HIGH,
                    message: `Missing required section: ${section}`,
                    section: 'validation'
                });
            }
        }
    }

    /**
     * 解析主SRS文档
     */
    private async parseSRSMainDocument(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing main SRS document');
            
            const srsStart = content.indexOf('--- SOFTWARE REQUIREMENTS SPECIFICATION ---');
            const functionalStart = content.indexOf('--- FUNCTIONAL REQUIREMENTS ---');
            
            if (srsStart === -1) {
                throw new Error('SRS main document section not found');
            }

            const srsEnd = functionalStart !== -1 ? functionalStart : content.length;
            const srsContent = content.substring(srsStart, srsEnd);

            // 处理SRS内容，移除分隔符
            const cleanSrsContent = srsContent
                .replace('--- SOFTWARE REQUIREMENTS SPECIFICATION ---', '')
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
     * 解析功能需求
     */
    private async parseFunctionalRequirements(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing functional requirements');
            
            const startMarker = '--- FUNCTIONAL REQUIREMENTS ---';
            const endMarker = '--- NON-FUNCTIONAL REQUIREMENTS ---';
            
            const startIndex = content.indexOf(startMarker);
            const endIndex = content.indexOf(endMarker);
            
            if (startIndex === -1) {
                this.warnings.push({
                    severity: ErrorSeverity.HIGH,
                    message: 'Functional requirements section not found',
                    section: 'functional_requirements'
                });
                return;
            }

            const endIdx = endIndex !== -1 ? endIndex : content.length;
            const frContent = content.substring(startIndex + startMarker.length, endIdx).trim();
            
            // 使用YAML生成器处理功能需求
            const yamlContent = this.yamlGenerator.generateFunctionalRequirementsYaml(frContent);
            artifacts['fr.yaml'] = yamlContent;
            
            this.logger.info('Functional requirements parsed successfully');

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
     * 解析非功能性需求
     */
    private async parseNonFunctionalRequirements(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing non-functional requirements');
            
            const startMarker = '--- NON-FUNCTIONAL REQUIREMENTS ---';
            const endMarker = '--- GLOSSARY ---';
            
            const startIndex = content.indexOf(startMarker);
            const endIndex = content.indexOf(endMarker);
            
            if (startIndex === -1) {
                this.warnings.push({
                    severity: ErrorSeverity.HIGH,
                    message: 'Non-functional requirements section not found',
                    section: 'non_functional_requirements'
                });
                return;
            }

            const endIdx = endIndex !== -1 ? endIndex : content.length;
            const nfrContent = content.substring(startIndex + startMarker.length, endIdx).trim();
            
            // 使用YAML生成器处理非功能需求
            const yamlContent = this.yamlGenerator.generateNonFunctionalRequirementsYaml(nfrContent);
            artifacts['nfr.yaml'] = yamlContent;
            
            this.logger.info('Non-functional requirements parsed successfully');

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
     * 解析术语表
     */
    private async parseGlossary(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing glossary');
            
            const startMarker = '--- GLOSSARY ---';
            const endMarker = '--- QUESTIONS FOR CLARIFICATION ---';
            
            const startIndex = content.indexOf(startMarker);
            const endIndex = content.indexOf(endMarker);
            
            if (startIndex === -1) {
                this.warnings.push({
                    severity: ErrorSeverity.MEDIUM,
                    message: 'Glossary section not found',
                    section: 'glossary'
                });
                return;
            }

            const endIdx = endIndex !== -1 ? endIndex : content.length;
            const glossaryContent = content.substring(startIndex + startMarker.length, endIdx).trim();
            
            // 使用YAML生成器处理术语表
            const yamlContent = this.yamlGenerator.generateGlossaryYaml(glossaryContent);
            artifacts['glossary.yaml'] = yamlContent;
            
            this.logger.info('Glossary parsed successfully');

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
     * 解析分类决策
     */
    private async parseClassificationDecision(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing classification decision');
            
            const startMarker = '--- AI CLASSIFICATION DECISION ---';
            const endMarker = '--- SOFTWARE REQUIREMENTS SPECIFICATION ---';
            
            const startIndex = content.indexOf(startMarker);
            const endIndex = content.indexOf(endMarker);
            
            if (startIndex === -1) {
                this.warnings.push({
                    severity: ErrorSeverity.LOW,
                    message: 'Classification decision section not found',
                    section: 'classification'
                });
                return;
            }

            const endIdx = endIndex !== -1 ? endIndex : content.length;
            const classificationContent = content.substring(startIndex, endIdx).trim();
            
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
     * 解析待澄清问题
     */
    private async parseQuestionsForClarification(content: string, artifacts: ParsedArtifacts): Promise<void> {
        try {
            this.logger.info('Parsing questions for clarification');
            
            const startMarker = '--- QUESTIONS FOR CLARIFICATION ---';
            const endMarker = '--- PARSING METADATA ---';
            
            const startIndex = content.indexOf(startMarker);
            const endIndex = content.indexOf(endMarker);
            
            if (startIndex === -1) {
                this.warnings.push({
                    severity: ErrorSeverity.LOW,
                    message: 'Questions for clarification section not found',
                    section: 'questions'
                });
                return;
            }

            const endIdx = endIndex !== -1 ? endIndex : content.length;
            const questionsContent = content.substring(startIndex, endIdx).trim();
            
            artifacts['questions_for_clarification.md'] = questionsContent;
            this.logger.info('Questions for clarification parsed successfully');

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
}
