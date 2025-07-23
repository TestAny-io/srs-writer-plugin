import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Logger } from '../../../utils/logger';
import { 
    ExtractedId, 
    SchemaConfig, 
    GenerateOptions, 
    EntitySchema,
    ScaffoldError, 
    ScaffoldErrorType 
} from './types';

/**
 * YAML脚手架生成器
 * 负责根据提取的ID和Schema配置生成结构化的YAML脚手架文件
 */
export class YAMLGenerator {
    private static readonly logger = Logger.getInstance();
    private static readonly OUTPUT_FILENAME = 'requirements.yaml';
    
    // 实体类型排序定义（必须按此顺序输出）
    private static readonly ENTITY_ORDER = [
        'user_stories',              // US-xxx
        'use_cases',                 // UC-xxx  
        'functional_requirements',   // FR-xxx
        'non_functional_requirements', // NFR-xxx
        'interface_requirements',    // IFR-xxx
        'data_requirements',         // DAR-xxx
        'assumptions',               // ADC-ASSU-xxx
        'dependencies',              // ADC-DEPEN-xxx
        'constraints'                // ADC-CONST-xxx
    ];

    /**
     * 生成完整的脚手架YAML
     * @param options 生成选项
     * @returns 生成的脚手架对象
     */
    public static async generateScaffold(options: GenerateOptions): Promise<Record<string, any>> {
        try {
            const { extractedIds, schemas, includeMetadata } = options;
            
            this.logger.info('🏗️ 开始生成YAML脚手架...');
            this.logger.info(`📊 待处理ID数量: ${extractedIds.length}`);

            // 1. 初始化脚手架结构
            const scaffold: Record<string, any> = {};

            // 2. 按实体类型分组ID
            const groupedIds = this.groupIdsByEntityType(extractedIds, schemas);
            this.logger.info(`📋 分组结果: ${Object.keys(groupedIds).length} 个实体类型`);

            // 3. 按固定顺序生成每个实体类型的脚手架
            for (const entityKey of this.ENTITY_ORDER) {
                const ids = groupedIds[entityKey];
                if (ids && ids.length > 0) {
                    scaffold[entityKey] = this.generateEntityScaffold(ids, schemas);
                    this.logger.info(`✅ 生成 ${entityKey}: ${ids.length} 个条目`);
                }
            }

            // 4. 添加生成元数据
            if (includeMetadata) {
                scaffold._metadata = this.generateMetadata(extractedIds, schemas);
                this.logger.info('📝 已添加生成元数据');
            }

            // 5. 验证生成的脚手架
            this.validateGeneratedScaffold(scaffold);

            this.logger.info('🎉 YAML脚手架生成完成');
            return scaffold;

        } catch (error) {
            if (error instanceof ScaffoldError) {
                throw error;
            }

            this.logger.error('YAML脚手架生成失败', error as Error);
            throw new ScaffoldError(
                ScaffoldErrorType.OUTPUT_WRITE_FAILED,
                `YAML脚手架生成失败: ${(error as Error).message}`
            );
        }
    }

    /**
     * 将脚手架写入文件
     * @param scaffoldDir 输出目录
     * @param scaffold 脚手架对象
     * @returns 输出文件路径
     */
    public static async writeScaffoldToFile(
        scaffoldDir: string, 
        scaffold: Record<string, any>
    ): Promise<string> {
        try {
            this.logger.info(`📁 准备写入脚手架文件到: ${scaffoldDir}`);

            // 1. 确保输出目录存在
            await fs.mkdir(scaffoldDir, { recursive: true });

            // 2. 构建输出文件路径
            const outputPath = path.join(scaffoldDir, this.OUTPUT_FILENAME);

            // 3. 生成YAML字符串
            const yamlContent = this.generateYamlString(scaffold);

            // 4. 写入文件
            await fs.writeFile(outputPath, yamlContent, 'utf-8');

            this.logger.info(`✅ 脚手架文件已写入: ${outputPath}`);
            this.logger.info(`📄 文件大小: ${Buffer.byteLength(yamlContent, 'utf-8')} bytes`);

            return outputPath;

        } catch (error) {
            this.logger.error('写入脚手架文件失败', error as Error);
            throw new ScaffoldError(
                ScaffoldErrorType.OUTPUT_WRITE_FAILED,
                `写入脚手架文件失败: ${(error as Error).message}`
            );
        }
    }

    /**
     * 按实体类型分组ID
     */
    private static groupIdsByEntityType(
        extractedIds: ExtractedId[], 
        schemas: SchemaConfig
    ): Record<string, ExtractedId[]> {
        const grouped: Record<string, ExtractedId[]> = {};

        for (const extractedId of extractedIds) {
            const entitySchema = this.getEntitySchema(extractedId, schemas);
            
            if (entitySchema) {
                const yamlKey = entitySchema.yaml_key;
                
                if (!grouped[yamlKey]) {
                    grouped[yamlKey] = [];
                }
                
                grouped[yamlKey].push(extractedId);
            } else {
                this.logger.warn(`⚠️  未找到ID "${extractedId.id}" 的Schema定义，已跳过`);
            }
        }

        // 对每个组内的ID进行排序
        Object.keys(grouped).forEach(key => {
            grouped[key].sort((a, b) => a.id.localeCompare(b.id));
        });

        return grouped;
    }

    /**
     * 获取ID对应的实体Schema
     */
    private static getEntitySchema(extractedId: ExtractedId, schemas: SchemaConfig): EntitySchema | null {
        if (extractedId.type === 'basic') {
            return schemas.entity_mappings[extractedId.prefix] || null;
        } else if (extractedId.type === 'adc' && extractedId.subType) {
            return schemas.adc_mappings[extractedId.subType] || null;
        }
        
        return null;
    }

    /**
     * 为指定实体类型生成脚手架条目
     */
    private static generateEntityScaffold(
        ids: ExtractedId[], 
        schemas: SchemaConfig
    ): Record<string, any>[] {
        const entities: Record<string, any>[] = [];

        for (const extractedId of ids) {
            const entitySchema = this.getEntitySchema(extractedId, schemas);
            
            if (entitySchema) {
                // 深拷贝模板并设置ID
                const entity = this.deepClone(entitySchema.template);
                entity.id = extractedId.id;
                
                // 确保元数据包含创建时间
                if (entity.metadata) {
                    entity.metadata.created_date = new Date().toISOString();
                    entity.metadata.last_modified = new Date().toISOString();
                }
                
                entities.push(entity);
            }
        }

        return entities;
    }

    /**
     * 生成元数据信息
     */
    private static generateMetadata(extractedIds: ExtractedId[], schemas: SchemaConfig): any {
        const idBreakdown: Record<string, number> = {};
        
        // 统计各类型ID数量
        extractedIds.forEach(id => {
            const key = id.type === 'adc' ? `ADC-${id.subType}` : id.prefix;
            idBreakdown[key] = (idBreakdown[key] || 0) + 1;
        });

        return {
            generated_at: new Date().toISOString(),
            generator_version: "1.0.0",
            schema_version: schemas.version,
            total_ids: extractedIds.length,
            id_breakdown: idBreakdown,
            generation_mode: 'full_replacement',
            entity_order: this.ENTITY_ORDER,
            output_filename: this.OUTPUT_FILENAME
        };
    }

    /**
     * 生成YAML字符串
     */
    private static generateYamlString(scaffold: Record<string, any>): string {
        // 添加文件头注释
        const header = [
            '# Requirements Scaffold File',
            '# 需求脚手架文件',
            '# ',
            `# 生成时间: ${new Date().toLocaleString('zh-CN')}`,
            '# 生成工具: SRS Writer Plugin - Requirement Scaffold Generator',
            '# ',
            '# 说明: 此文件由工具自动生成，包含从SRS.md中提取的所有需求ID的结构化脚手架',
            '# 请根据实际需求填充各字段内容',
            '# ',
            '# 实体排序: US → UC → FR → NFR → IFR → DAR → ADC-ASSU → ADC-DEPEN → ADC-CONST',
            '# ',
            ''
        ].join('\n');

        // 生成YAML内容
        const yamlContent = yaml.dump(scaffold, {
            indent: 2,              // 2空格缩进
            noRefs: true,           // 避免YAML引用
            sortKeys: false,        // 保持字段顺序
            lineWidth: -1,          // 不限制行宽
            noCompatMode: true,     // 使用新版YAML格式
            quotingType: '"',       // 使用双引号
            forceQuotes: false      // 不强制引号
        });

        return header + yamlContent;
    }

    /**
     * 验证生成的脚手架
     */
    private static validateGeneratedScaffold(scaffold: Record<string, any>): void {
        // 检查是否为空
        const contentKeys = Object.keys(scaffold).filter(key => key !== '_metadata');
        if (contentKeys.length === 0) {
            throw new ScaffoldError(
                ScaffoldErrorType.OUTPUT_WRITE_FAILED,
                '生成的脚手架为空，未找到任何有效的需求ID'
            );
        }

        // 检查实体顺序是否正确
        let lastOrderIndex = -1;
        for (const key of contentKeys) {
            const orderIndex = this.ENTITY_ORDER.indexOf(key);
            if (orderIndex !== -1) {
                if (orderIndex < lastOrderIndex) {
                    this.logger.warn(`⚠️  实体顺序可能不正确: ${key} 在 ${this.ENTITY_ORDER[lastOrderIndex]} 之后`);
                }
                lastOrderIndex = orderIndex;
            }
        }

        this.logger.info('✅ 脚手架验证通过');
    }

    /**
     * 深拷贝对象
     */
    private static deepClone(obj: any): any {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * 获取支持的实体顺序
     */
    public static getEntityOrder(): string[] {
        return [...this.ENTITY_ORDER];
    }

    /**
     * 获取输出文件名
     */
    public static getOutputFilename(): string {
        return this.OUTPUT_FILENAME;
    }
} 