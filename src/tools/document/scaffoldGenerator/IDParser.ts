import { Logger } from '../../../utils/logger';
import { ExtractedId, IdStatistics, ScaffoldError, ScaffoldErrorType } from './types';

/**
 * ID解析引擎
 * 负责从SRS文档中提取所有符合格式的需求ID
 */
export class IDParser {
    private static readonly logger = Logger.getInstance();

    // 支持的ID格式正则表达式
    private static readonly ID_PATTERNS = {
        // 基础实体: US-xxx, UC-xxx, FR-xxx, NFR-xxx, IFR-xxx, DAR-xxx
        BASIC: /\b(US|UC|FR|NFR|IFR|DAR)-[A-Z0-9_-]+\b/g,
        
        // ADC复合实体: ADC-ASSU-xxx, ADC-DEPEN-xxx, ADC-CONST-xxx
        ADC: /\b(ADC)-(ASSU|DEPEN|CONST)-[A-Z0-9_-]+\b/g
    };

    // 支持的实体前缀
    private static readonly BASIC_PREFIXES = ['US', 'UC', 'FR', 'NFR', 'IFR', 'DAR'];
    private static readonly ADC_SUBTYPES = ['ASSU', 'DEPEN', 'CONST'];

    /**
     * 从SRS文档中提取所有ID
     * @param srsContent SRS文档内容
     * @returns 提取的ID列表
     */
    public static async extractAllIds(srsContent: string): Promise<ExtractedId[]> {
        try {
            this.logger.info('🔍 开始解析SRS文档中的需求ID...');
            
            if (!srsContent || srsContent.trim().length === 0) {
                throw new ScaffoldError(
                    ScaffoldErrorType.INVALID_SRS_FORMAT,
                    'SRS文档内容为空'
                );
            }

            const extractedIds: ExtractedId[] = [];

            // 1. 提取基础实体ID
            const basicIds = this.extractBasicIds(srsContent);
            extractedIds.push(...basicIds);

            // 2. 提取ADC复合实体ID
            const adcIds = this.extractAdcIds(srsContent);
            extractedIds.push(...adcIds);

            // 3. 去重并排序
            const uniqueIds = this.deduplicateAndSort(extractedIds);

            // 4. 生成统计信息
            const statistics = this.generateStatistics(uniqueIds);
            
            this.logger.info(`📊 ID提取完成 - 总计: ${statistics.totalIds} 个唯一ID`);
            this.logger.info(`📈 类型分布: ${JSON.stringify(statistics.byType, null, 2)}`);
            
            if (statistics.duplicates.length > 0) {
                this.logger.warn(`⚠️  发现重复ID: ${statistics.duplicates.join(', ')}`);
            }

            return uniqueIds;

        } catch (error) {
            if (error instanceof ScaffoldError) {
                throw error;
            }
            
            this.logger.error('ID解析过程中发生错误', error as Error);
            throw new ScaffoldError(
                ScaffoldErrorType.ID_PARSING_FAILED,
                `ID解析失败: ${(error as Error).message}`
            );
        }
    }

    /**
     * 提取基础实体ID (US, UC, FR, NFR, IFR, DAR)
     */
    private static extractBasicIds(content: string): ExtractedId[] {
        const basicMatches = content.match(this.ID_PATTERNS.BASIC) || [];
        const extractedIds: ExtractedId[] = [];

        for (const match of basicMatches) {
            const [prefix] = match.split('-');
            
            // 验证前缀是否有效
            if (this.BASIC_PREFIXES.includes(prefix)) {
                extractedIds.push({
                    id: match,
                    type: 'basic',
                    prefix,
                    fullMatch: match
                });
            } else {
                this.logger.warn(`⚠️  发现无效的基础实体前缀: ${match}`);
            }
        }

        return extractedIds;
    }

    /**
     * 提取ADC复合实体ID (ADC-ASSU, ADC-DEPEN, ADC-CONST)
     */
    private static extractAdcIds(content: string): ExtractedId[] {
        const adcMatches = content.match(this.ID_PATTERNS.ADC) || [];
        const extractedIds: ExtractedId[] = [];

        for (const match of adcMatches) {
            const parts = match.split('-');
            
            if (parts.length >= 3) {
                const [prefix, subType] = parts;
                
                // 验证ADC子类型是否有效
                if (prefix === 'ADC' && this.ADC_SUBTYPES.includes(subType)) {
                    extractedIds.push({
                        id: match,
                        type: 'adc',
                        prefix,
                        subType,
                        fullMatch: match
                    });
                } else {
                    this.logger.warn(`⚠️  发现无效的ADC子类型: ${match}`);
                }
            } else {
                this.logger.warn(`⚠️  ADC ID格式无效: ${match}`);
            }
        }

        return extractedIds;
    }

    /**
     * 去重并排序ID列表
     */
    private static deduplicateAndSort(ids: ExtractedId[]): ExtractedId[] {
        // 使用Map进行去重，保留第一次出现的ID
        const uniqueMap = new Map<string, ExtractedId>();
        const duplicates: string[] = [];

        ids.forEach(id => {
            if (uniqueMap.has(id.id)) {
                duplicates.push(id.id);
            } else {
                uniqueMap.set(id.id, id);
            }
        });

        // 如果有重复，记录警告
        if (duplicates.length > 0) {
            this.logger.warn(`发现重复ID: ${duplicates.join(', ')}`);
        }

        // 排序：按ID字符串自然排序
        return Array.from(uniqueMap.values()).sort((a, b) => 
            a.id.localeCompare(b.id)
        );
    }

    /**
     * 生成ID解析统计信息
     */
    private static generateStatistics(ids: ExtractedId[]): IdStatistics {
        const byType: Record<string, number> = {};
        
        ids.forEach(id => {
            const key = id.type === 'adc' ? `ADC-${id.subType}` : id.prefix;
            byType[key] = (byType[key] || 0) + 1;
        });

        return {
            totalIds: ids.length,
            byType,
            duplicates: [], // 在deduplicateAndSort中已经处理
            malformed: []   // 在extract方法中已经过滤
        };
    }

    /**
     * 验证ID格式是否有效
     */
    public static validateIdFormat(id: string): boolean {
        // 测试基础实体格式
        const basicPattern = new RegExp(this.ID_PATTERNS.BASIC.source);
        if (basicPattern.test(id)) {
            const [prefix] = id.split('-');
            return this.BASIC_PREFIXES.includes(prefix);
        }

        // 测试ADC复合实体格式
        const adcPattern = new RegExp(this.ID_PATTERNS.ADC.source);
        if (adcPattern.test(id)) {
            const parts = id.split('-');
            if (parts.length >= 3) {
                const [prefix, subType] = parts;
                return prefix === 'ADC' && this.ADC_SUBTYPES.includes(subType);
            }
        }

        return false;
    }

    /**
     * 获取支持的ID格式说明
     */
    public static getSupportedFormats(): string[] {
        return [
            '基础实体格式:',
            '  - US-xxx: User Stories (用户故事)',
            '  - UC-xxx: Use Cases (用例)',
            '  - FR-xxx: Functional Requirements (功能需求)',
            '  - NFR-xxx: Non-Functional Requirements (非功能需求)',
            '  - IFR-xxx: Interface Requirements (接口需求)',
            '  - DAR-xxx: Data Requirements (数据需求)',
            '',
            'ADC复合实体格式:',
            '  - ADC-ASSU-xxx: Assumptions (假设条件)',
            '  - ADC-DEPEN-xxx: Dependencies (依赖关系)',
            '  - ADC-CONST-xxx: Constraints (约束条件)',
            '',
            '说明: xxx 为大写字母、数字、下划线和连字符的组合'
        ];
    }
} 