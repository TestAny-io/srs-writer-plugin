import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Logger } from '../../../utils/logger';
import { SchemaConfig, ScaffoldError, ScaffoldErrorType } from './types';

/**
 * Schema配置加载器
 * 负责从VSCode配置中读取Schema文件路径并加载配置
 */
export class SchemaLoader {
    private static readonly logger = Logger.getInstance();
    private static readonly DEFAULT_SCHEMA_PATH = 'config/schemas/requirement-entity-schemas.yaml';
    private static readonly CONFIG_KEY = 'srs-writer.requirementScaffold.schemaPath';
    
    // 缓存机制
    private static cachedSchemas: SchemaConfig | null = null;
    private static lastLoadTime: number = 0;
    private static readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

    /**
     * 加载Schema配置
     * @param forceReload 是否强制重新加载（忽略缓存）
     * @returns Schema配置对象
     */
    public static async loadSchemas(forceReload: boolean = false): Promise<SchemaConfig> {
        try {
            // 检查缓存
            if (!forceReload && this.isCacheValid()) {
                this.logger.info('📋 使用缓存的Schema配置');
                return this.cachedSchemas!;
            }

            this.logger.info('📋 开始加载Schema配置...');

            // 1. 从VSCode配置中读取Schema文件路径
            const configuredPath = this.getConfiguredSchemaPath();
            this.logger.info(`🔍 配置的Schema路径: ${configuredPath}`);

            // 2. 智能路径解析：用户配置使用工作区路径，默认路径使用插件路径
            const schemaPath = this.resolveSchemaPath(configuredPath);
            this.logger.info(`📁 解析的绝对路径: ${schemaPath}`);

            // 3. 检查文件是否存在
            await this.validateSchemaFile(schemaPath);

            // 4. 读取并解析YAML文件
            const content = await fs.readFile(schemaPath, 'utf-8');
            const schemas = yaml.load(content) as SchemaConfig;

            // 5. 验证Schema配置格式
            this.validateSchemaConfig(schemas);

            // 6. 版本兼容性检查
            this.validateVersionCompatibility(schemas);

            // 7. 更新缓存
            this.cachedSchemas = schemas;
            this.lastLoadTime = Date.now();

            this.logger.info(`✅ Schema配置加载成功 - 版本: ${schemas.version}`);
            this.logger.info(`📊 实体映射: ${Object.keys(schemas.entity_mappings).length} 个基础实体`);
            this.logger.info(`📊 ADC映射: ${Object.keys(schemas.adc_mappings).length} 个ADC实体`);

            return schemas;

        } catch (error) {
            if (error instanceof ScaffoldError) {
                throw error;
            }

            this.logger.error('Schema配置加载失败', error as Error);
            throw new ScaffoldError(
                ScaffoldErrorType.SCHEMA_LOAD_FAILED,
                `Schema配置加载失败: ${(error as Error).message}`
            );
                }
    }

    /**
     * 从VSCode配置中获取Schema文件路径
     */
    private static getConfiguredSchemaPath(): string {
        try {
            const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);
            const configuredPath = config.get<string>('SCHEMA_PATH', '');
            
            if (!configuredPath) {
                this.logger.info('⚠️  未配置Schema路径，使用默认路径');
                return this.DEFAULT_SCHEMA_PATH;
            }

            this.logger.info(`✅ 使用用户配置的Schema路径: ${configuredPath}`);
            return configuredPath;

        } catch (error) {
            this.logger.warn(`读取VSCode配置失败，使用默认Schema路径: ${error instanceof Error ? error.message : String(error)}`);
            return this.DEFAULT_SCHEMA_PATH;
        }
    }

    /**
     * 🚀 智能Schema路径解析：区分用户配置路径和默认插件路径
     */
    private static resolveSchemaPath(configuredPath: string): string {
        // 如果是默认路径，从插件安装目录读取
        if (configuredPath === this.DEFAULT_SCHEMA_PATH) {
            return this.resolvePluginSchemaPath();
        }
        
        // 用户配置的路径，从工作区读取
        return this.resolveWorkspacePath(configuredPath);
    }

    /**
     * 从插件安装目录解析Schema文件路径
     */
    private static resolvePluginSchemaPath(): string {
        try {
            // 尝试获取插件扩展路径
            const extension = vscode.extensions.getExtension('Testany.srs-writer-plugin');
            if (extension) {
                const pluginSchemaPath = path.join(extension.extensionPath, this.DEFAULT_SCHEMA_PATH);
                this.logger.info(`✅ 使用插件扩展路径: ${pluginSchemaPath}`);
                return pluginSchemaPath;
            }
        } catch (error) {
            this.logger.warn('无法获取插件扩展路径，使用备用路径');
        }
        
        // 备用路径策略（参考specialistExecutor的实现）
        const fallbackPaths = [
            path.join(__dirname, '../../../..', this.DEFAULT_SCHEMA_PATH),    // 从 dist/tools/document/scaffoldGenerator 到根目录
            path.join(__dirname, '../../../../..', this.DEFAULT_SCHEMA_PATH),  // 从更深的webpack结构到根目录
            path.join(__dirname, '../../../../../..', this.DEFAULT_SCHEMA_PATH), // webpack打包后的更深层结构
            path.resolve(process.cwd(), this.DEFAULT_SCHEMA_PATH)              // 工作目录下的config（最后备选）
        ];
        
        // 查找第一个存在的路径
        for (const fallbackPath of fallbackPaths) {
            try {
                if (fsSync.existsSync(fallbackPath)) {
                    this.logger.info(`✅ 使用备用Schema路径: ${fallbackPath}`);
                    return fallbackPath;
                }
            } catch (error) {
                // 继续尝试下一个路径
                continue;
            }
        }
        
        // 如果都不存在，返回第一个备用路径（让后续验证逻辑处理错误）
        const defaultPath = fallbackPaths[0];
        this.logger.warn(`⚠️ 所有Schema路径都不存在，使用默认路径: ${defaultPath}`);
        return defaultPath;
    }

    /**
     * 解析相对于VSCode工作区的绝对路径
     */
    private static resolveWorkspacePath(relativePath: string): string {
        // 如果已经是绝对路径，直接返回
        if (path.isAbsolute(relativePath)) {
            return relativePath;
        }

        // 获取工作区根目录
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new ScaffoldError(
                ScaffoldErrorType.SCHEMA_LOAD_FAILED,
                '未找到VSCode工作区，无法解析Schema文件路径'
            );
        }

        // 使用第一个工作区文件夹作为根目录
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const absolutePath = path.resolve(workspaceRoot, relativePath);

        this.logger.info(`🔗 路径解析: ${relativePath} -> ${absolutePath}`);
        return absolutePath;
    }

    /**
     * 验证Schema文件是否存在且可读
     */
    private static async validateSchemaFile(schemaPath: string): Promise<void> {
        try {
            const stat = await fs.stat(schemaPath);
            
            if (!stat.isFile()) {
                throw new ScaffoldError(
                    ScaffoldErrorType.FILE_NOT_FOUND,
                    `Schema路径不是文件: ${schemaPath}`
                );
            }

            // 检查文件权限
            await fs.access(schemaPath);

        } catch (error) {
            if (error instanceof ScaffoldError) {
                throw error;
            }

            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code === 'ENOENT') {
                throw new ScaffoldError(
                    ScaffoldErrorType.FILE_NOT_FOUND,
                    `Schema配置文件不存在: ${schemaPath}`
                );
            } else if (nodeError.code === 'EACCES') {
                throw new ScaffoldError(
                    ScaffoldErrorType.PERMISSION_DENIED,
                    `没有权限读取Schema配置文件: ${schemaPath}`
                );
            }

            throw new ScaffoldError(
                ScaffoldErrorType.SCHEMA_LOAD_FAILED,
                `访问Schema配置文件失败: ${(error as Error).message}`
            );
        }
    }

    /**
     * 验证Schema配置格式
     */
    private static validateSchemaConfig(schemas: SchemaConfig): void {
        const requiredFields = [
            'version',
            'entity_mappings',
            'adc_mappings',
            'entity_output_order'
        ];

        for (const field of requiredFields) {
            if (!(field in schemas)) {
                throw new ScaffoldError(
                    ScaffoldErrorType.SCHEMA_LOAD_FAILED,
                    `Schema配置缺少必需字段: ${field}`
                );
            }
        }

        // 验证实体映射结构
        this.validateEntityMappings(schemas.entity_mappings, 'entity_mappings');
        this.validateEntityMappings(schemas.adc_mappings, 'adc_mappings');

        // 验证输出顺序
        if (!Array.isArray(schemas.entity_output_order) || schemas.entity_output_order.length === 0) {
            throw new ScaffoldError(
                ScaffoldErrorType.SCHEMA_LOAD_FAILED,
                'entity_output_order 必须是非空数组'
            );
        }
    }

    /**
     * 验证实体映射结构
     */
    private static validateEntityMappings(mappings: Record<string, any>, fieldName: string): void {
        if (!mappings || typeof mappings !== 'object') {
            throw new ScaffoldError(
                ScaffoldErrorType.SCHEMA_LOAD_FAILED,
                `${fieldName} 必须是对象`
            );
        }

        for (const [key, mapping] of Object.entries(mappings)) {
            if (!mapping.yaml_key || !mapping.template) {
                throw new ScaffoldError(
                    ScaffoldErrorType.SCHEMA_LOAD_FAILED,
                    `${fieldName}.${key} 缺少必需字段 yaml_key 或 template`
                );
            }
        }
    }

    /**
     * 验证版本兼容性
     */
    private static validateVersionCompatibility(schemas: SchemaConfig): void {
        const currentVersion = '1.0'; // 当前支持的版本
        
        if (!schemas.compatible_versions || !Array.isArray(schemas.compatible_versions)) {
            this.logger.warn('⚠️  Schema配置未定义compatible_versions，跳过版本检查');
            return;
        }

        if (!schemas.compatible_versions.includes(currentVersion)) {
            throw new ScaffoldError(
                ScaffoldErrorType.VERSION_INCOMPATIBLE,
                `Schema版本不兼容。当前支持版本: ${currentVersion}，Schema兼容版本: ${schemas.compatible_versions.join(', ')}`
            );
        }

        this.logger.info(`✅ 版本兼容性检查通过 - Schema版本: ${schemas.version}`);
    }

    /**
     * 检查缓存是否有效
     */
    private static isCacheValid(): boolean {
        if (!this.cachedSchemas || this.lastLoadTime === 0) {
            return false;
        }

        const cacheAge = Date.now() - this.lastLoadTime;
        return cacheAge < this.CACHE_TTL;
    }

    /**
     * 清除缓存
     */
    public static clearCache(): void {
        this.cachedSchemas = null;
        this.lastLoadTime = 0;
        this.logger.info('🗑️  Schema缓存已清除');
    }

    /**
     * 获取当前Schema路径（用于调试）
     */
    public static getCurrentSchemaPath(): string {
        const configuredPath = this.getConfiguredSchemaPath();
        return this.resolveWorkspacePath(configuredPath);
    }

    /**
     * 获取Schema配置说明
     */
    public static getConfigurationHelp(): string[] {
        return [
            'Schema配置说明:',
            '',
            `配置键: ${this.CONFIG_KEY}`,
            `默认路径: ${this.DEFAULT_SCHEMA_PATH}`,
            '',
            '在VSCode中配置:',
            '1. 打开 设置 > 扩展 > SRS Writer',
            '2. 找到 "Requirement Scaffold: Schema Path"',
            '3. 点击 "Edit in settings.json" 修改路径',
            '',
            '文件格式: YAML',
            '包含内容: 所有需求实体的结构定义',
            '',
            '支持的实体类型:',
            '- US: User Stories (用户故事)',
            '- UC: Use Cases (用例)',
            '- FR: Functional Requirements (功能需求)',
            '- NFR: Non-Functional Requirements (非功能需求)',
            '- IFR: Interface Requirements (接口需求)',
            '- DAR: Data Requirements (数据需求)',
            '- ADC-ASSU: Assumptions (假设条件)',
            '- ADC-DEPEN: Dependencies (依赖关系)',
            '- ADC-CONST: Constraints (约束条件)',
            '',
            '注意: Schema文件路径相对于VSCode工作区根目录'
        ];
    }
} 