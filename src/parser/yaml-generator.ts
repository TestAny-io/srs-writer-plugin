import * as yaml from 'js-yaml';
import { Logger } from '../utils/logger';

/**
 * YAML生成器
 * 负责将文本内容转换为结构化的YAML格式
 */
export class YamlGenerator {
    private logger = Logger.getInstance();

    /**
     * 生成功能需求YAML文件
     */
    public generateFunctionalRequirementsYaml(content: string): string {
        try {
            this.logger.info('Generating functional requirements YAML');
            
            // 尝试从内容中解析YAML数据
            const yamlMatch = content.match(/functional_requirements:\s*\n([\s\S]*?)(?=\n\S|\n*$)/);
            
            if (yamlMatch) {
                // 如果找到了YAML格式的数据，直接使用
                const yamlText = `functional_requirements:\n${yamlMatch[1]}`;
                
                // 验证YAML格式
                yaml.load(yamlText);
                return yamlText;
            } else {
                // 如果没有找到YAML格式，尝试从Markdown表格中提取
                return this.extractRequirementsFromTable(content, 'functional');
            }
            
        } catch (error) {
            this.logger.error('Failed to generate functional requirements YAML', error as Error);
            throw new Error(`YAML generation failed: ${(error as Error).message}`);
        }
    }

    /**
     * 生成非功能需求YAML文件
     */
    public generateNonFunctionalRequirementsYaml(content: string): string {
        try {
            this.logger.info('Generating non-functional requirements YAML');
            
            // 尝试从内容中解析YAML数据
            const yamlMatch = content.match(/non_functional_requirements:\s*\n([\s\S]*?)(?=\n\S|\n*$)/);
            
            if (yamlMatch) {
                // 如果找到了YAML格式的数据，直接使用
                const yamlText = `non_functional_requirements:\n${yamlMatch[1]}`;
                
                // 验证YAML格式
                yaml.load(yamlText);
                return yamlText;
            } else {
                // 如果没有找到YAML格式，尝试从Markdown表格中提取
                return this.extractRequirementsFromTable(content, 'non-functional');
            }
            
        } catch (error) {
            this.logger.error('Failed to generate non-functional requirements YAML', error as Error);
            throw new Error(`YAML generation failed: ${(error as Error).message}`);
        }
    }

    /**
     * 生成术语表YAML文件
     */
    public generateGlossaryYaml(content: string): string {
        try {
            this.logger.info('Generating glossary YAML');
            
            // 尝试从内容中解析YAML数据
            const yamlMatch = content.match(/glossary:\s*\n([\s\S]*?)(?=\n\S|\n*$)/);
            
            if (yamlMatch) {
                // 如果找到了YAML格式的数据，直接使用
                const yamlText = `glossary:\n${yamlMatch[1]}`;
                
                // 验证YAML格式
                yaml.load(yamlText);
                return yamlText;
            } else {
                // 如果没有找到YAML格式，生成基本的术语表
                return this.generateBasicGlossary();
            }
            
        } catch (error) {
            this.logger.error('Failed to generate glossary YAML', error as Error);
            throw new Error(`YAML generation failed: ${(error as Error).message}`);
        }
    }

    /**
     * 从Markdown表格中提取需求信息
     */
    private extractRequirementsFromTable(content: string, type: 'functional' | 'non-functional'): string {
        const lines = content.split('\n');
        const requirements: any[] = [];
        let inTable = false;
        let headerRow = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 检测表格开始
            if (line.includes('|') && line.includes('需求名称') && line.includes('优先级')) {
                inTable = true;
                headerRow = i;
                continue;
            }
            
            // 跳过表格分隔符行
            if (inTable && line.match(/^\|[\s\-\|]+\|$/)) {
                continue;
            }
            
            // 解析表格行
            if (inTable && line.includes('|')) {
                const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
                
                if (cells.length >= 4) {
                    const req = {
                        id: cells[0] || `${type === 'functional' ? 'FR' : 'NFR'}-${String(requirements.length + 1).padStart(3, '0')}`,
                        title: cells[1] || 'Untitled Requirement',
                        priority: this.normalizePriority(cells[2] || 'medium'),
                        description: cells[3] || 'No description provided'
                    };
                    
                    if (type === 'non-functional') {
                        (req as any).category = this.inferCategory(req.title, req.description);
                        (req as any).measurement = req.description;
                    } else {
                        (req as any).acceptance_criteria = [req.description];
                        (req as any).dependencies = [];
                    }
                    
                    requirements.push(req);
                }
            }
            
            // 检测表格结束
            if (inTable && !line.includes('|')) {
                break;
            }
        }
        
        if (requirements.length === 0) {
            // 如果没有找到表格，生成基本的需求结构
            requirements.push({
                id: type === 'functional' ? 'FR-001' : 'NFR-001',
                title: '基本需求',
                priority: 'medium',
                description: '从母文档中提取的基本需求',
                ...(type === 'functional' ? {
                    acceptance_criteria: ['待定'],
                    dependencies: []
                } : {
                    category: 'general',
                    measurement: '待定'
                })
            });
        }
        
        const yamlData = {
            [type === 'functional' ? 'functional_requirements' : 'non_functional_requirements']: requirements
        };
        
        return yaml.dump(yamlData, { indent: 2, lineWidth: 120 });
    }

    /**
     * 规范化优先级
     */
    private normalizePriority(priority: string): string {
        const normalized = priority.toLowerCase();
        
        if (normalized.includes('critical') || normalized.includes('关键')) {
            return 'critical';
        } else if (normalized.includes('high') || normalized.includes('高')) {
            return 'high';
        } else if (normalized.includes('low') || normalized.includes('低')) {
            return 'low';
        } else {
            return 'medium';
        }
    }

    /**
     * 推断非功能需求类别
     */
    private inferCategory(title: string, description: string): string {
        const text = (title + ' ' + description).toLowerCase();
        
        if (text.includes('性能') || text.includes('performance') || text.includes('速度') || text.includes('响应')) {
            return 'performance';
        } else if (text.includes('安全') || text.includes('security') || text.includes('认证') || text.includes('授权')) {
            return 'security';
        } else if (text.includes('可用') || text.includes('availability') || text.includes('稳定')) {
            return 'availability';
        } else if (text.includes('可扩展') || text.includes('scalability') || text.includes('扩展')) {
            return 'scalability';
        } else if (text.includes('兼容') || text.includes('compatibility') || text.includes('支持')) {
            return 'compatibility';
        } else {
            return 'general';
        }
    }

    /**
     * 生成基本的术语表
     */
    private generateBasicGlossary(): string {
        const glossaryData = {
            glossary: [
                {
                    term: 'SRS',
                    definition: 'Software Requirements Specification - 软件需求规格说明书',
                    category: 'technical'
                },
                {
                    term: 'FR',
                    definition: 'Functional Requirement - 功能需求',
                    category: 'technical'
                },
                {
                    term: 'NFR',
                    definition: 'Non-Functional Requirement - 非功能需求',
                    category: 'technical'
                }
            ]
        };
        
        return yaml.dump(glossaryData, { indent: 2, lineWidth: 120 });
    }

    /**
     * 验证生成的YAML格式
     */
    public validateYaml(yamlContent: string): boolean {
        try {
            yaml.load(yamlContent);
            return true;
        } catch (error) {
            this.logger.warn('YAML validation failed: ' + (error as Error).message);
            return false;
        }
    }

    /**
     * 美化YAML输出
     */
    public prettifyYaml(yamlContent: string): string {
        try {
            const data = yaml.load(yamlContent);
            return yaml.dump(data, {
                indent: 2,
                lineWidth: 120,
                noRefs: true,
                sortKeys: false
            });
        } catch (error) {
            this.logger.warn('Failed to prettify YAML: ' + (error as Error).message);
            return yamlContent;
        }
    }
}
