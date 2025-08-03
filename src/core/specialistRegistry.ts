/**
 * Specialist动态注册系统核心实现
 * 
 * 🚀 架构升级：从硬编码specialist列表升级为动态可配置注册系统
 * 类似于ToolRegistry的设计，提供specialist的动态发现、注册和管理
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Logger } from '../utils/logger';
import { 
    SpecialistConfig, 
    SpecialistDefinition, 
    SpecialistRegistryStats, 
    SpecialistScanResult,
    SpecialistQueryOptions,
    SpecialistValidationResult
} from '../types/specialistRegistry';

/**
 * Specialist动态注册表
 */
export class SpecialistRegistry {
    private logger = Logger.getInstance();
    private specialists: Map<string, SpecialistDefinition> = new Map();
    private lastScanTime: number = 0;
    private scanPromise: Promise<void> | null = null;
    
    // 缓存配置
    private cacheEnabled: boolean = true;
    private cacheTimeout: number = 5 * 60 * 1000; // 5分钟缓存
    
    constructor() {
        this.logger.info('🚀 [SpecialistRegistry] 初始化specialist动态注册系统');
    }

    /**
     * 🔍 核心方法：扫描并注册所有specialist
     */
    public async scanAndRegister(): Promise<SpecialistScanResult> {
        // 防止并发扫描
        if (this.scanPromise) {
            await this.scanPromise;
            return this.getLastScanResult();
        }

        this.scanPromise = this._performScan();
        try {
            await this.scanPromise;
            return this.getLastScanResult();
        } finally {
            this.scanPromise = null;
        }
    }

    /**
     * 内部扫描实现
     */
    private async _performScan(): Promise<void> {
        const startTime = Date.now();
        this.logger.info('🔍 [SpecialistRegistry] 开始扫描specialist文件...');

        try {
            // 获取specialists目录路径
            const rulesPath = this.getSpecialistRulesPath();
            if (!rulesPath) {
                throw new Error('无法找到specialist规则目录');
            }

            // 扫描content和process目录
            const scanResults: SpecialistScanResult = {
                foundFiles: [],
                validSpecialists: [],
                invalidFiles: [],
                scanStats: {
                    totalFiles: 0,
                    validFiles: 0,
                    invalidFiles: 0,
                    scanTime: 0
                }
            };

            // 扫描content specialists
            await this.scanDirectory(
                path.join(rulesPath, 'content'), 
                'content', 
                scanResults
            );

            // 扫描process specialists
            await this.scanDirectory(
                path.join(rulesPath, 'process'), 
                'process', 
                scanResults
            );

            // 更新注册表
            this.specialists.clear();
            scanResults.validSpecialists.forEach(specialist => {
                this.specialists.set(specialist.config.id, specialist);
            });

            // 更新统计信息
            const endTime = Date.now();
            scanResults.scanStats.scanTime = endTime - startTime;
            this.lastScanTime = endTime;

            this.logger.info(`✅ [SpecialistRegistry] 扫描完成: 发现${scanResults.validSpecialists.length}个有效specialist，用时${scanResults.scanStats.scanTime}ms`);
            
            // 打印详细统计
            this.logScanResults(scanResults);

        } catch (error) {
            this.logger.error('❌ [SpecialistRegistry] 扫描失败:', error as Error);
            throw error;
        }
    }

    /**
     * 扫描指定目录
     */
    private async scanDirectory(
        dirPath: string, 
        category: 'content' | 'process', 
        results: SpecialistScanResult
    ): Promise<void> {
        try {
            if (!fs.existsSync(dirPath)) {
                this.logger.warn(`⚠️ [SpecialistRegistry] 目录不存在: ${dirPath}`);
                return;
            }

            const files = fs.readdirSync(dirPath);
            const mdFiles = files.filter(file => file.endsWith('.md') && file !== '.gitkeep');
            
            this.logger.info(`🔍 [SpecialistRegistry] 扫描${category}目录: 发现${mdFiles.length}个.md文件`);

            for (const fileName of mdFiles) {
                const filePath = path.join(dirPath, fileName);
                results.foundFiles.push(filePath);
                results.scanStats.totalFiles++;

                try {
                    const specialist = await this.parseSpecialistFile(filePath, category);
                    if (specialist) {
                        results.validSpecialists.push(specialist);
                        results.scanStats.validFiles++;
                        this.logger.info(`✅ [SpecialistRegistry] 解析成功: ${specialist.config.id}`);
                    }
                } catch (error) {
                    results.invalidFiles.push({
                        filePath,
                        error: (error as Error).message
                    });
                    results.scanStats.invalidFiles++;
                    this.logger.warn(`❌ [SpecialistRegistry] 解析失败 ${fileName}: ${(error as Error).message}`);
                }
            }
        } catch (error) {
            this.logger.error(`❌ [SpecialistRegistry] 扫描目录失败 ${dirPath}:`, error as Error);
        }
    }

    /**
     * 解析单个specialist文件
     */
    private async parseSpecialistFile(
        filePath: string, 
        expectedCategory: 'content' | 'process'
    ): Promise<SpecialistDefinition | null> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const stats = fs.statSync(filePath);
            
            // 解析YAML frontmatter
            const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
            if (!yamlMatch) {
                throw new Error('未找到YAML frontmatter');
            }

            const yamlContent = yamlMatch[1];
            const ruleContent = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
            
            // 解析YAML
            const parsedYaml = yaml.load(yamlContent) as any;
            
            // 验证和构建specialist配置
            const specialist = this.buildSpecialistDefinition(
                parsedYaml,
                filePath,
                path.basename(filePath),
                stats.mtime.getTime(),
                ruleContent,
                expectedCategory
            );

            return specialist;
        } catch (error) {
            throw new Error(`解析specialist文件失败: ${(error as Error).message}`);
        }
    }

    /**
     * 构建specialist定义
     */
    private buildSpecialistDefinition(
        parsedYaml: any,
        filePath: string,
        fileName: string,
        lastModified: number,
        ruleContent: string,
        expectedCategory: 'content' | 'process'
    ): SpecialistDefinition {
        // 🚀 新格式：优先使用specialist_config
        let config: SpecialistConfig;
        
        if (parsedYaml.specialist_config) {
            config = this.parseNewFormat(parsedYaml.specialist_config, expectedCategory, fileName);
        } else if (parsedYaml.assembly_config) {
            // 🔄 向后兼容：从assembly_config推导
            config = this.parseOldFormat(parsedYaml.assembly_config, expectedCategory, fileName);
        } else {
            throw new Error('未找到specialist_config或assembly_config配置');
        }

        // 验证配置
        const validation = this.validateSpecialistConfig(config);
        if (!validation.isValid) {
            throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
        }

        return {
            config,
            filePath,
            fileName,
            lastModified,
            assemblyConfig: parsedYaml.assembly_config,
            ruleContent
        };
    }

    /**
     * 解析新格式配置
     */
    private parseNewFormat(
        specialistConfig: any, 
        expectedCategory: 'content' | 'process',
        fileName: string
    ): SpecialistConfig {
        // 从文件名推导ID（如果未提供）
        const defaultId = fileName.replace('.md', '');
        
        return {
            enabled: specialistConfig.enabled ?? true,
            id: specialistConfig.id || defaultId,
            name: specialistConfig.name || defaultId,
            category: specialistConfig.category || expectedCategory,
            version: specialistConfig.version,
            description: specialistConfig.description,
            author: specialistConfig.author,
            capabilities: specialistConfig.capabilities || [],
            iteration_config: specialistConfig.iteration_config,
            template_config: specialistConfig.template_config,
            tags: specialistConfig.tags || []
        };
    }

    /**
     * 解析旧格式配置（向后兼容）
     */
    private parseOldFormat(
        assemblyConfig: any,
        expectedCategory: 'content' | 'process',
        fileName: string
    ): SpecialistConfig {
        const defaultId = fileName.replace('.md', '');
        
        return {
            enabled: true, // 默认启用
            id: defaultId,
            name: assemblyConfig.specialist_name || defaultId,
            category: assemblyConfig.specialist_type || expectedCategory,
            description: `Legacy specialist: ${assemblyConfig.specialist_name || defaultId}`,
            capabilities: [],
            tags: ['legacy']
        };
    }

    /**
     * 验证specialist配置
     */
    private validateSpecialistConfig(config: SpecialistConfig): SpecialistValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // 必需字段检查
        if (!config.id || typeof config.id !== 'string') {
            errors.push('specialist id is required and must be a string');
        }
        
        if (!config.name || typeof config.name !== 'string') {
            errors.push('specialist name is required and must be a string');
        }
        
        if (!['content', 'process'].includes(config.category)) {
            errors.push('category must be either "content" or "process"');
        }

        // ID格式检查
        if (config.id && !/^[a-z0-9_]+$/.test(config.id)) {
            errors.push('specialist id must contain only lowercase letters, numbers, and underscores');
        }

        // 版本格式检查
        if (config.version && !/^\d+\.\d+\.\d+$/.test(config.version)) {
            warnings.push('version should follow semantic versioning (x.y.z)');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            config: errors.length === 0 ? config : undefined
        };
    }

    /**
     * 🔍 查询specialist
     */
    public getSpecialist(id: string): SpecialistDefinition | undefined {
        return this.specialists.get(id);
    }

    /**
     * 🔍 查询所有specialist
     */
    public getAllSpecialists(options?: SpecialistQueryOptions): SpecialistDefinition[] {
        let results = Array.from(this.specialists.values());

        if (options) {
            // 过滤enabled状态
            if (options.enabled !== undefined) {
                results = results.filter(s => s.config.enabled === options.enabled);
            }

            // 过滤类别
            if (options.category) {
                results = results.filter(s => s.config.category === options.category);
            }

            // 过滤能力
            if (options.capabilities && options.capabilities.length > 0) {
                results = results.filter(s => 
                    options.capabilities!.every(cap => 
                        s.config.capabilities?.includes(cap)
                    )
                );
            }

            // 过滤标签
            if (options.tags && options.tags.length > 0) {
                results = results.filter(s => 
                    options.tags!.some(tag => 
                        s.config.tags?.includes(tag)
                    )
                );
            }
        }

        return results;
    }

    /**
     * 检查specialist是否存在且启用
     */
    public isSpecialistAvailable(id: string): boolean {
        const specialist = this.specialists.get(id);
        return specialist ? specialist.config.enabled : false;
    }

    /**
     * 获取specialist类型 (向后兼容接口)
     */
    public getSpecialistType(id: string): { name: string; category: 'content' | 'process' } | null {
        const specialist = this.specialists.get(id);
        if (!specialist) {
            return null;
        }

        return {
            name: specialist.config.id,
            category: specialist.config.category
        };
    }

    /**
     * 获取注册表统计信息
     */
    public getStats(): SpecialistRegistryStats {
        const specialists = Array.from(this.specialists.values());
        const enabled = specialists.filter(s => s.config.enabled);
        
        const byCategory = {
            content: specialists.filter(s => s.config.category === 'content').length,
            process: specialists.filter(s => s.config.category === 'process').length
        };

        const byVersion: { [version: string]: number } = {};
        specialists.forEach(s => {
            const version = s.config.version || 'unknown';
            byVersion[version] = (byVersion[version] || 0) + 1;
        });

        return {
            totalSpecialists: specialists.length,
            enabledSpecialists: enabled.length,
            disabledSpecialists: specialists.length - enabled.length,
            byCategory,
            byVersion,
            lastScanTime: this.lastScanTime,
            scanDuration: 0 // 将在扫描时更新
        };
    }

    /**
     * 获取specialists规则目录路径
     */
    private getSpecialistRulesPath(): string | null {
        try {
            // 尝试从扩展路径获取
            const extension = vscode.extensions.getExtension('Testany.srs-writer-plugin');
            if (extension) {
                const rulesPath = path.join(extension.extensionPath, 'rules', 'specialists');
                if (fs.existsSync(rulesPath)) {
                    this.logger.info(`✅ [SpecialistRegistry] 使用扩展路径: ${rulesPath}`);
                    return rulesPath;
                }
            }
        } catch (error) {
            this.logger.warn('无法获取扩展路径，尝试其他路径');
        }

        // 备用路径
        const possiblePaths = [
            path.join(__dirname, '../../rules/specialists'),
            path.join(__dirname, '../rules/specialists'),
            path.join(__dirname, 'rules/specialists'),
            path.join(process.cwd(), 'rules/specialists')
        ];

        for (const rulesPath of possiblePaths) {
            if (fs.existsSync(rulesPath)) {
                this.logger.info(`✅ [SpecialistRegistry] 使用规则路径: ${rulesPath}`);
                return rulesPath;
            }
        }

        this.logger.error(`❌ [SpecialistRegistry] 未找到specialists规则目录，搜索路径: ${possiblePaths.join(', ')}`);
        return null;
    }

    /**
     * 获取最后一次扫描结果
     */
    private getLastScanResult(): SpecialistScanResult {
        const specialists = Array.from(this.specialists.values());
        return {
            foundFiles: specialists.map(s => s.filePath),
            validSpecialists: specialists,
            invalidFiles: [],
            scanStats: {
                totalFiles: specialists.length,
                validFiles: specialists.length,
                invalidFiles: 0,
                scanTime: 0
            }
        };
    }

    /**
     * 打印扫描结果
     */
    private logScanResults(results: SpecialistScanResult): void {
        this.logger.info('📊 [SpecialistRegistry] 扫描统计:');
        this.logger.info(`  - 总文件数: ${results.scanStats.totalFiles}`);
        this.logger.info(`  - 有效specialist: ${results.scanStats.validFiles}`);
        this.logger.info(`  - 无效文件: ${results.scanStats.invalidFiles}`);
        this.logger.info(`  - 扫描用时: ${results.scanStats.scanTime}ms`);

        if (results.validSpecialists.length > 0) {
            this.logger.info('📋 [SpecialistRegistry] 已注册的specialist:');
            results.validSpecialists.forEach(s => {
                const status = s.config.enabled ? '✅' : '❌';
                this.logger.info(`  ${status} ${s.config.id} (${s.config.category}) - ${s.config.name}`);
            });
        }

        if (results.invalidFiles.length > 0) {
            this.logger.warn('⚠️ [SpecialistRegistry] 无效文件:');
            results.invalidFiles.forEach(f => {
                this.logger.warn(`  ❌ ${f.filePath}: ${f.error}`);
            });
        }
    }

    /**
     * 🔄 强制重新扫描（清除缓存）
     */
    public async forceRescan(): Promise<SpecialistScanResult> {
        this.lastScanTime = 0;
        this.scanPromise = null;
        return await this.scanAndRegister();
    }

    /**
     * 🧹 清理注册表
     */
    public clear(): void {
        this.specialists.clear();
        this.lastScanTime = 0;
        this.logger.info('🧹 [SpecialistRegistry] 注册表已清理');
    }
}

// 全局单例实例
let globalSpecialistRegistry: SpecialistRegistry | null = null;

/**
 * 获取全局specialist注册表实例
 */
export function getSpecialistRegistry(): SpecialistRegistry {
    if (!globalSpecialistRegistry) {
        globalSpecialistRegistry = new SpecialistRegistry();
    }
    return globalSpecialistRegistry;
}